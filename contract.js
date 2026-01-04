/* ============================================
   MOSQUITO SLAYER NFT - CONTRACT INTEGRATION
   ============================================ */

// Contract ABI (only the functions we need)
export const MOSQUITO_NFT_ABI = [
    // Read functions
    {
        inputs: [{ name: "player", type: "address" }, { name: "tier", type: "uint8" }],
        name: "hasClaimed",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }, { name: "score", type: "uint256" }],
        name: "getClaimableTiers",
        outputs: [{ name: "", type: "bool[5]" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "score", type: "uint256" }],
        name: "getTierFromScore",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "pure",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }],
        name: "getPlayerAchievements",
        outputs: [{ name: "", type: "uint256[]" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    // Write functions
    {
        inputs: [{ name: "tier", type: "uint8" }, { name: "score", type: "uint256" }],
        name: "mintAchievement",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "player", type: "address" },
            { indexed: true, name: "tokenId", type: "uint256" },
            { indexed: false, name: "tier", type: "uint8" },
            { indexed: false, name: "score", type: "uint256" }
        ],
        name: "AchievementMinted",
        type: "event"
    }
];

// Tier enum matching contract
export const Tier = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4
};

// Tier info
export const TIER_INFO = {
    [Tier.Common]: {
        name: "Beginner",
        minScore: 0,
        icon: "🥉",
        color: "#6b7280"
    },
    [Tier.Uncommon]: {
        name: "Pest Control",
        minScore: 200,
        icon: "🎖️",
        color: "#22c55e"
    },
    [Tier.Rare]: {
        name: "Swatter Pro",
        minScore: 500,
        icon: "⭐",
        color: "#3b82f6"
    },
    [Tier.Epic]: {
        name: "Bug Hunter",
        minScore: 1000,
        icon: "💎",
        color: "#a855f7"
    },
    [Tier.Legendary]: {
        name: "Mosquito Slayer",
        minScore: 2000,
        icon: "🏆",
        color: "#ff6b9d"
    }
};

// Contract addresses (deployed)
export const CONTRACT_ADDRESSES = {
    // Base Mainnet
    mainnet: "",
    // Base Sepolia (testnet)
    sepolia: "0x0cb3B5B40491F9c1b5f62Eb1094eF4BAE518a464"
};

// Get tier from score (client-side mirror of contract logic)
export function getTierFromScore(score) {
    if (score >= 2000) return Tier.Legendary;
    if (score >= 1000) return Tier.Epic;
    if (score >= 500) return Tier.Rare;
    if (score >= 200) return Tier.Uncommon;
    return Tier.Common;
}

// Get all claimable tiers for a score
export function getClaimableTiersForScore(score) {
    const tiers = [];
    if (score >= 0) tiers.push(Tier.Common);
    if (score >= 200) tiers.push(Tier.Uncommon);
    if (score >= 500) tiers.push(Tier.Rare);
    if (score >= 1000) tiers.push(Tier.Epic);
    if (score >= 2000) tiers.push(Tier.Legendary);
    return tiers;
}
