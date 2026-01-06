/* ============================================
   TAP THAT MOSQUITO - LEADERBOARD
   Local storage based leaderboard system
   ============================================ */

const LEADERBOARD_KEY = 'mosquito-leaderboard';
const MAX_ENTRIES = 10;

class LeaderboardManager {
    constructor() {
        this.entries = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(LEADERBOARD_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.entries));
        } catch (e) {
            console.warn('Failed to save leaderboard:', e);
        }
    }

    // Add a new score entry
    addScore(score, address = null, username = null, stats = {}) {
        const entry = {
            score,
            address: address || 'Anonymous',
            username: username || null,
            displayAddress: username || this.formatAddress(address),
            tapped: stats.tapped || 0,
            bestCombo: stats.bestCombo || 1,
            timestamp: Date.now(),
        };

        this.entries.push(entry);

        // Sort by score descending
        this.entries.sort((a, b) => b.score - a.score);

        // Keep only top entries
        this.entries = this.entries.slice(0, MAX_ENTRIES);

        this.save();

        // Return the rank (1-indexed, or -1 if not in top 10)
        const rank = this.entries.findIndex(e =>
            e.timestamp === entry.timestamp && e.score === entry.score
        );

        return rank >= 0 ? rank + 1 : -1;
    }

    // Get all leaderboard entries
    getAll() {
        return this.entries;
    }

    // Get player's best score
    getBestScore(address) {
        if (!address) return null;
        const playerEntries = this.entries.filter(e => e.address === address);
        return playerEntries.length > 0 ? playerEntries[0] : null;
    }

    // Check if score qualifies for leaderboard
    isHighScore(score) {
        if (this.entries.length < MAX_ENTRIES) return true;
        return score > this.entries[this.entries.length - 1].score;
    }

    // Format address for display
    formatAddress(address) {
        if (!address || address === 'Anonymous') return '???';
        if (address.length <= 10) return address;
        return `${address.slice(0, 4)}..${address.slice(-4)}`;
    }

    // Update username for existing entries with this address
    updateUsername(address, username) {
        if (!address || !username) return;

        let updated = false;
        this.entries.forEach(entry => {
            if (entry.address && entry.address.toLowerCase() === address.toLowerCase()) {
                if (entry.username !== username) {
                    entry.username = username;
                    entry.displayAddress = username; // Ensure display address is also updated
                    updated = true;
                }
            }
        });

        if (updated) {
            this.save();
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

}

export const leaderboard = new LeaderboardManager();
