/* ============================================
   NFT MINTING SERVICE
   Handles contract interaction for minting achievement NFTs
   Updated to use ethers.js for proper ABI encoding
   ============================================ */

import { ethers } from 'ethers';
import { sdk } from '@farcaster/miniapp-sdk';
import { MOSQUITO_NFT_ABI, CONTRACT_ADDRESSES, TIER_INFO, Tier, getTierFromScore } from './contract.js';

class NFTMinter {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            let rawProvider = null;

            // Try SDK provider first (Mini App context)
            try {
                rawProvider = await sdk.wallet.getEthereumProvider();
            } catch (sdkError) {
                console.log('SDK provider not available:', sdkError.message);
            }

            // Fallback to window.ethereum (MetaMask/browser)
            if (!rawProvider && typeof window !== 'undefined' && window.ethereum) {
                rawProvider = window.ethereum;
                console.log('Using window.ethereum as provider');
            }

            if (!rawProvider) {
                console.log('No Ethereum provider available');
                return false;
            }

            // Wrap with ethers.js
            this.provider = new ethers.BrowserProvider(rawProvider);
            this.signer = await this.provider.getSigner();

            // Check network and set contract address
            const network = await this.provider.getNetwork();
            const chainId = Number(network.chainId);

            if (chainId === 8453) {
                // Base Mainnet
                this.contractAddress = CONTRACT_ADDRESSES.mainnet;
            } else if (chainId === 84532) {
                // Base Sepolia
                this.contractAddress = CONTRACT_ADDRESSES.sepolia;
            } else {
                console.log('Unsupported network:', chainId);
                return false;
            }

            if (!this.contractAddress || this.contractAddress === "" || this.contractAddress === "0x0000000000000000000000000000000000000000") {
                console.log('Contract not deployed on this network');
                return false;
            }

            // Create contract instance
            this.contract = new ethers.Contract(
                this.contractAddress,
                MOSQUITO_NFT_ABI,
                this.signer
            );

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize NFT minter:', error);
            return false;
        }
    }

    async getAccount() {
        if (!this.signer) return null;
        try {
            return await this.signer.getAddress();
        } catch {
            return null;
        }
    }

    async requestAccount() {
        if (!this.provider) return null;
        try {
            await this.provider.send('eth_requestAccounts', []);
            this.signer = await this.provider.getSigner();
            return await this.signer.getAddress();
        } catch {
            return null;
        }
    }

    /**
     * Fetch signature from backend for achievement minting
     * @param {string} playerAddress - Player's wallet address
     * @param {number} tier - Tier enum value (0-4)
     * @param {number} score - Score achieved
     * @param {number} nonce - Unique nonce
     * @returns {Promise<string>} Signature from backend
     */
    async fetchSignature(playerAddress, tier, score, nonce) {
        try {
            const response = await fetch('/api/sign-achievement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerAddress, tier, score, nonce })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Backend signing failed');
            }

            const data = await response.json();
            return data.signature;
        } catch (error) {
            console.error('Failed to get signature from backend:', error);
            throw new Error('Score verification not available. Please try again later.');
        }
    }

    /**
     * Mint achievement NFT (requires backend signature)
     * @param {number} tier - Tier enum value (0-4)
     * @param {number} score - Score achieved
     */
    async mintAchievement(tier, score) {
        if (!this.isInitialized) {
            const initialized = await this.init();
            if (!initialized) {
                throw new Error('NFT minting not available on this network');
            }
        }

        // Get account
        let account = await this.getAccount();
        if (!account) {
            account = await this.requestAccount();
        }
        if (!account) {
            throw new Error('No wallet connected');
        }

        // Generate nonce and get signature from backend
        const nonce = Date.now();
        const signature = await this.fetchSignature(account, tier, score, nonce);

        // Call contract using ethers.js
        const tx = await this.contract.mintAchievement(tier, score, nonce, signature);
        const receipt = await tx.wait();

        return {
            hash: receipt.hash,
            tier: tier,
            tierInfo: TIER_INFO[tier],
        };
    }

    /**
     * Check if player can claim a tier
     * @param {string} address - Player address
     * @param {number} tier - Tier to check
     */
    async canClaimTier(address, tier) {
        if (!this.isInitialized || !this.contract) return true;

        try {
            const claimed = await this.contract.hasClaimed(address, tier);
            return !claimed;
        } catch (error) {
            console.error('Error checking claim status:', error);
            return true; // Assume can claim if error
        }
    }

    /**
     * Get best achievable tier for a score
     */
    getBestTierForScore(score) {
        return getTierFromScore(score);
    }

    /**
     * Get tier info
     */
    getTierInfo(tier) {
        return TIER_INFO[tier];
    }

    /**
     * Check if minting is available
     */
    isAvailable() {
        return this.isInitialized && this.contractAddress;
    }
}

export const nftMinter = new NFTMinter();
