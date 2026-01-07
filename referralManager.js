/* ============================================
   REFERRAL MANAGER - Viral Growth System
   Handles referral codes, tracking, and rewards
   ============================================ */

const APP_URL = 'https://tap-mosquito.vercel.app';

class ReferralManager {
    constructor() {
        this.referralCode = null;
        this.referredBy = localStorage.getItem('mosquito-referred-by');
        this.referralCount = parseInt(localStorage.getItem('mosquito-referral-count') || '0');
        this.pendingReferralBoost = localStorage.getItem('mosquito-referral-boost') === 'true';
    }

    /**
     * Initialize referral system on app load
     * Check URL for referral code and process it
     */
    init(walletAddress, fid, username = null) {
        // Use username-only referral codes for tracking
        if (username) {
            // Use username directly (remove @ if present)
            this.referralCode = username.replace('@', '').toLowerCase();
        }

        // Check if user came via referral link
        this.processReferralFromURL();
    }

    /**
     * Generate a short referral code from wallet address
     */
    generateCode(address) {
        // Use first 4 and last 4 characters of address
        return `${address.slice(2, 6)}${address.slice(-4)}`.toLowerCase();
    }

    /**
     * Check URL for referral parameter and process it
     */
    processReferralFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        const normalizedRef = refCode ? refCode.replace(/^@/, '').trim().toLowerCase() : null;

        if (normalizedRef && !this.referredBy) {
            if (this.referralCode && normalizedRef === this.referralCode.toLowerCase()) {
                // Ignore self-referrals
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                return;
            }

            // New referral - store it
            this.referredBy = normalizedRef;
            localStorage.setItem('mosquito-referred-by', normalizedRef);

            // Grant boost to the referred player
            this.pendingReferralBoost = true;
            localStorage.setItem('mosquito-referral-boost', 'true');

            console.log(`🔗 Referred by: ${refCode}`);

            // Clean up URL (remove ref param)
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }

    /**
     * Get the user's referral link
     */
    getReferralLink() {
        if (!this.referralCode) return APP_URL;
        const baseUrl = APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL;
        return `${baseUrl}/?ref=${encodeURIComponent(this.referralCode)}`;
    }

    /**
     * Check if player has pending referral boost
     */
    hasReferralBoost() {
        return this.pendingReferralBoost;
    }

    /**
     * Consume referral boost (called when game starts)
     */
    consumeReferralBoost() {
        if (!this.pendingReferralBoost) return null;

        this.pendingReferralBoost = false;
        localStorage.removeItem('mosquito-referral-boost');

        return {
            bonusTime: 10,          // +10 seconds (more than share!)
            startMultiplier: 2,     // Start with 2x
            bonusPoints: 50         // +50 starting points
        };
    }

    /**
     * Record that someone used your referral code
     * Called when a referred player completes their first game
     */
    recordReferralSuccess() {
        this.referralCount++;
        localStorage.setItem('mosquito-referral-count', this.referralCount.toString());

        // Grant boost to referrer (stored for their next game)
        // This would ideally be server-side, but for now we use localStorage
        // In production, you'd want to verify this on a backend
    }

    /**
     * Get referral stats
     */
    getStats() {
        return {
            code: this.referralCode,
            link: this.getReferralLink(),
            referredBy: this.referredBy,
            referralCount: this.referralCount
        };
    }

    /**
     * Check if this is user's first game (for referral reward)
     */
    isFirstGame() {
        return !localStorage.getItem('mosquito-games-played');
    }

    /**
     * Called after first game to credit referrer
     */
    onFirstGameComplete() {
        if (this.referredBy && this.isFirstGame()) {
            // In a real app, you'd send this to a backend
            // For now, just log it
            console.log(`📊 First game completed! Referrer ${this.referredBy} credited.`);
        }
    }
}

export const referralManager = new ReferralManager();
