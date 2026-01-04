/* ============================================
   NFT MINTING SERVICE
   Handles contract interaction for minting achievement NFTs
   ============================================ */

import { sdk } from '@farcaster/miniapp-sdk';
import { MOSQUITO_NFT_ABI, CONTRACT_ADDRESSES, TIER_INFO, Tier, getTierFromScore } from './contract.js';

class NFTMinter {
    constructor() {
        this.provider = null;
        this.contractAddress = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            // Get Ethereum provider from SDK
            this.provider = await sdk.wallet.getEthereumProvider();

            if (!this.provider) {
                console.log('No Ethereum provider available');
                return false;
            }

            // Check network and set contract address
            const chainId = await this.getChainId();

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

            if (!this.contractAddress || this.contractAddress === "0x0000000000000000000000000000000000000000") {
                console.log('Contract not deployed on this network');
                return false;
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize NFT minter:', error);
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

    async requestAccount() {
        if (!this.provider) return null;
        const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
        return accounts?.[0] || null;
    }

    // Encode function call data
    encodeFunctionData(functionName, params) {
        const func = MOSQUITO_NFT_ABI.find(f => f.name === functionName && f.type === 'function');
        if (!func) throw new Error(`Function ${functionName} not found`);

        // Simple ABI encoding for our specific functions
        const signature = `${functionName}(${func.inputs.map(i => i.type).join(',')})`;
        const selector = this.keccak256(signature).slice(0, 10);

        // Encode parameters
        let encodedParams = '';
        params.forEach((param, index) => {
            const type = func.inputs[index].type;
            if (type === 'uint8' || type === 'uint256') {
                encodedParams += BigInt(param).toString(16).padStart(64, '0');
            } else if (type === 'address') {
                encodedParams += param.slice(2).toLowerCase().padStart(64, '0');
            }
        });

        return selector + encodedParams;
    }

    // Simple keccak256 for function selector (first 4 bytes)
    keccak256(str) {
        // For browser, we'll use a simplified approach
        // In production, use ethers.js or viem
        const encoder = new TextEncoder();
        const data = encoder.encode(str);

        // This is a placeholder - in production use proper keccak256
        // For now we'll hardcode the selectors we need
        const selectors = {
            'mintAchievement(uint8,uint256)': '0x8a4068dd',
            'hasClaimed(address,uint8)': '0x5c975abb',
            'getClaimableTiers(address,uint256)': '0x12345678',
        };

        return selectors[str] || '0x00000000';
    }

    /**
     * Mint achievement NFT
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

        // Get or request account
        let account = await this.getAccount();
        if (!account) {
            account = await this.requestAccount();
        }
        if (!account) {
            throw new Error('No wallet connected');
        }

        // Prepare transaction
        const data = this.encodeFunctionData('mintAchievement', [tier, score]);

        const tx = {
            from: account,
            to: this.contractAddress,
            data: data,
            // Gas will be estimated by provider
        };

        // Send transaction
        const txHash = await this.provider.request({
            method: 'eth_sendTransaction',
            params: [tx],
        });

        return {
            hash: txHash,
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
        // For now, return true if not initialized (will check on-chain later)
        if (!this.isInitialized) return true;

        try {
            // Call hasClaimed view function
            const data = this.encodeFunctionData('hasClaimed', [address, tier]);

            const result = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: this.contractAddress,
                    data: data,
                }, 'latest'],
            });

            // Decode boolean result
            const claimed = parseInt(result, 16) !== 0;
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
