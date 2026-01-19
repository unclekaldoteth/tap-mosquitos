/* ============================================
   GAME PASS NFT - CONTRACT INTEGRATION
   P2W mode: Mint to fund prize pool, compete for rewards
   ============================================ */

import { ethers } from 'ethers';
import { sdk } from '@farcaster/miniapp-sdk';
import { getBaseAccountProvider } from './baseAccount.js';

// GamePass NFT ABI
export const GAMEPASS_NFT_ABI = [
    // Read functions
    {
        inputs: [{ name: "player", type: "address" }],
        name: "hasGamePass",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "prizePool",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "getPrizePool",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "totalMinted",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "MINT_PRICE",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "player", type: "address" }],
        name: "getPlayerPasses",
        outputs: [{ name: "", type: "uint256[]" }],
        stateMutability: "view",
        type: "function"
    },
    // Write functions
    {
        inputs: [],
        name: "mintGamePass",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "payable",
        type: "function"
    },
    {
        inputs: [{ name: "referrer", type: "address" }],
        name: "mintWithReferral",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "payable",
        type: "function"
    },
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "player", type: "address" },
            { indexed: true, name: "tokenId", type: "uint256" },
            { indexed: true, name: "referrer", type: "address" }
        ],
        name: "GamePassMinted",
        type: "event"
    }
];

// Contract addresses
export const GAMEPASS_ADDRESSES = {
    mainnet: null,  // Will be set after mainnet deployment
    sepolia: '0x050Ac333BE960bDf46Cc09452dA5e800bD8b358a'  // Base Sepolia deployment
};

// Mint price
export const MINT_PRICE_ETH = "0.0005";
export const MINT_PRICE_WEI = ethers.parseEther(MINT_PRICE_ETH);

/**
 * GamePass Manager - handles all P2W Game Pass interactions
 */
class GamePassManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = null;
        this.account = null;
        this.chainId = null;
        this.rawProvider = null;
    }

    /**
     * Set external provider (called from game.js when wallet connects)
     */
    setProvider(provider) {
        if (provider?.request) {
            this.rawProvider = provider;
            console.log('[GamePass] External provider set');
        }
    }

    /**
     * Initialize the manager with a provider
     */
    async init() {
        try {
            // Use stored provider first, then fallbacks
            let rawProvider = this.rawProvider;

            // Try window.__walletProvider
            if (!rawProvider && typeof window !== 'undefined' && window.__walletProvider) {
                rawProvider = window.__walletProvider;
            }

            // Try window.__onchainkitProvider
            if (!rawProvider && typeof window !== 'undefined' && window.__onchainkitProvider) {
                rawProvider = window.__onchainkitProvider;
            }

            // Try Base Account SDK
            if (!rawProvider) {
                rawProvider = await getBaseAccountProvider();
            }

            // Try window.ethereum
            if (!rawProvider && typeof window !== 'undefined' && window.ethereum) {
                rawProvider = window.ethereum;
            }

            if (!rawProvider) {
                console.warn('[GamePass] No provider available');
                return false;
            }

            // Store for future use
            this.rawProvider = rawProvider;
            this.provider = new ethers.BrowserProvider(rawProvider);

            // Get chain ID
            const network = await this.provider.getNetwork();
            this.chainId = Number(network.chainId);
            console.log('[GamePass] Connected to chain:', this.chainId);

            // Set contract address based on chain
            const envMainnet = import.meta.env.VITE_GAMEPASS_CONTRACT_ADDRESS_MAINNET
                || import.meta.env.VITE_GAMEPASS_CONTRACT_ADDRESS;
            const envSepolia = import.meta.env.VITE_GAMEPASS_CONTRACT_ADDRESS_SEPOLIA
                || import.meta.env.VITE_GAMEPASS_CONTRACT_ADDRESS;

            if (this.chainId === 8453) {
                this.contractAddress = GAMEPASS_ADDRESSES.mainnet || envMainnet;
            } else if (this.chainId === 84532) {
                this.contractAddress = GAMEPASS_ADDRESSES.sepolia || envSepolia;
            } else {
                // For other chains, try the general address
                this.contractAddress = import.meta.env.VITE_GAMEPASS_CONTRACT_ADDRESS;
            }

            if (!this.contractAddress) {
                console.warn('[GamePass] No contract address for chain:', this.chainId);
                return false;
            }

            console.log('[GamePass] Using contract:', this.contractAddress);

            const code = await this.provider.getCode(this.contractAddress);
            if (!code || code === '0x') {
                console.warn('[GamePass] No contract deployed at address:', this.contractAddress);
                this.contractAddress = null;
                this.contract = null;
                return false;
            }

            // Create contract instance (read-only until signer is connected)
            this.contract = new ethers.Contract(
                this.contractAddress,
                GAMEPASS_NFT_ABI,
                this.provider
            );

            console.log('[GamePass] Initialized successfully for chain:', this.chainId);
            return true;
        } catch (error) {
            console.error('[GamePass] Init error:', error);
            return false;
        }
    }

    /**
     * Ensure wallet is on the correct chain (Base Sepolia for testnet)
     * Returns true if on correct chain, false if switch failed
     */
    async ensureCorrectChain() {
        const targetChainId = 84532; // Base Sepolia
        const targetChainHex = '0x14a34';

        // Get provider from multiple sources
        let provider = this.rawProvider;
        if (!provider && typeof window !== 'undefined') {
            provider = window.__walletProvider || window.__onchainkitProvider || window.ethereum;
        }

        if (!provider) {
            console.warn('[GamePass] No provider to switch chain');
            return false;
        }

        // Store for later use
        this.rawProvider = provider;

        try {
            // IMPORTANT: Must request accounts first to unlock wallet
            try {
                await provider.request({ method: 'eth_requestAccounts' });
            } catch (accountError) {
                console.warn('[GamePass] Account request failed:', accountError);
                // Continue anyway, might already be connected
            }

            // Get current chain
            const currentChainHex = await provider.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(currentChainHex, 16);

            console.log('[GamePass] Current chain:', currentChainId, 'Target:', targetChainId);

            if (currentChainId === targetChainId) {
                console.log('[GamePass] Already on Base Sepolia');
                return true;
            }

            console.log('[GamePass] Requesting switch from chain', currentChainId, 'to Base Sepolia');

            // Try to switch chain
            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainHex }]
                });
                console.log('[GamePass] Chain switched successfully');

                // Re-initialize after chain switch
                this.provider = null;
                this.contract = null;
                this.signer = null;
                await this.init();

                return true;
            } catch (switchError) {
                console.log('[GamePass] Switch error:', switchError);

                // Chain not added, try to add it
                if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
                    console.log('[GamePass] Adding Base Sepolia network');
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: targetChainHex,
                            chainName: 'Base Sepolia',
                            nativeCurrency: {
                                name: 'Ethereum',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['https://sepolia.base.org'],
                            blockExplorerUrls: ['https://sepolia.basescan.org']
                        }]
                    });

                    // Re-initialize after adding chain
                    this.provider = null;
                    this.contract = null;
                    this.signer = null;
                    await this.init();

                    return true;
                }

                // User rejected or other error
                if (switchError.code === 4001) {
                    console.log('[GamePass] User rejected chain switch');
                    return false;
                }

                throw switchError;
            }
        } catch (error) {
            console.error('[GamePass] Chain switch failed:', error);
            return false;
        }
    }

    /**
     * Connect signer for write operations
     */
    async connectSigner() {
        if (!this.provider) await this.init();
        if (!this.provider || !this.contractAddress) {
            console.warn('[GamePass] Connect signer failed: missing provider or contract address');
            return null;
        }

        try {
            try {
                await this.provider.send('eth_requestAccounts', []);
            } catch (requestError) {
                console.warn('[GamePass] Account request rejected:', requestError?.message || requestError);
            }
            this.signer = await this.provider.getSigner();
            this.account = await this.signer.getAddress();

            // Recreate contract with signer
            this.contract = new ethers.Contract(
                this.contractAddress,
                GAMEPASS_NFT_ABI,
                this.signer
            );

            return this.account;
        } catch (error) {
            console.error('[GamePass] Connect signer error:', error);
            return null;
        }
    }

    /**
     * Check if player has a Game Pass
     */
    async hasGamePass(address) {
        if (!this.contract) await this.init();
        if (!this.contract) return false;

        try {
            const result = await this.contract.hasGamePass(address);
            return result;
        } catch (error) {
            console.error('[GamePass] hasGamePass error:', error);
            return false;
        }
    }

    /**
     * Get player's Game Pass count
     */
    async getPassCount(address) {
        if (!this.contract) await this.init();
        if (!this.contract) return 0;

        try {
            const balance = await this.contract.balanceOf(address);
            return Number(balance);
        } catch (error) {
            console.error('[GamePass] getPassCount error:', error);
            return 0;
        }
    }

    /**
     * Get current prize pool balance
     */
    async getPrizePool() {
        if (!this.contract) await this.init();
        if (!this.contract) return "0";

        try {
            const pool = await this.contract.getPrizePool();
            return ethers.formatEther(pool);
        } catch (error) {
            console.error('[GamePass] getPrizePool error:', error);
            return "0";
        }
    }

    /**
     * Get total minted passes
     */
    async getTotalMinted() {
        if (!this.contract) await this.init();
        if (!this.contract) return 0;

        try {
            const total = await this.contract.totalMinted();
            return Number(total);
        } catch (error) {
            console.error('[GamePass] getTotalMinted error:', error);
            return 0;
        }
    }

    /**
     * Mint a Game Pass
     */
    async mintGamePass() {
        if (!this.signer) await this.connectSigner();
        if (!this.signer) throw new Error("Wallet not connected");

        try {
            console.log('[GamePass] Minting Game Pass...');

            const tx = await this.contract.mintGamePass({
                value: MINT_PRICE_WEI
            });

            console.log('[GamePass] Tx submitted:', tx.hash);

            const receipt = await tx.wait();
            console.log('[GamePass] Mint confirmed!');

            // Parse GamePassMinted event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'GamePassMinted';
                } catch {
                    return false;
                }
            });

            if (event) {
                const parsed = this.contract.interface.parseLog(event);
                return {
                    success: true,
                    txHash: tx.hash,
                    tokenId: Number(parsed.args.tokenId)
                };
            }

            return { success: true, txHash: tx.hash };
        } catch (error) {
            console.error('[GamePass] Mint error:', error);
            throw error;
        }
    }

    /**
     * Mint a Game Pass with referral
     */
    async mintWithReferral(referrer) {
        if (!this.signer) await this.connectSigner();
        if (!this.signer) throw new Error("Wallet not connected");

        // Validate referrer
        if (!ethers.isAddress(referrer)) {
            throw new Error("Invalid referrer address");
        }

        try {
            console.log('[GamePass] Minting with referral:', referrer);

            const tx = await this.contract.mintWithReferral(referrer, {
                value: MINT_PRICE_WEI
            });

            console.log('[GamePass] Tx submitted:', tx.hash);

            const receipt = await tx.wait();
            console.log('[GamePass] Mint confirmed!');

            return { success: true, txHash: tx.hash };
        } catch (error) {
            console.error('[GamePass] Mint with referral error:', error);
            throw error;
        }
    }

    /**
     * Build mint calldata for sponsored transactions
     */
    getMintCalldata() {
        const iface = new ethers.Interface(GAMEPASS_NFT_ABI);
        return iface.encodeFunctionData("mintGamePass", []);
    }

    /**
     * Get contract address
     */
    getContractAddress() {
        return this.contractAddress;
    }

    /**
     * Check if manager is available
     */
    isAvailable() {
        return !!this.contractAddress;
    }
}

// Export singleton
export const gamePassManager = new GamePassManager();
