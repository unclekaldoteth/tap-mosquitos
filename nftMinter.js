/* ============================================
   NFT MINTING SERVICE
   Handles contract interaction for minting achievement NFTs
   Updated to use ethers.js for proper ABI encoding
   ============================================ */

import { ethers } from 'ethers';
import { sdk } from '@farcaster/miniapp-sdk';
import { MOSQUITO_NFT_ABI, CONTRACT_ADDRESSES, TIER_INFO, Tier, getTierFromScore } from './contract.js';
import { getBaseAccountProvider } from './baseAccount.js';

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
        this.chainId = null;
        this.account = null;
        this.isInitialized = false;
    }

    async isMiniApp() {
        try {
            return await withTimeout(
                sdk.isInMiniApp(),
                2000,
                'Miniapp check timed out'
            );
        } catch {
            return false;
        }
    }

    async getContextAddress() {
        try {
            const context = await withTimeout(sdk.context, 4000, 'Context lookup timed out');
            return context?.user?.wallet?.address || context?.user?.connectedAddress || null;
        } catch {
            return null;
        }
    }

    async getRawProvider() {
        if (this.rawProvider) return this.rawProvider;

        let rawProvider = null;
        if (typeof window !== 'undefined' && window.__walletProvider) {
            rawProvider = window.__walletProvider;
        }

        if (!rawProvider) {
            try {
                rawProvider = await withTimeout(
                    sdk.wallet.getEthereumProvider(),
                    4000,
                    'Provider lookup timed out'
                );
            } catch (sdkError) {
                console.log('SDK provider not available:', sdkError.message);
            }
        }

        if (!rawProvider && sdk.wallet?.ethProvider) {
            rawProvider = sdk.wallet.ethProvider;
        }

        if (!rawProvider && typeof window !== 'undefined' && window.ethereum) {
            rawProvider = window.ethereum;
            console.log('Using window.ethereum as provider');
        }

        if (!rawProvider) {
            rawProvider = await getBaseAccountProvider();
            if (rawProvider) {
                console.log('Using Base Account provider');
            }
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
            this.chainId = chainId;

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
        let rawProvider = this.rawProvider;
        if (!rawProvider) {
            try {
                rawProvider = await withTimeout(
                    sdk.wallet.getEthereumProvider(),
                    4000,
                    'Provider lookup timed out'
                );
            } catch (sdkError) {
                console.log('SDK provider not available:', sdkError.message);
            }
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

        const isMiniApp = await this.isMiniApp();
        const contextAddress = isMiniApp ? await this.getContextAddress() : null;
        let account = null;
        let requestError = null;

        try {
            const accounts = await withTimeout(
                rawProvider.request({ method: 'eth_requestAccounts' }),
                12000,
                'Wallet connection timed out'
            );
            account = accounts?.[0] || null;
        } catch (error) {
            requestError = error;
            console.log('eth_requestAccounts failed:', error?.message || error);
        }

        if (!account) {
            try {
                const accounts = await withTimeout(
                    rawProvider.request({ method: 'eth_accounts' }),
                    4000,
                    'Wallet lookup timed out'
                );
                account = accounts?.[0] || null;
            } catch (error) {
                console.log('eth_accounts not available:', error?.message || error);
            }
        }

        if (!account && contextAddress) {
            account = contextAddress;
        }

        if (contextAddress && account && contextAddress.toLowerCase() !== account.toLowerCase()) {
            console.log('Using miniapp wallet address for transactions');
            account = contextAddress;
        }

        if (!account) {
            if (requestError) {
                throw requestError;
            }
            throw new Error('No wallet connected');
        }

        if (!this.provider || rawProvider !== this.rawProvider) {
            this.provider = new ethers.BrowserProvider(rawProvider);
        }
        this.signer = await this.provider.getSigner();
        this.rawProvider = rawProvider;

        try {
            const chainHex = await rawProvider.request({ method: 'eth_chainId' });
            if (chainHex) {
                this.chainId = Number.parseInt(chainHex, 16);
            }
        } catch (error) {
            console.log('Failed to read chainId:', error?.message || error);
        }
        if (!this.chainId) {
            try {
                const network = await withTimeout(
                    this.provider.getNetwork(),
                    4000,
                    'Network lookup timed out'
                );
                this.chainId = Number(network.chainId);
            } catch (error) {
                console.log('Failed to read network chainId:', error?.message || error);
            }
        }

        if (this.contractAddress && this.contract) {
            this.contract = this.contract.connect(this.signer);
        } else if (this.contractAddress) {
            this.contract = new ethers.Contract(
                this.contractAddress,
                MOSQUITO_NFT_ABI,
                this.signer
            );
        }

        this.account = account;
        return account;
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
        let account = this.account || await this.getAccount();
        if (!account) {
            account = await this.requestAccount();
        }
        if (!account) {
            throw new Error('No wallet connected');
        }

        // Generate nonce and get signature from backend
        const nonce = Date.now();
        const signature = await this.fetchSignature(account, tier, score, nonce);
        const calldata = this.getMintCalldata(tier, score, nonce, signature);

        // Try sponsored transaction first (gas-free for user)
        const paymasterUrl = import.meta.env.VITE_PAYMASTER_URL;
        const isMiniApp = await this.isMiniApp();
        const requireSponsored = Boolean(paymasterUrl && isMiniApp);

        if (paymasterUrl) {
            try {
                const receipt = await this.sendCallsTransaction(calldata, paymasterUrl);
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
                if (requireSponsored) {
                    throw (sponsoredError instanceof Error)
                        ? sponsoredError
                        : new Error(String(sponsoredError));
                }
                console.log('Sponsored transaction failed, falling back to regular:', sponsoredError.message);
            }
        }

        // Fallback: wallet_sendCalls without paymaster
        try {
            const receipt = await this.sendCallsTransaction(calldata, null);
            if (receipt?.pending) {
                return {
                    hash: receipt.hash || null,
                    tier: tier,
                    tierInfo: TIER_INFO[tier],
                    sponsored: false,
                    pending: true
                };
            }
            return {
                hash: receipt.transactionHash || receipt.hash,
                tier: tier,
                tierInfo: TIER_INFO[tier],
                sponsored: false
            };
        } catch (sendCallsError) {
            console.log('wallet_sendCalls failed, falling back to eth_sendTransaction:', sendCallsError.message);
        }

        // Fallback: Regular transaction (user pays gas)
        const txHash = await this.sendLegacyTransaction(calldata, account);
        const receipt = await this.waitForReceipt(txHash, 20000);
        if (!receipt) {
            return {
                hash: txHash,
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
     * Build calldata for mintAchievement
     */
    getMintCalldata(tier, score, nonce, signature) {
        const iface = new ethers.Interface(MOSQUITO_NFT_ABI);
        return iface.encodeFunctionData('mintAchievement', [tier, score, nonce, signature]);
    }

    /**
     * Send transaction using wallet_sendCalls
     */
    async sendCallsTransaction(calldata, paymasterUrl = null) {
        const rawProvider = await this.getRawProvider();

        if (!rawProvider?.request) {
            throw new Error('No Ethereum provider available');
        }

        try {
            const capabilities = await withTimeout(
                rawProvider.request({
                    method: 'wallet_getCapabilities',
                    params: []
                }),
                2000,
                'Capabilities lookup timed out'
            );
            console.log('Wallet capabilities:', capabilities);
        } catch (e) {
            console.log('wallet_getCapabilities not supported, trying sendCalls anyway');
        }

        if (!this.chainId && this.provider) {
            try {
                const network = await withTimeout(
                    this.provider.getNetwork(),
                    4000,
                    'Network lookup timed out'
                );
                this.chainId = Number(network.chainId);
            } catch (error) {
                console.log('Failed to read network chainId:', error?.message || error);
            }
        }

        const chainId = this.chainId ? ethers.toBeHex(this.chainId) : undefined;
        const from = this.account || await this.signer.getAddress();
        const params = {
            version: '1.0',
            from,
            calls: [{
                to: this.contractAddress,
                data: calldata,
                value: '0x0'
            }]
        };

        if (chainId) {
            params.chainId = chainId;
        }

        if (paymasterUrl) {
            params.capabilities = {
                paymasterService: {
                    url: paymasterUrl
                }
            };
        }

        const result = await withTimeout(
            rawProvider.request({
                method: 'wallet_sendCalls',
                params: [params]
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

    async sendLegacyTransaction(calldata, from) {
        const rawProvider = await this.getRawProvider();
        if (!rawProvider?.request) {
            throw new Error('No Ethereum provider available');
        }

        const txHash = await withTimeout(
            rawProvider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from,
                    to: this.contractAddress,
                    data: calldata,
                    value: '0x0'
                }]
            }),
            15000,
            'Wallet request timed out'
        );

        if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
            throw new Error('Transaction rejected by wallet');
        }

        return txHash;
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
            const claimable = await withTimeout(
                this.contract.getClaimableTiers(address, score),
                6000,
                'Claimable tier lookup timed out'
            );
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
