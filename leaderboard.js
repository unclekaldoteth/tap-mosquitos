/* ============================================
   TAP THAT MOSQUITO - GLOBAL LEADERBOARD
   Uses Supabase API with localStorage fallback
   ============================================ */

const LEADERBOARD_KEY = 'mosquito-leaderboard';
const MAX_ENTRIES = 10;
const API_URL = '/api/leaderboard';

class LeaderboardManager {
    constructor() {
        this.entries = [];
        this.localEntries = this.loadLocal();
        this.isOnline = false;
    }

    // Load from localStorage (fallback)
    loadLocal() {
        try {
            const data = localStorage.getItem(LEADERBOARD_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    // Save to localStorage
    saveLocal() {
        try {
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.localEntries));
        } catch (e) {
            console.warn('Failed to save local leaderboard:', e);
        }
    }

    // Fetch global leaderboard from API
    async fetchGlobal() {
        try {
            const response = await fetch(API_URL);
            if (response.ok) {
                const data = await response.json();
                this.entries = (data.entries || []).map(entry => ({
                    score: entry.score,
                    address: entry.wallet_address,
                    username: entry.username,
                    displayAddress: entry.username || this.formatAddress(entry.wallet_address),
                    tapped: entry.tapped,
                    bestCombo: entry.best_combo,
                    timestamp: new Date(entry.created_at).getTime(),
                }));
                this.isOnline = true;
                return this.entries;
            }
        } catch (error) {
            console.log('Using local leaderboard:', error.message);
        }

        // Fallback to local
        this.isOnline = false;
        this.entries = this.localEntries;
        return this.entries;
    }

    // Add a new score entry
    async addScore(score, address = null, username = null, stats = {}) {
        const entry = {
            score,
            address: address || 'Anonymous',
            username: username || null,
            displayAddress: username || this.formatAddress(address),
            tapped: stats.tapped || 0,
            bestCombo: stats.bestCombo || 1,
            timestamp: Date.now(),
        };

        // Try to submit to API
        let rank = -1;
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    username: username,
                    score: score,
                    tapped: stats.tapped || 0,
                    bestCombo: stats.bestCombo || 1
                })
            });

            if (response.ok) {
                const data = await response.json();
                rank = data.rank || -1;
                this.isOnline = true;
                // Refresh global leaderboard
                await this.fetchGlobal();
                return rank;
            }
        } catch (error) {
            console.log('API submit failed, saving locally:', error.message);
        }

        // Fallback: save locally
        this.isOnline = false;
        this.localEntries.push(entry);
        this.localEntries.sort((a, b) => b.score - a.score);
        this.localEntries = this.localEntries.slice(0, MAX_ENTRIES);
        this.saveLocal();
        this.entries = this.localEntries;

        rank = this.localEntries.findIndex(e =>
            e.timestamp === entry.timestamp && e.score === entry.score
        );

        return rank >= 0 ? rank + 1 : -1;
    }

    // Get all leaderboard entries
    getAll() {
        return this.entries.length > 0 ? this.entries : this.localEntries;
    }

    // Get player's best score
    getBestScore(address) {
        if (!address) return null;
        const all = this.getAll();
        const playerEntries = all.filter(e =>
            e.address && e.address.toLowerCase() === address.toLowerCase()
        );
        return playerEntries.length > 0 ? playerEntries[0] : null;
    }

    // Check if score qualifies for leaderboard
    isHighScore(score) {
        const all = this.getAll();
        if (all.length < MAX_ENTRIES) return true;
        return score > all[all.length - 1].score;
    }

    // Format address for display
    formatAddress(address) {
        if (!address || address === 'Anonymous') return '???';
        if (address.length <= 10) return address;
        return `${address.slice(0, 4)}..${address.slice(-4)}`;
    }

    // Update username for existing entries with this address (local only)
    updateUsername(address, username) {
        if (!address || !username) return;

        let updated = false;
        this.localEntries.forEach(entry => {
            if (entry.address && entry.address.toLowerCase() === address.toLowerCase()) {
                if (entry.username !== username) {
                    entry.username = username;
                    entry.displayAddress = username;
                    updated = true;
                }
            }
        });

        if (updated) {
            this.saveLocal();
        }
    }

    // Get achievement tier based on score
    getAchievementTier(score) {
        if (score >= 2000) return { tier: 'legendary', name: 'Mosquito Slayer', color: '#ff6b9d' };
        if (score >= 1000) return { tier: 'epic', name: 'Bug Hunter', color: '#a855f7' };
        if (score >= 500) return { tier: 'rare', name: 'Swatter Pro', color: '#3b82f6' };
        if (score >= 200) return { tier: 'uncommon', name: 'Pest Control', color: '#22c55e' };
        return { tier: 'common', name: 'Beginner', color: '#6b7280' };
    }

    // Check if using global or local leaderboard
    isGlobal() {
        return this.isOnline;
    }
}

export const leaderboard = new LeaderboardManager();
