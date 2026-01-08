// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PrizePool
 * @notice Sponsor-funded prize pool for Tap That Mosquito weekly rewards
 * @dev Uses USDC on Base, with sponsor tiers and percentage-based distribution
 */
contract PrizePool is ERC721, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using Strings for uint256;

    // USDC on Base mainnet
    IERC20 public immutable usdc;
    
    // Trusted signer for distributions
    address public trustedSigner;
    
    // Sponsor tiers in USDC (6 decimals)
    uint256 public constant BRONZE_THRESHOLD = 3 * 1e6;   // $3
    uint256 public constant SILVER_THRESHOLD = 5 * 1e6;   // $5
    uint256 public constant GOLD_THRESHOLD = 10 * 1e6;    // $10
    uint256 public constant DIAMOND_THRESHOLD = 20 * 1e6; // $20

    // Distribution percentages (basis points, 10000 = 100%)
    // #1: 30%, #2: 20%, #3: 12%, #4: 8%, #5: 6%, #6: 5%, #7: 4%, #8: 3%, #9: 1%, #10: 1%
    uint256[10] public rewardPercentages = [3000, 2000, 1200, 800, 600, 500, 400, 300, 100, 100];
    uint256 public constant RESERVE_PERCENTAGE = 0; // 0%

    // Sponsor tracking
    struct Sponsor {
        uint256 totalDonated;
        uint256 firstDonationTime;
        bool hasMintedNFT;
    }
    
    mapping(address => Sponsor) public sponsors;
    address[] public sponsorList;
    
    // Distribution tracking
    mapping(uint256 => bool) public weekDistributed;
    uint256 public currentWeek;
    
    // NFT tracking
    uint256 public nextTokenId = 1;
    mapping(uint256 => address) public tokenSponsor;
    mapping(uint256 => uint256) public tokenDonationAmount;

    // Events
    event Deposited(address indexed sponsor, uint256 amount, uint8 tier);
    event Distributed(uint256 indexed week, uint256 totalAmount, address[] winners);
    event SponsorNFTMinted(address indexed sponsor, uint256 tokenId);

    enum Tier { None, Bronze, Silver, Gold, Diamond }

    constructor(
        address _usdc,
        address _trustedSigner
    ) ERC721("Mosquito Sponsor", "MQSPONSOR") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        trustedSigner = _trustedSigner;
    }

    /**
     * @notice Deposit USDC to sponsor the prize pool
     * @param amount Amount of USDC to deposit (in 6 decimals)
     */
    function deposit(uint256 amount) external {
        require(amount >= BRONZE_THRESHOLD, "Minimum $3 USDC");
        
        // Transfer USDC from sender
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Track sponsor
        if (sponsors[msg.sender].totalDonated == 0) {
            sponsorList.push(msg.sender);
            sponsors[msg.sender].firstDonationTime = block.timestamp;
        }
        sponsors[msg.sender].totalDonated += amount;
        
        // Get tier and emit event
        Tier tier = getSponsorTier(msg.sender);
        emit Deposited(msg.sender, amount, uint8(tier));
    }

    /**
     * @notice Get sponsor tier based on total donations
     */
    function getSponsorTier(address sponsor) public view returns (Tier) {
        uint256 total = sponsors[sponsor].totalDonated;
        if (total >= DIAMOND_THRESHOLD) return Tier.Diamond;
        if (total >= GOLD_THRESHOLD) return Tier.Gold;
        if (total >= SILVER_THRESHOLD) return Tier.Silver;
        if (total >= BRONZE_THRESHOLD) return Tier.Bronze;
        return Tier.None;
    }

    /**
     * @notice Check if sponsor has permanent game boost perk (Silver+)
     */
    function hasBoostPerk(address sponsor) external view returns (bool) {
        return getSponsorTier(sponsor) >= Tier.Silver;
    }

    /**
     * @notice Check if sponsor can mint Sponsor NFT (Gold+)
     */
    function canMintSponsorNFT(address sponsor) public view returns (bool) {
        return getSponsorTier(sponsor) >= Tier.Gold && !sponsors[sponsor].hasMintedNFT;
    }

    /**
     * @notice Mint Sponsor NFT (Gold+ only, once per sponsor)
     */
    function mintSponsorNFT() external {
        require(canMintSponsorNFT(msg.sender), "Not eligible or already minted");
        
        sponsors[msg.sender].hasMintedNFT = true;
        
        uint256 tokenId = nextTokenId++;
        tokenSponsor[tokenId] = msg.sender;
        tokenDonationAmount[tokenId] = sponsors[msg.sender].totalDonated;
        
        _mint(msg.sender, tokenId);
        emit SponsorNFTMinted(msg.sender, tokenId);
    }

    /**
     * @notice Distribute weekly rewards with signature verification
     * @param week Week number for this distribution
     * @param winners Array of winner addresses (top 10)
     * @param nonce Unique nonce for this distribution
     * @param signature Backend signature
     */
    function distribute(
        uint256 week,
        address[] calldata winners,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(!weekDistributed[week], "Week already distributed");
        require(winners.length == 10, "Must have 10 winners");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(week, winners, nonce));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(ethSignedHash.recover(signature) == trustedSigner, "Invalid signature");
        
        weekDistributed[week] = true;
        currentWeek = week;
        
        // Calculate distributable amount (90% of balance)
        uint256 balance = usdc.balanceOf(address(this));
        uint256 distributable = (balance * (10000 - RESERVE_PERCENTAGE)) / 10000;
        
        // Distribute to winners
        for (uint256 i = 0; i < 10; i++) {
            uint256 reward = (distributable * rewardPercentages[i]) / 10000;
            if (reward > 0) {
                usdc.transfer(winners[i], reward);
            }
        }
        
        emit Distributed(week, distributable, winners);
    }

    /**
     * @notice Emergency distribution by owner (fallback if backend fails)
     */
    function emergencyDistribute(
        address[] calldata winners,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(winners.length == amounts.length, "Length mismatch");
        
        for (uint256 i = 0; i < winners.length; i++) {
            usdc.transfer(winners[i], amounts[i]);
        }
    }

    /**
     * @notice Update trusted signer
     */
    function setTrustedSigner(address _signer) external onlyOwner {
        trustedSigner = _signer;
    }

    /**
     * @notice Get current pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get all sponsors
     */
    function getAllSponsors() external view returns (address[] memory) {
        return sponsorList;
    }

    /**
     * @notice Get sponsor count
     */
    function getSponsorCount() external view returns (uint256) {
        return sponsorList.length;
    }

    /**
     * @notice Get Diamond sponsors for cast mentions
     */
    function getDiamondSponsors() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < sponsorList.length; i++) {
            if (getSponsorTier(sponsorList[i]) == Tier.Diamond) {
                count++;
            }
        }
        
        address[] memory diamonds = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < sponsorList.length; i++) {
            if (getSponsorTier(sponsorList[i]) == Tier.Diamond) {
                diamonds[index++] = sponsorList[i];
            }
        }
        return diamonds;
    }

    /**
     * @notice Generate on-chain SVG for Sponsor NFT
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(tokenId > 0 && tokenId < nextTokenId, "Invalid token");
        
        address sponsor = tokenSponsor[tokenId];
        Tier tier = getSponsorTier(sponsor);
        uint256 donated = tokenDonationAmount[tokenId] / 1e6; // Convert to dollars
        
        string memory tierName;
        string memory tierColor;
        
        if (tier == Tier.Diamond) {
            tierName = "DIAMOND";
            tierColor = "#00d4ff";
        } else {
            tierName = "GOLD";
            tierColor = "#ffd700";
        }
        
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#0a0a0f"/>',
            '<text x="200" y="80" text-anchor="middle" fill="', tierColor, '" font-size="24" font-family="monospace">GAME SPONSOR</text>',
            '<text x="200" y="180" text-anchor="middle" fill="', tierColor, '" font-size="48">&#127942;</text>',
            '<text x="200" y="250" text-anchor="middle" fill="', tierColor, '" font-size="28" font-family="monospace">', tierName, '</text>',
            '<text x="200" y="300" text-anchor="middle" fill="#888" font-size="18" font-family="monospace">$', donated.toString(), ' Donated</text>',
            '<text x="200" y="340" text-anchor="middle" fill="#666" font-size="14" font-family="monospace">Sponsor #', tokenId.toString(), '</text>',
            '</svg>'
        ));
    }

    /**
     * @notice Token URI with on-chain metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId < nextTokenId, "Invalid token");
        
        address sponsor = tokenSponsor[tokenId];
        Tier tier = getSponsorTier(sponsor);
        uint256 donated = tokenDonationAmount[tokenId] / 1e6;
        
        string memory tierName = tier == Tier.Diamond ? "Diamond" : "Gold";
        string memory svg = generateSVG(tokenId);
        
        string memory json = string(abi.encodePacked(
            '{"name":"Mosquito Sponsor #', tokenId.toString(),
            '","description":"Official game sponsor for Tap That Mosquito",',
            '"attributes":[{"trait_type":"Tier","value":"', tierName,
            '"},{"trait_type":"Donated","value":"$', donated.toString(),
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)), '"}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }
}
