// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VersusNFT
 * @dev Victory Trophy NFTs for "Tap That Mosquito" versus mode
 * Only winners can mint NFTs after a battle
 */
contract VersusNFT is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Challenge status
    enum ChallengeStatus { Pending, Accepted, Completed, Cancelled }

    // Challenge struct
    struct Challenge {
        address challenger;
        address opponent;
        ChallengeStatus status;
        uint256 createdAt;
        uint256 battleId;
    }

    // Battle struct (completed matches)
    struct Battle {
        address winner;
        address loser;
        uint256 winnerScore;
        uint256 loserScore;
        uint256 timestamp;
        bool nftMinted;
    }

    // Token counter
    uint256 private _tokenIdCounter;

    // Challenge counter
    uint256 private _challengeIdCounter;

    // Battle counter
    uint256 private _battleIdCounter;

    // Mappings
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => uint256) public tokenBattleId; // tokenId => battleId
    mapping(address => uint256) public winStreak;
    mapping(address => uint256) public totalWins;
    mapping(address => uint256[]) public playerChallenges;
    mapping(address => uint256[]) public playerBattles;

    // Champion NFT tracking (5 wins = can claim)
    mapping(address => bool) public hasClaimedChampion;

    // Victory tiers based on win streak
    uint256 public constant CHAMPION_WINS_REQUIRED = 5;

    // Security limits
    uint256 public constant MAX_ACTIVE_CHALLENGES = 100;
    uint256 public constant CHALLENGE_TIMEOUT = 7 days;

    // Trusted signer for game result verification
    address public trustedSigner;
    mapping(bytes32 => bool) public usedSignatures;

    // Events
    event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed opponent);
    event ChallengeAccepted(uint256 indexed challengeId, address indexed opponent);
    event ChallengeCancelled(uint256 indexed challengeId);
    event BattleFinalized(uint256 indexed battleId, address indexed winner, address indexed loser, uint256 winnerScore, uint256 loserScore);
    event VictoryNFTMinted(uint256 indexed tokenId, uint256 indexed battleId, address indexed winner);
    event ChampionNFTMinted(uint256 indexed tokenId, address indexed champion);
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    constructor(address _trustedSigner) ERC721("Mosquito Versus Victory", "MOSQUITO-VS") Ownable(msg.sender) {
        require(_trustedSigner != address(0), "Invalid signer");
        trustedSigner = _trustedSigner;
    }

    /**
     * @dev Create a challenge to a specific opponent
     * @param opponent Address of player to challenge
     */
    function createChallenge(address opponent) external returns (uint256) {
        require(opponent != address(0), "Invalid opponent address");
        require(opponent != msg.sender, "Cannot challenge yourself");
        require(playerChallenges[msg.sender].length < MAX_ACTIVE_CHALLENGES, "Too many active challenges");

        uint256 challengeId = _challengeIdCounter;
        unchecked {
            _challengeIdCounter++;
        }

        challenges[challengeId] = Challenge({
            challenger: msg.sender,
            opponent: opponent,
            status: ChallengeStatus.Pending,
            createdAt: block.timestamp,
            battleId: 0
        });

        playerChallenges[msg.sender].push(challengeId);
        playerChallenges[opponent].push(challengeId);

        emit ChallengeCreated(challengeId, msg.sender, opponent);
        return challengeId;
    }

    /**
     * @dev Accept a pending challenge
     * @param challengeId ID of the challenge to accept
     */
    function acceptChallenge(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.Pending, "Challenge not pending");
        require(challenge.opponent == msg.sender, "Not the challenged player");

        challenge.status = ChallengeStatus.Accepted;
        
        emit ChallengeAccepted(challengeId, msg.sender);
    }

    /**
     * @dev Cancel a pending challenge (only challenger can cancel)
     * @param challengeId ID of the challenge to cancel
     */
    function cancelChallenge(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.Pending, "Challenge not pending");
        require(challenge.challenger == msg.sender, "Only challenger can cancel");

        challenge.status = ChallengeStatus.Cancelled;
        
        emit ChallengeCancelled(challengeId);
    }

    /**
     * @dev Finalize a battle and record the winner
     * Requires signature from trusted signer to verify game result
     * @param challengeId The challenge ID
     * @param winnerScore Score of the winner
     * @param loserScore Score of the loser
     * @param winnerIsChallenger True if challenger won, false if opponent won
     * @param signature Backend signature verifying the result
     */
    function finalizeBattle(
        uint256 challengeId,
        uint256 winnerScore,
        uint256 loserScore,
        bool winnerIsChallenger,
        bytes calldata signature
    ) external returns (uint256) {
        require(challengeId < _challengeIdCounter, "Invalid challenge ID");
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.Accepted, "Challenge not accepted");
        require(
            msg.sender == challenge.challenger || msg.sender == challenge.opponent,
            "Not a participant"
        );
        require(winnerScore > loserScore, "Winner must have higher score");

        // Verify signature from trusted signer
        bytes32 messageHash = keccak256(abi.encodePacked(
            challengeId, winnerScore, loserScore, winnerIsChallenger
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        require(!usedSignatures[ethSignedHash], "Signature already used");
        require(ethSignedHash.recover(signature) == trustedSigner, "Invalid signature");
        
        usedSignatures[ethSignedHash] = true;

        address winner = winnerIsChallenger ? challenge.challenger : challenge.opponent;
        address loser = winnerIsChallenger ? challenge.opponent : challenge.challenger;

        uint256 battleId = _battleIdCounter;
        unchecked {
            _battleIdCounter++;
        }

        battles[battleId] = Battle({
            winner: winner,
            loser: loser,
            winnerScore: winnerScore,
            loserScore: loserScore,
            timestamp: block.timestamp,
            nftMinted: false
        });

        // Update challenge
        challenge.status = ChallengeStatus.Completed;
        challenge.battleId = battleId;

        // Update player stats
        totalWins[winner]++;
        winStreak[winner]++;
        winStreak[loser] = 0; // Reset loser's streak

        playerBattles[winner].push(battleId);
        playerBattles[loser].push(battleId);

        emit BattleFinalized(battleId, winner, loser, winnerScore, loserScore);
        return battleId;
    }

    /**
     * @dev Mint victory NFT (only winner can mint)
     * @param battleId ID of the battle
     */
    function mintVictoryNFT(uint256 battleId) external nonReentrant returns (uint256) {
        require(battleId < _battleIdCounter, "Invalid battle ID");
        Battle storage battle = battles[battleId];
        
        require(battle.winner == msg.sender, "Only winner can mint");
        require(!battle.nftMinted, "NFT already minted for this battle");

        battle.nftMinted = true;

        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter++;
        }

        _safeMint(msg.sender, tokenId);
        tokenBattleId[tokenId] = battleId;

        emit VictoryNFTMinted(tokenId, battleId, msg.sender);
        return tokenId;
    }

    /**
     * @dev Claim Champion NFT (requires 5+ total wins)
     */
    function claimChampionNFT() external nonReentrant returns (uint256) {
        require(totalWins[msg.sender] >= CHAMPION_WINS_REQUIRED, "Need 5+ wins");
        require(!hasClaimedChampion[msg.sender], "Already claimed Champion NFT");

        hasClaimedChampion[msg.sender] = true;

        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter++;
        }

        _safeMint(msg.sender, tokenId);
        // Battle ID 0 indicates Champion NFT (special case)
        tokenBattleId[tokenId] = type(uint256).max;

        emit ChampionNFTMinted(tokenId, msg.sender);
        return tokenId;
    }

    /**
     * @dev Check if token is a Champion NFT
     */
    function isChampionNFT(uint256 tokenId) public view returns (bool) {
        return tokenBattleId[tokenId] == type(uint256).max;
    }

    /**
     * @dev Get victory title based on win streak
     */
    function getVictoryTitle(uint256 streak) public pure returns (string memory) {
        if (streak >= 10) return "Unstoppable";
        if (streak >= 7) return "Dominator";
        if (streak >= 5) return "Champion";
        if (streak >= 3) return "Warrior";
        return "Victor";
    }

    /**
     * @dev Get victory color based on win streak
     */
    function getVictoryColor(uint256 streak) public pure returns (string memory) {
        if (streak >= 10) return "#ff0000"; // Red
        if (streak >= 7) return "#ff6b9d";  // Pink
        if (streak >= 5) return "#a855f7";  // Purple
        if (streak >= 3) return "#3b82f6";  // Blue
        return "#22c55e"; // Green
    }

    /**
     * @dev Generate SVG for victory NFT
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        bool isChampion = isChampionNFT(tokenId);
        
        if (isChampion) {
            return _generateChampionSVG(tokenId);
        }

        uint256 battleId = tokenBattleId[tokenId];
        Battle memory battle = battles[battleId];
        
        uint256 streak = winStreak[battle.winner];
        string memory title = getVictoryTitle(streak);
        string memory color = getVictoryColor(streak);
        
        // Format opponent address
        string memory opponent = _formatAddress(battle.loser);

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs>',
            '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#0a0a0f"/>',
            '<stop offset="100%" style="stop-color:#1a1a2e"/>',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="400" fill="url(#bg)"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="', color, '" stroke-width="4" rx="20"/>',
            '<text x="200" y="70" text-anchor="middle" font-family="monospace" font-size="40">',
            unicode'🏆',
            '</text>',
            '<text x="200" y="110" text-anchor="middle" font-family="monospace" font-size="14" fill="', color, '">',
            'VICTORY',
            '</text>',
            '<text x="200" y="150" text-anchor="middle" font-family="monospace" font-size="20" fill="', color, '">',
            title,
            '</text>',
            '<text x="200" y="200" text-anchor="middle" font-family="monospace" font-size="36" fill="#00ff88">',
            battle.winnerScore.toString(),
            '</text>',
            '<text x="200" y="230" text-anchor="middle" font-family="monospace" font-size="14" fill="#666">',
            'vs ', battle.loserScore.toString(),
            '</text>',
            '<text x="200" y="290" text-anchor="middle" font-family="monospace" font-size="10" fill="#888">',
            'Defeated: ', opponent,
            '</text>',
            '<text x="200" y="350" text-anchor="middle" font-family="monospace" font-size="12" fill="#8888aa">',
            'Tap That Mosquito VS',
            '</text>',
            '<text x="200" y="375" text-anchor="middle" font-family="monospace" font-size="10" fill="#555">',
            '#', tokenId.toString(),
            '</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Generate Champion SVG
     */
    function _generateChampionSVG(uint256 tokenId) internal view returns (string memory) {
        address owner = _ownerOf(tokenId);
        uint256 wins = totalWins[owner];

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs>',
            '<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#f5af19"/>',
            '<stop offset="100%" style="stop-color:#f12711"/>',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="400" fill="#0a0a0f"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="url(#gold)" stroke-width="6" rx="20"/>',
            '<text x="200" y="100" text-anchor="middle" font-family="monospace" font-size="60">',
            unicode'👑',
            '</text>',
            '<text x="200" y="170" text-anchor="middle" font-family="monospace" font-size="24" fill="#f5af19">',
            'CHAMPION',
            '</text>',
            '<text x="200" y="230" text-anchor="middle" font-family="monospace" font-size="48" fill="#00ff88">',
            wins.toString(),
            '</text>',
            '<text x="200" y="270" text-anchor="middle" font-family="monospace" font-size="14" fill="#888">',
            'Total Victories',
            '</text>',
            '<text x="200" y="350" text-anchor="middle" font-family="monospace" font-size="12" fill="#8888aa">',
            'Tap That Mosquito VS',
            '</text>',
            '<text x="200" y="375" text-anchor="middle" font-family="monospace" font-size="10" fill="#555">',
            '#', tokenId.toString(),
            '</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Format address for display
     */
    function _formatAddress(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(10);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 3; i++) {
            str[2 + i * 2] = alphabet[uint8(uint160(addr) >> (156 - i * 8)) >> 4];
            str[3 + i * 2] = alphabet[uint8(uint160(addr) >> (156 - i * 8)) & 0x0f];
        }
        str[8] = '.';
        str[9] = '.';
        return string(str);
    }

    /**
     * @dev Returns token URI with on-chain metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        bool isChampion = isChampionNFT(tokenId);
        string memory svg = generateSVG(tokenId);
        
        string memory name;
        string memory description;
        string memory attributes;

        if (isChampion) {
            name = string(abi.encodePacked("Champion #", tokenId.toString()));
            description = "Champion NFT from Tap That Mosquito Versus mode. Awarded for 5+ victories!";
            attributes = string(abi.encodePacked(
                '[{"trait_type":"Type","value":"Champion"},',
                '{"trait_type":"Total Wins","value":', totalWins[_ownerOf(tokenId)].toString(), '}]'
            ));
        } else {
            uint256 battleId = tokenBattleId[tokenId];
            Battle memory battle = battles[battleId];
            string memory title = getVictoryTitle(winStreak[battle.winner]);
            
            name = string(abi.encodePacked("Victory #", tokenId.toString()));
            description = string(abi.encodePacked(
                "Victory Trophy from Tap That Mosquito Versus mode. Score: ",
                battle.winnerScore.toString(),
                " vs ",
                battle.loserScore.toString()
            ));
            attributes = string(abi.encodePacked(
                '[{"trait_type":"Type","value":"Victory"},',
                '{"trait_type":"Title","value":"', title, '"},',
                '{"trait_type":"Winner Score","value":', battle.winnerScore.toString(), '},',
                '{"trait_type":"Loser Score","value":', battle.loserScore.toString(), '},',
                '{"trait_type":"Battle ID","value":', battleId.toString(), '}]'
            ));
        }

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"', name, '",',
            '"description":"', description, '",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":', attributes, '}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ============ View Functions ============

    /**
     * @dev Get player's pending challenges
     */
    function getPendingChallenges(address player) external view returns (uint256[] memory) {
        uint256[] memory allChallenges = playerChallenges[player];
        uint256 pendingCount = 0;
        uint256 len = allChallenges.length;

        // Count pending
        for (uint256 i = 0; i < len;) {
            if (challenges[allChallenges[i]].status == ChallengeStatus.Pending) {
                unchecked {
                    pendingCount++;
                }
            }
            unchecked {
                ++i;
            }
        }

        // Build result array
        uint256[] memory pending = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < len;) {
            if (challenges[allChallenges[i]].status == ChallengeStatus.Pending) {
                pending[index] = allChallenges[i];
                unchecked {
                    index++;
                }
            }
            unchecked {
                ++i;
            }
        }

        return pending;
    }

    /**
     * @dev Get player stats
     */
    function getPlayerStats(address player) external view returns (
        uint256 wins,
        uint256 streak,
        uint256 battleCount,
        bool canClaimChampion
    ) {
        wins = totalWins[player];
        streak = winStreak[player];
        battleCount = playerBattles[player].length;
        canClaimChampion = wins >= CHAMPION_WINS_REQUIRED && !hasClaimedChampion[player];
    }

    /**
     * @dev Total supply
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Total challenges created
     */
    function totalChallenges() external view returns (uint256) {
        return _challengeIdCounter;
    }

    /**
     * @dev Total battles completed
     */
    function totalBattles() external view returns (uint256) {
        return _battleIdCounter;
    }

    // ============ Admin Functions ============

    /**
     * @dev Update the trusted signer address
     * @param _newSigner New signer address
     */
    function setTrustedSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        address oldSigner = trustedSigner;
        trustedSigner = _newSigner;
        emit TrustedSignerUpdated(oldSigner, _newSigner);
    }
}
