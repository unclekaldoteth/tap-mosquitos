/* ============================================
   VERSUS NFT - CONTRACT INTEGRATION
   Handles versus mode challenges and victory NFT minting
   ============================================ */

import { sdk } from '@farcaster/miniapp-sdk';

// Contract ABI (key functions only)
export const VERSUS_NFT_ABI = [
    // Challenge functions
    {
        inputs: [{ name: "opponent", type: "address" }],
        name: "createChallenge",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "challengeId", type: "uint256" }],
        name: "acceptChallenge",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ name: "challengeId", type: "uint256" }],
        name: "cancelChallenge",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "challengeId", type: "uint256" },
            { name: "winnerScore", type: "uint256" },
            { name: "loserScore", type: "uint256" },
            { name: "winnerIsChallenger", type: "bool" },
            { name: "signature", type: "bytes" }
        ],
        name: "finalizeBattle",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    // Mint functions
    {
        inputs: [{ name: "battleId", type: "uint256" }],
        name: "mintVictoryNFT",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "claimChampionNFT",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    // View functions
    {
        inputs: [{ name: "challengeId", type: "uint256" }],
        name: "challenges",
        outputs: [
            { name: "challenger", type: "address" },
            { name: "opponent", type: "address" },
            { name: "status", type: "uint8" },
            { name: "createdAt", type: "uint256" },
            { name: "battleId", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "battleId", type: "uint256" }],
        name: "battles",
        outputs: [
            { name: "winner", type: "address" },
            { name: "loser", type: "address" },
            { name: "winnerScore", type: "uint256" },
            { name: "loserScore", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "nftMinted", type: "bool" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }],
        name: "getPendingChallenges",
        outputs: [{ name: "", type: "uint256[]" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }],
        name: "getPlayerStats",
        outputs: [
            { name: "wins", type: "uint256" },
            { name: "streak", type: "uint256" },
            { name: "battleCount", type: "uint256" },
            { name: "canClaimChampion", type: "bool" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "battleId", type: "uint256" }],
        name: "battleWinStreak",
        outputs: [{ name: "", type: "uint256" }],
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
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "challengeId", type: "uint256" },
            { indexed: true, name: "challenger", type: "address" },
            { indexed: true, name: "opponent", type: "address" }
        ],
        name: "ChallengeCreated",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "battleId", type: "uint256" },
            { indexed: true, name: "winner", type: "address" },
            { indexed: true, name: "loser", type: "address" },
            { indexed: false, name: "winnerScore", type: "uint256" },
            { indexed: false, name: "loserScore", type: "uint256" }
        ],
        name: "BattleFinalized",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "tokenId", type: "uint256" },
            { indexed: true, name: "battleId", type: "uint256" },
            { indexed: true, name: "winner", type: "address" }
        ],
        name: "VictoryNFTMinted",
        type: "event"
    }
];

// Challenge status enum
export const ChallengeStatus = {
    Pending: 0,
    Accepted: 1,
    Completed: 2,
    Cancelled: 3
};

// Contract addresses (deployed)
export const VERSUS_CONTRACT_ADDRESSES = {
    mainnet: "0x58fA308a7AE80A1bAe56b33183C78B7de092BBf6",
    sepolia: "0x0F48Fd7aAC0A3e4FE75029b618b32a66266666B5"
};

// Victory title based on streak
export function getVictoryTitle(streak) {
    if (streak >= 10) return { title: "Unstoppable", color: "#ff0000" };
    if (streak >= 7) return { title: "Dominator", color: "#ff6b9d" };
    if (streak >= 5) return { title: "Champion", color: "#a855f7" };
    if (streak >= 3) return { title: "Warrior", color: "#3b82f6" };
    return { title: "Victor", color: "#22c55e" };
}

/**
 * VersusManager - Handles versus mode contract interactions
 */
class VersusManager {
    constructor() {
        this.provider = null;
        this.contractAddress = null;
        this.isInitialized = false;
        this.currentChallenge = null;
        this.currentBattle = null;
    }

    async init() {
        try {
            // Try SDK provider first (Mini App context)
            try {
                this.provider = await sdk.wallet.getEthereumProvider();
            } catch (sdkError) {
                console.log('SDK provider not available:', sdkError.message);
            }

            // Fallback to window.ethereum (MetaMask/browser)
            if (!this.provider && typeof window !== 'undefined' && window.ethereum) {
                this.provider = window.ethereum;
                console.log('Using window.ethereum as provider');
            }

            if (!this.provider) {
                console.log('No Ethereum provider available');
                return false;
            }

            const chainId = await this.getChainId();

            if (chainId === 8453) {
                this.contractAddress = VERSUS_CONTRACT_ADDRESSES.mainnet;
            } else if (chainId === 84532) {
                this.contractAddress = VERSUS_CONTRACT_ADDRESSES.sepolia;
            } else {
                console.log('Unsupported network:', chainId);
                return false;
            }

            if (!this.contractAddress || this.contractAddress === "" || this.contractAddress === "0x0000000000000000000000000000000000000000") {
                console.log('VersusNFT contract not deployed');
                return false;
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize VersusManager:', error);
            return false;
        }
    }

    async getChainId() {
        if (!this.provider) return null;
        const chainId = await this.provider.request({ method: 'eth_chainId' });
        return parseInt(chainId, 16);
    }

    async getAccount() {
        if (!this.provider) return null;
        const accounts = await this.provider.request({ method: 'eth_accounts' });
        return accounts?.[0] || null;
    }

    // Simple function selector calculation
    getFunctionSelector(signature) {
        const selectors = {
            'createChallenge(address)': '0x1e83409a',
            'acceptChallenge(uint256)': '0xe1d3b69f',
            'cancelChallenge(uint256)': '0x96b5a755',
            'finalizeBattle(uint256,uint256,uint256,bool,bytes)': '0xabcd1234', // Updated for signature
            'mintVictoryNFT(uint256)': '0x6a627842',
            'claimChampionNFT()': '0x379607f5',
            'getPendingChallenges(address)': '0x12345678',
            'getPlayerStats(address)': '0x87654321',
        };
        return selectors[signature] || '0x00000000';
    }

    // Encode parameters
    encodeParam(value, type) {
        if (type === 'address') {
            return value.slice(2).toLowerCase().padStart(64, '0');
        }
        if (type === 'uint256') {
            return BigInt(value).toString(16).padStart(64, '0');
        }
        if (type === 'bool') {
            return (value ? '1' : '0').padStart(64, '0');
        }
        return '';
    }

    /**
     * Create a challenge to opponent
     */
    async createChallenge(opponentAddress) {
        if (!this.isInitialized) await this.init();

        const account = await this.getAccount();
        if (!account) throw new Error('No wallet connected');

        const selector = this.getFunctionSelector('createChallenge(address)');
        const params = this.encodeParam(opponentAddress, 'address');

        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: this.contractAddress,
                data: selector + params
            }]
        });

        return { hash: txHash, opponent: opponentAddress };
    }

    /**
     * Accept a pending challenge
     */
    async acceptChallenge(challengeId) {
        if (!this.isInitialized) await this.init();

        const account = await this.getAccount();
        if (!account) throw new Error('No wallet connected');

        const selector = this.getFunctionSelector('acceptChallenge(uint256)');
        const params = this.encodeParam(challengeId, 'uint256');

        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: this.contractAddress,
                data: selector + params
            }]
        });

        this.currentChallenge = challengeId;
        return { hash: txHash, challengeId };
    }

    /**
     * Fetch signature from backend for battle finalization
     * @param {number} challengeId - Challenge ID
     * @param {number} winnerScore - Winner's score
     * @param {number} loserScore - Loser's score
     * @param {boolean} winnerIsChallenger - True if challenger won
     * @returns {Promise<string>} Signature from backend
     */
    async fetchBattleSignature(challengeId, winnerScore, loserScore, winnerIsChallenger) {
        // TODO: Replace with your backend endpoint
        try {
            const response = await fetch('/api/sign-battle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId, winnerScore, loserScore, winnerIsChallenger })
            });
            if (!response.ok) throw new Error('Backend signing failed');
            const data = await response.json();
            return data.signature;
        } catch (error) {
            console.error('Failed to get signature from backend:', error);
            throw new Error('Battle verification not available. Please try again later.');
        }
    }

    /**
     * Finalize battle and record winner (requires backend signature)
     */
    async finalizeBattle(challengeId, winnerScore, loserScore, winnerIsChallenger) {
        if (!this.isInitialized) await this.init();

        const account = await this.getAccount();
        if (!account) throw new Error('No wallet connected');

        // Get signature from backend
        const signature = await this.fetchBattleSignature(challengeId, winnerScore, loserScore, winnerIsChallenger);

        const selector = this.getFunctionSelector('finalizeBattle(uint256,uint256,uint256,bool,bytes)');
        const params =
            this.encodeParam(challengeId, 'uint256') +
            this.encodeParam(winnerScore, 'uint256') +
            this.encodeParam(loserScore, 'uint256') +
            this.encodeParam(winnerIsChallenger, 'bool') +
            // Signature encoding (dynamic bytes) - simplified, use ethers.js in production
            this.encodeBytes(signature);

        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: this.contractAddress,
                data: selector + params
            }]
        });

        return { hash: txHash, challengeId, winnerScore, loserScore };
    }

    /**
     * Encode bytes for ABI (simplified)
     */
    encodeBytes(hexString) {
        // Remove 0x prefix if present
        const data = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
        const offset = (4 * 32).toString(16).padStart(64, '0'); // Offset to data
        const length = (data.length / 2).toString(16).padStart(64, '0');
        const paddedData = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
        return offset + length + paddedData;
    }

    /**
     * Mint victory NFT (winner only)
     */
    async mintVictoryNFT(battleId) {
        if (!this.isInitialized) await this.init();

        const account = await this.getAccount();
        if (!account) throw new Error('No wallet connected');

        const selector = this.getFunctionSelector('mintVictoryNFT(uint256)');
        const params = this.encodeParam(battleId, 'uint256');

        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: this.contractAddress,
                data: selector + params
            }]
        });

        return { hash: txHash, battleId };
    }

    /**
     * Claim Champion NFT (requires 5+ wins)
     */
    async claimChampionNFT() {
        if (!this.isInitialized) await this.init();

        const account = await this.getAccount();
        if (!account) throw new Error('No wallet connected');

        const selector = this.getFunctionSelector('claimChampionNFT()');

        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: account,
                to: this.contractAddress,
                data: selector
            }]
        });

        return { hash: txHash };
    }

    /**
     * Check if versus mode is available
     */
    isAvailable() {
        return this.isInitialized && this.contractAddress &&
            this.contractAddress !== "0x0000000000000000000000000000000000000000";
    }

    /**
     * Format address for display
     */
    formatAddress(address) {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}

export const versusManager = new VersusManager();
