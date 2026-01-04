// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title MosquitoSlayerNFT
 * @dev Achievement NFTs for "Tap That Mosquito" game
 * Players can mint NFTs based on their achievement tier
 */
contract MosquitoSlayerNFT is ERC721, Ownable {
    using Strings for uint256;

    // Achievement tiers
    enum Tier { Common, Uncommon, Rare, Epic, Legendary }

    // Tier requirements (minimum score)
    uint256 public constant TIER_COMMON = 0;
    uint256 public constant TIER_UNCOMMON = 200;
    uint256 public constant TIER_RARE = 500;
    uint256 public constant TIER_EPIC = 1000;
    uint256 public constant TIER_LEGENDARY = 2000;

    // Token counter
    uint256 private _tokenIdCounter;

    // Mapping: wallet => tier => hasClaimed
    mapping(address => mapping(Tier => bool)) public hasClaimed;

    // Mapping: tokenId => tier
    mapping(uint256 => Tier) public tokenTier;

    // Mapping: tokenId => score achieved
    mapping(uint256 => uint256) public tokenScore;

    // Mapping: tokenId => timestamp
    mapping(uint256 => uint256) public tokenTimestamp;

    // Events
    event AchievementMinted(address indexed player, uint256 indexed tokenId, Tier tier, uint256 score);

    constructor() ERC721("Mosquito Slayer", "MOSQUITO") Ownable(msg.sender) {}

    /**
     * @dev Mint an achievement NFT for a specific tier
     * @param tier The achievement tier to mint
     * @param score The score achieved (must meet tier requirement)
     */
    function mintAchievement(Tier tier, uint256 score) external {
        // Validate score meets tier requirement
        require(_scoreQualifiesForTier(score, tier), "Score does not qualify for this tier");
        
        // Check if already claimed this tier
        require(!hasClaimed[msg.sender][tier], "Already claimed this tier");

        // Mark as claimed
        hasClaimed[msg.sender][tier] = true;

        // Mint the NFT
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(msg.sender, tokenId);

        // Store metadata
        tokenTier[tokenId] = tier;
        tokenScore[tokenId] = score;
        tokenTimestamp[tokenId] = block.timestamp;

        emit AchievementMinted(msg.sender, tokenId, tier, score);
    }

    /**
     * @dev Check if a score qualifies for a tier
     */
    function _scoreQualifiesForTier(uint256 score, Tier tier) internal pure returns (bool) {
        if (tier == Tier.Legendary) return score >= TIER_LEGENDARY;
        if (tier == Tier.Epic) return score >= TIER_EPIC;
        if (tier == Tier.Rare) return score >= TIER_RARE;
        if (tier == Tier.Uncommon) return score >= TIER_UNCOMMON;
        return true; // Common has no minimum
    }

    /**
     * @dev Get tier from score
     */
    function getTierFromScore(uint256 score) public pure returns (Tier) {
        if (score >= TIER_LEGENDARY) return Tier.Legendary;
        if (score >= TIER_EPIC) return Tier.Epic;
        if (score >= TIER_RARE) return Tier.Rare;
        if (score >= TIER_UNCOMMON) return Tier.Uncommon;
        return Tier.Common;
    }

    /**
     * @dev Get tier name
     */
    function getTierName(Tier tier) public pure returns (string memory) {
        if (tier == Tier.Legendary) return "Mosquito Slayer";
        if (tier == Tier.Epic) return "Bug Hunter";
        if (tier == Tier.Rare) return "Swatter Pro";
        if (tier == Tier.Uncommon) return "Pest Control";
        return "Beginner";
    }

    /**
     * @dev Get tier color (hex)
     */
    function getTierColor(Tier tier) public pure returns (string memory) {
        if (tier == Tier.Legendary) return "#ff6b9d";
        if (tier == Tier.Epic) return "#a855f7";
        if (tier == Tier.Rare) return "#3b82f6";
        if (tier == Tier.Uncommon) return "#22c55e";
        return "#6b7280";
    }

    /**
     * @dev Get tier emoji
     */
    function getTierEmoji(Tier tier) public pure returns (string memory) {
        if (tier == Tier.Legendary) return unicode"🏆";
        if (tier == Tier.Epic) return unicode"💎";
        if (tier == Tier.Rare) return unicode"⭐";
        if (tier == Tier.Uncommon) return unicode"🎖️";
        return unicode"🥉";
    }

    /**
     * @dev Generate SVG for the NFT
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        Tier tier = tokenTier[tokenId];
        uint256 score = tokenScore[tokenId];
        string memory tierName = getTierName(tier);
        string memory tierColor = getTierColor(tier);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs>',
            '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#0a0a0f"/>',
            '<stop offset="100%" style="stop-color:#1a1a2e"/>',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="400" fill="url(#bg)"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="', tierColor, '" stroke-width="4" rx="20"/>',
            '<text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="40">',
            unicode'🦟',
            '</text>',
            '<text x="200" y="140" text-anchor="middle" font-family="monospace" font-size="16" fill="', tierColor, '">',
            tierName,
            '</text>',
            '<text x="200" y="200" text-anchor="middle" font-family="monospace" font-size="48" fill="#00ff88">',
            score.toString(),
            '</text>',
            '<text x="200" y="240" text-anchor="middle" font-family="monospace" font-size="14" fill="#8888aa">',
            'POINTS',
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
     * @dev Returns the token URI with on-chain metadata and SVG
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        Tier tier = tokenTier[tokenId];
        uint256 score = tokenScore[tokenId];
        string memory tierName = getTierName(tier);
        string memory svg = generateSVG(tokenId);

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"', tierName, ' #', tokenId.toString(), '",',
            '"description":"Achievement NFT from Tap That Mosquito game. Score: ', score.toString(), ' points.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Tier","value":"', tierName, '"},',
            '{"trait_type":"Score","value":', score.toString(), '},',
            '{"trait_type":"Tier Level","value":', uint256(tier).toString(), '}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @dev Check which tiers a player can claim
     */
    function getClaimableTiers(address player, uint256 score) external view returns (bool[5] memory) {
        bool[5] memory claimable;
        
        // Check each tier
        claimable[0] = !hasClaimed[player][Tier.Common] && score >= TIER_COMMON;
        claimable[1] = !hasClaimed[player][Tier.Uncommon] && score >= TIER_UNCOMMON;
        claimable[2] = !hasClaimed[player][Tier.Rare] && score >= TIER_RARE;
        claimable[3] = !hasClaimed[player][Tier.Epic] && score >= TIER_EPIC;
        claimable[4] = !hasClaimed[player][Tier.Legendary] && score >= TIER_LEGENDARY;

        return claimable;
    }

    /**
     * @dev Get all tokens owned by an address
     */
    function getPlayerAchievements(address player) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(player);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 0; i < _tokenIdCounter; i++) {
            if (_ownerOf(i) == player) {
                tokens[index] = i;
                index++;
            }
        }

        return tokens;
    }

    /**
     * @dev Total supply of NFTs
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
