/* ============================================
   NFT MINTING SERVICE
   Handles contract interaction for minting achievement NFTs
   Updated to use ethers.js for proper ABI encoding
   ============================================ */

import { ethers } from 'ethers';
import { sdk } from '@farcaster/miniapp-sdk';
import { MOSQUITO_NFT_ABI, CONTRACT_ADDRESSES, TIER_INFO, Tier, getTierFromScore } from './contract.js';

const withTimeout = (promise, ms, message) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(message));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
};

class NFTMinter {
    constructor() {
        this.rawProvider = null;
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = null;
        this.isInitialized = false;
    }

    async getRawProvider() {
        if (this.rawProvider) return this.rawProvider;

        let rawProvider = null;
        try {
            rawProvider = await sdk.wallet.getEthereumProvider();
        } catch (sdkError) {
            console.log('SDK provider not available:', sdkError.message);
        }

        if (!rawProvider && sdk.wallet?.ethProvider) {
            rawProvider = sdk.wallet.ethProvider;
        }

        if (!rawProvider && typeof window !== 'undefined' && window.ethereum) {
            rawProvider = window.ethereum;
            console.log('Using window.ethereum as provider');
        }

        this.rawProvider = rawProvider;
        return rawProvider;
    }

    async init() {
        try {
            const rawProvider = await this.getRawProvider();

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

    async ensureWalletAccess() {
        let rawProvider = null;
        try {
            rawProvider = await sdk.wallet.getEthereumProvider();
        } catch (sdkError) {
            console.log('SDK provider not available:', sdkError.message);
        }

        if (!rawProvider && sdk.wallet?.ethProvider) {
            rawProvider = sdk.wallet.ethProvider;
        }

        if (!rawProvider) {
            rawProvider = await this.getRawProvider();
        }

        if (!rawProvider?.request) {
            throw new Error('No Ethereum provider available');
        }

        const accounts = await withTimeout(
            rawProvider.request({ method: 'eth_requestAccounts' }),
            12000,
            'Wallet connection timed out'
        );
        if (!accounts || accounts.length === 0) {
            throw new Error('No wallet connected');
        }

        if (!this.provider || rawProvider !== this.rawProvider) {
            this.provider = new ethers.BrowserProvider(rawProvider);
        }
        this.signer = await this.provider.getSigner();
        this.rawProvider = rawProvider;

        if (this.contractAddress && this.contract) {
            this.contract = this.contract.connect(this.signer);
        } else if (this.contractAddress) {
            this.contract = new ethers.Contract(
                this.contractAddress,
                MOSQUITO_NFT_ABI,
                this.signer
            );
        }

        return accounts[0];
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
        try {
            const account = await this.ensureWalletAccess();
            return account;
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch('/api/sign-achievement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerAddress, tier, score, nonce }),
                signal: controller.signal
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Backend signing failed');
            }

            const data = await response.json();
            return data.signature;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Signature request timed out. Please try again.');
            }
            console.error('Failed to get signature from backend:', error);
            throw new Error('Score verification not available. Please try again later.');
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Mint achievement NFT (requires backend signature)
     * Uses sponsored transactions via paymaster if available
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

        // Ensure wallet access for this user action
        await this.ensureWalletAccess();

        // Get account (fallback if needed)
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

        // Try sponsored transaction first (gas-free for user)
        const paymasterUrl = import.meta.env.VITE_PAYMASTER_URL;

        if (paymasterUrl) {
            try {
                const receipt = await this.sendSponsoredTransaction(tier, score, nonce, signature);
                if (receipt?.pending) {
                    return {
                        hash: receipt.hash || null,
                        tier: tier,
                        tierInfo: TIER_INFO[tier],
                        sponsored: true,
                        pending: true
                    };
                }
                return {
                    hash: receipt.transactionHash || receipt.hash,
                    tier: tier,
                    tierInfo: TIER_INFO[tier],
                    sponsored: true
                };
            } catch (sponsoredError) {
                console.log('Sponsored transaction failed, falling back to regular:', sponsoredError.message);
            }
        }

        // Fallback: Regular transaction (user pays gas)
        const tx = await this.contract.mintAchievement(tier, score, nonce, signature);
        const receipt = await this.waitForReceipt(tx.hash, 20000);
        if (!receipt) {
            return {
                hash: tx.hash,
                tier: tier,
                tierInfo: TIER_INFO[tier],
                sponsored: false,
                pending: true
            };
        }

        return {
            hash: receipt.hash,
            tier: tier,
            tierInfo: TIER_INFO[tier],
            sponsored: false
        };
    }

    /**
     * Send sponsored transaction using wallet_sendCalls with paymaster
     * @param {number} tier - Tier enum value
     * @param {number} score - Score achieved
     * @param {number} nonce - Unique nonce
     * @param {string} signature - Backend signature
     */
    async sendSponsoredTransaction(tier, score, nonce, signature) {
        const paymasterUrl = import.meta.env.VITE_PAYMASTER_URL;
        if (!paymasterUrl) {
            throw new Error('Paymaster URL not configured');
        }

        // Encode the function call
        const iface = new ethers.Interface(MOSQUITO_NFT_ABI);
        const calldata = iface.encodeFunctionData('mintAchievement', [tier, score, nonce, signature]);

        const rawProvider = await this.getRawProvider();

        if (!rawProvider) {
            throw new Error('No Ethereum provider available');
        }

        // Check if wallet supports EIP-5792 (wallet_sendCalls)
        try {
            const capabilities = await rawProvider.request({
                method: 'wallet_getCapabilities',
                params: []
            });
            console.log('Wallet capabilities:', capabilities);
        } catch (e) {
            console.log('wallet_getCapabilities not supported, trying sendCalls anyway');
        }

        // Send sponsored transaction
        const network = await this.provider.getNetwork();
        const chainId = ethers.toBeHex(Number(network.chainId));

        const result = await withTimeout(
            rawProvider.request({
                method: 'wallet_sendCalls',
                params: [{
                    version: '1.0',
                    chainId,
                    from: await this.signer.getAddress(),
                    calls: [{
                        to: this.contractAddress,
                        data: calldata,
                        value: '0x0'
                    }],
                    capabilities: {
                        paymasterService: {
                            url: paymasterUrl
                        }
                    }
                }]
            }),
            15000,
            'Wallet request timed out'
        );

        const txHash = typeof result === 'object'
            ? (result?.transactionHash || result?.hash || null)
            : result;

        if (typeof txHash === 'string' && txHash.startsWith('0x')) {
            const receipt = await this.waitForReceipt(txHash, 15000);
            if (receipt) return receipt;
        }

        return { hash: typeof txHash === 'string' ? txHash : null, pending: true };
    }

    async waitForReceipt(txHash, timeoutMs) {
        if (!this.provider || !txHash) return null;

        try {
            return await withTimeout(
                this.provider.waitForTransaction(txHash),
                timeoutMs,
                'Transaction confirmation timed out'
            );
        } catch (error) {
            console.log('Transaction wait timed out:', error.message);
            return null;
        }
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
     * Get claimable tiers for a score (on-chain check)
     * @param {string} address - Player address
     * @param {number} score - Score achieved
     */
    async getClaimableTiers(address, score) {
        if (!address) return null;

        if (!this.isInitialized) {
            const initialized = await this.init();
            if (!initialized) return null;
        }

        if (!this.contract) return null;

        try {
            const claimable = await this.contract.getClaimableTiers(address, score);
            return Array.from(claimable);
        } catch (error) {
            console.error('Error checking claimable tiers:', error);
            return null;
        }
    }

    /**
     * Get highest claimable tier for a score
     * Returns undefined if status can't be checked, null if none claimable.
     */
    async getBestClaimableTier(address, score) {
        const claimable = await this.getClaimableTiers(address, score);
        if (!claimable) return undefined;

        for (let i = claimable.length - 1; i >= 0; i--) {
            if (claimable[i]) {
                return i;
            }
        }

        return null;
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
