/* ============================================
   SPONSOR MANAGER - Prize Pool Integration
   Handles sponsor deposits, perks, and UI
   ============================================ */

import { ethers } from 'ethers';

// Contract addresses (update after deployment)
const PRIZE_POOL_ADDRESS = import.meta.env.VITE_PRIZE_POOL_ADDRESS || '';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// Sponsor tiers in USDC (6 decimals)
const TIERS = {
    BRONZE: { name: 'Bronze', amount: 3_000_000, perks: ['Name on Sponsor Wall'] },
    SILVER: { name: 'Silver', amount: 5_000_000, perks: ['Name on Sponsor Wall', 'Permanent game boosts'] },
    GOLD: { name: 'Gold', amount: 10_000_000, perks: ['Name on Sponsor Wall', 'Permanent game boosts', 'Exclusive Sponsor NFT'] },
    DIAMOND: { name: 'Diamond', amount: 20_000_000, perks: ['Name on Sponsor Wall', 'Permanent game boosts', 'Exclusive Sponsor NFT', 'Featured in casts'] }
};

// Minimal ABIs
const PRIZE_POOL_ABI = [
    'function deposit(uint256 amount) external',
    'function getSponsorTier(address sponsor) view returns (uint8)',
    'function hasBoostPerk(address sponsor) view returns (bool)',
    'function canMintSponsorNFT(address sponsor) view returns (bool)',
    'function mintSponsorNFT() external',
    'function getPoolBalance() view returns (uint256)',
    'function getAllSponsors() view returns (address[])',
    'function sponsors(address) view returns (uint256 totalDonated, uint256 firstDonationTime, bool hasMintedNFT)',
    'event Deposited(address indexed sponsor, uint256 amount, uint8 tier)'
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
];

class SponsorManager {
    constructor() {
        this.prizePoolContract = null;
        this.usdcContract = null;
        this.provider = null;
        this.signer = null;
        this.isInitialized = false;
    }

    /**
     * Initialize with wallet provider
     */
    async init(provider) {
        if (!PRIZE_POOL_ADDRESS) {
            console.warn('PrizePool contract not deployed yet');
            return false;
        }

        try {
            this.provider = provider;
            this.signer = await provider.getSigner();

            this.prizePoolContract = new ethers.Contract(
                PRIZE_POOL_ADDRESS,
                PRIZE_POOL_ABI,
                this.signer
            );

            this.usdcContract = new ethers.Contract(
                USDC_ADDRESS,
                ERC20_ABI,
                this.signer
            );

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('SponsorManager init failed:', error);
            return false;
        }
    }

    /**
     * Get tier info for a specific amount
     */
    getTierForAmount(amountUSDC) {
        if (amountUSDC >= 20) return { tier: 'DIAMOND', ...TIERS.DIAMOND };
        if (amountUSDC >= 10) return { tier: 'GOLD', ...TIERS.GOLD };
        if (amountUSDC >= 5) return { tier: 'SILVER', ...TIERS.SILVER };
        if (amountUSDC >= 3) return { tier: 'BRONZE', ...TIERS.BRONZE };
        return null;
    }

    /**
     * Deposit USDC to sponsor the prize pool
     */
    async deposit(amountUSDC) {
        if (!this.isInitialized) throw new Error('Not initialized');

        const amount = ethers.parseUnits(amountUSDC.toString(), 6);

        // Check USDC balance
        const address = await this.signer.getAddress();
        const balance = await this.usdcContract.balanceOf(address);
        if (balance < amount) {
            throw new Error(`Insufficient USDC. Need $${amountUSDC}, have $${ethers.formatUnits(balance, 6)}`);
        }

        // Check and set allowance
        const allowance = await this.usdcContract.allowance(address, PRIZE_POOL_ADDRESS);
        if (allowance < amount) {
            const approveTx = await this.usdcContract.approve(PRIZE_POOL_ADDRESS, amount);
            await approveTx.wait();
        }

        // Deposit
        const tx = await this.prizePoolContract.deposit(amount);
        const receipt = await tx.wait();

        return receipt;
    }

    /**
     * Check if address has game boost perk (Silver+)
     */
    async hasBoostPerk(address) {
        if (!this.isInitialized) return false;

        try {
            return await this.prizePoolContract.hasBoostPerk(address);
        } catch {
            return false;
        }
    }

    /**
     * Get sponsor's tier
     */
    async getSponsorTier(address) {
        if (!this.isInitialized) return 0;

        try {
            const tier = await this.prizePoolContract.getSponsorTier(address);
            return Number(tier);
        } catch {
            return 0;
        }
    }

    /**
     * Get sponsor info
     */
    async getSponsorInfo(address) {
        if (!this.isInitialized) return null;

        try {
            const [totalDonated, firstDonationTime, hasMintedNFT] = await this.prizePoolContract.sponsors(address);
            const tier = await this.getSponsorTier(address);

            return {
                totalDonated: ethers.formatUnits(totalDonated, 6),
                firstDonationTime: Number(firstDonationTime),
                hasMintedNFT,
                tier,
                tierName: ['None', 'Bronze', 'Silver', 'Gold', 'Diamond'][tier]
            };
        } catch {
            return null;
        }
    }

    /**
     * Check if can mint Sponsor NFT
     */
    async canMintSponsorNFT(address) {
        if (!this.isInitialized) return false;

        try {
            return await this.prizePoolContract.canMintSponsorNFT(address);
        } catch {
            return false;
        }
    }

    /**
     * Mint Sponsor NFT (Gold+ only)
     */
    async mintSponsorNFT() {
        if (!this.isInitialized) throw new Error('Not initialized');

        const tx = await this.prizePoolContract.mintSponsorNFT();
        return await tx.wait();
    }

    /**
     * Get current prize pool balance
     */
    async getPoolBalance() {
        if (!this.isInitialized) return '0';

        try {
            const balance = await this.prizePoolContract.getPoolBalance();
            return ethers.formatUnits(balance, 6);
        } catch {
            return '0';
        }
    }

    /**
     * Get all sponsors for Sponsor Wall
     */
    async getAllSponsors() {
        if (!this.isInitialized) return [];

        try {
            const addresses = await this.prizePoolContract.getAllSponsors();
            const sponsors = [];

            for (const addr of addresses) {
                const info = await this.getSponsorInfo(addr);
                if (info) {
                    sponsors.push({
                        address: addr,
                        ...info
                    });
                }
            }

            // Sort by total donated (highest first)
            return sponsors.sort((a, b) => parseFloat(b.totalDonated) - parseFloat(a.totalDonated));
        } catch {
            return [];
        }
    }

    /**
     * Get tier thresholds for UI
     */
    getTiers() {
        return TIERS;
    }
}

export const sponsorManager = new SponsorManager();
