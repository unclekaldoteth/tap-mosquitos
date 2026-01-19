// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GamePassNFT
 * @dev P2W Game Pass for "Tap That Mosquito"
 * - Mint NFT to gain eligibility for weekly prize pool
 * - 70% to prize pool, 20% treasury, 10% referral
 * - Only holders can compete for prizes
 */
contract GamePassNFT is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Mint price: 0.0005 ETH
    uint256 public constant MINT_PRICE = 0.0005 ether;
    
    // Revenue split (basis points, 10000 = 100%)
    uint256 public constant PRIZE_POOL_SHARE = 7000;   // 70%
    uint256 public constant TREASURY_SHARE = 2000;     // 20%
    uint256 public constant REFERRAL_SHARE = 1000;     // 10%

    // Prize distribution percentages for top 10 (basis points)
    uint256[10] public rewardPercentages = [3000, 2000, 1200, 800, 600, 500, 400, 300, 100, 100];

    // Token counter
    uint256 private _tokenIdCounter;

    // Balances
    uint256 public prizePool;
    uint256 public treasury;

    // Trusted signer for prize distribution
    address public trustedSigner;
    mapping(bytes32 => bool) public usedSignatures;

    // Token metadata
    mapping(uint256 => uint256) public tokenMintTime;
    mapping(uint256 => address) public tokenReferrer;

    // Referral tracking
    mapping(address => uint256) public referralEarnings;
    mapping(address => uint256) public referralCount;

    // Weekly distribution tracking
    mapping(uint256 => bool) public weekDistributed;
    uint256 public currentWeek;

    // Events
    event GamePassMinted(address indexed player, uint256 indexed tokenId, address indexed referrer);
    event PrizeDistributed(uint256 indexed week, uint256 totalAmount, address[] winners);
    event ReferralPaid(address indexed referrer, address indexed minter, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    constructor(address _trustedSigner) ERC721("Mosquito Game Pass", "MQPASS") Ownable(msg.sender) {
        require(_trustedSigner != address(0), "Invalid signer");
        trustedSigner = _trustedSigner;
    }

    /**
     * @dev Mint a Game Pass NFT
     */
    function mintGamePass() external payable nonReentrant returns (uint256) {
        return _mintPass(address(0));
    }

    /**
     * @dev Mint a Game Pass NFT with referral
     * @param referrer Address of the referrer
     */
    function mintWithReferral(address referrer) external payable nonReentrant returns (uint256) {
        require(referrer != msg.sender, "Cannot refer yourself");
        return _mintPass(referrer);
    }

    /**
     * @dev Internal mint function
     */
    function _mintPass(address referrer) internal returns (uint256) {
        require(msg.value >= MINT_PRICE, "Insufficient payment");

        uint256 paymentAmount = MINT_PRICE;
        uint256 refundAmount = msg.value - MINT_PRICE;

        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter++;
        }

        // Calculate revenue split
        uint256 prizeAmount = (paymentAmount * PRIZE_POOL_SHARE) / 10000;
        uint256 treasuryAmount = (paymentAmount * TREASURY_SHARE) / 10000;
        uint256 referralAmount = (paymentAmount * REFERRAL_SHARE) / 10000;

        // Add to prize pool
        prizePool += prizeAmount;
        
        // Handle referral
        if (referrer != address(0) && balanceOf(referrer) > 0) {
            // Pay referrer directly
            referralEarnings[referrer] += referralAmount;
            referralCount[referrer]++;
            treasury += treasuryAmount;
            
            // Transfer referral bonus
            (bool sent, ) = referrer.call{value: referralAmount}("");
            if (!sent) {
                // If transfer fails, add to treasury
                treasury += referralAmount;
            } else {
                emit ReferralPaid(referrer, msg.sender, referralAmount);
            }
        } else {
            // No valid referrer, add to treasury
            treasury += treasuryAmount + referralAmount;
        }

        // Mint NFT
        _safeMint(msg.sender, tokenId);
        tokenMintTime[tokenId] = block.timestamp;
        tokenReferrer[tokenId] = referrer;

        emit GamePassMinted(msg.sender, tokenId, referrer);

        // Refund excess payment
        if (refundAmount > 0) {
            (bool refunded, ) = msg.sender.call{value: refundAmount}("");
            require(refunded, "Refund failed");
        }

        return tokenId;
    }

    /**
     * @dev Check if address has a Game Pass
     */
    function hasGamePass(address player) external view returns (bool) {
        return balanceOf(player) > 0;
    }

    /**
     * @dev Get player's Game Pass token IDs
     */
    function getPlayerPasses(address player) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(player);
        uint256[] memory tokens = new uint256[](balance);

        for (uint256 i = 0; i < balance;) {
            tokens[i] = tokenOfOwnerByIndex(player, i);
            unchecked {
                ++i;
            }
        }

        return tokens;
    }

    /**
     * @dev Distribute weekly prizes to top 10 players
     * @param week Week number
     * @param winners Array of 10 winner addresses
     * @param nonce Unique nonce
     * @param signature Backend signature
     */
    function distributeWeeklyPrize(
        uint256 week,
        address[] calldata winners,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        require(!weekDistributed[week], "Week already distributed");
        require(winners.length == 10, "Must have 10 winners");
        require(prizePool > 0, "No prize pool");

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(week, winners, nonce));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        require(!usedSignatures[ethSignedHash], "Signature used");
        require(ethSignedHash.recover(signature) == trustedSigner, "Invalid signature");
        
        usedSignatures[ethSignedHash] = true;
        weekDistributed[week] = true;
        currentWeek = week;

        uint256 distributableAmount = prizePool;
        prizePool = 0; // Reset pool

        uint256 remainingAmount = distributableAmount;

        // Distribute to winners
        address[] memory paidWinners = new address[](10);
        for (uint256 i = 0; i < 10; i++) {
            uint256 reward = (distributableAmount * rewardPercentages[i]) / 10000;
            if (reward == 0) {
                continue;
            }

            // Only pay if winner has a Game Pass
            if (balanceOf(winners[i]) > 0) {
                (bool sent, ) = winners[i].call{value: reward}("");
                if (sent) {
                    remainingAmount -= reward;
                    paidWinners[i] = winners[i];
                }
            }
        }

        // Roll over unpaid rewards to the next prize pool
        prizePool = remainingAmount;

        emit PrizeDistributed(week, distributableAmount, paidWinners);
    }

    /**
     * @dev Withdraw treasury funds (owner only)
     */
    function withdrawTreasury() external onlyOwner {
        uint256 amount = treasury;
        require(amount > 0, "No treasury balance");
        treasury = 0;
        
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdrawal failed");
        
        emit TreasuryWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Emergency: Add funds to prize pool (owner only)
     */
    function fundPrizePool() external payable onlyOwner {
        prizePool += msg.value;
    }

    /**
     * @dev Update trusted signer
     */
    function setTrustedSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer");
        address oldSigner = trustedSigner;
        trustedSigner = _newSigner;
        emit TrustedSignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @dev Generate on-chain SVG for Game Pass
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        address owner = ownerOf(tokenId);
        uint256 passCount = balanceOf(owner);
        
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs>',
            '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#0a0a0f"/>',
            '<stop offset="100%" style="stop-color:#1a1a2e"/>',
            '</linearGradient>',
            '<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#f5af19"/>',
            '<stop offset="100%" style="stop-color:#f12711"/>',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="400" fill="url(#bg)"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="url(#gold)" stroke-width="4" rx="20"/>',
            '<text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="40">',
            unicode'🎮',
            '</text>',
            '<text x="200" y="130" text-anchor="middle" font-family="monospace" font-size="20" fill="#f5af19">',
            'GAME PASS',
            '</text>',
            '<text x="200" y="200" text-anchor="middle" font-family="monospace" font-size="14" fill="#00ff88">',
            'Prize Pool Eligible',
            '</text>',
            '<text x="200" y="260" text-anchor="middle" font-family="monospace" font-size="12" fill="#888">',
            'Passes Held: ', passCount.toString(),
            '</text>',
            '<text x="200" y="320" text-anchor="middle" font-family="monospace" font-size="12" fill="#8888aa">',
            'Tap That Mosquito',
            '</text>',
            '<text x="200" y="350" text-anchor="middle" font-family="monospace" font-size="10" fill="#555">',
            '#', tokenId.toString(),
            '</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Token URI with on-chain metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        string memory svg = generateSVG(tokenId);

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Mosquito Game Pass #', tokenId.toString(), '",',
            '"description":"Game Pass for Tap That Mosquito P2W mode. Holders are eligible for weekly prize pool rewards.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Type","value":"Game Pass"},',
            '{"trait_type":"Mint Time","value":', tokenMintTime[tokenId].toString(), '}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ============ View Functions ============

    /**
     * @dev Get current prize pool balance
     */
    function getPrizePool() external view returns (uint256) {
        return prizePool;
    }

    /**
     * @dev Get treasury balance
     */
    function getTreasury() external view returns (uint256) {
        return treasury;
    }

    /**
     * @dev Get total minted
     */
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ============ Required Overrides ============

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
