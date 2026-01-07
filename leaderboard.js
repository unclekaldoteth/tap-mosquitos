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

    // Normalize wallet address for consistent matching/storage
    normalizeAddress(address) {
        return typeof address === 'string' ? address.toLowerCase() : null;
    }

    // Sanitize username for display and storage
    sanitizeUsername(username) {
        if (typeof username !== 'string') return null;
        const trimmed = username.trim();
        if (!trimmed) return null;
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    }

    // Normalize usernames for consistent comparison
    normalizeUsername(username) {
        const sanitized = this.sanitizeUsername(username);
        if (!sanitized) return null;
        const normalized = sanitized.toLowerCase();
        if (normalized === 'connected') return null;
        return normalized;
    }

    // Deduplicate entries by username (preferred) or address
    dedupeEntries(entries) {
        const byKey = new Map();

        for (const entry of entries) {
            const normalizedUsername = this.normalizeUsername(entry.username);
            const normalizedAddress = entry.address && entry.address !== 'Anonymous'
                ? this.normalizeAddress(entry.address)
                : null;
            const key = normalizedUsername
                ? `u:${normalizedUsername}`
                : normalizedAddress
                    ? `a:${normalizedAddress}`
                    : `t:${entry.timestamp || 0}:${entry.score || 0}`;

            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, entry);
                continue;
            }

            const existingScore = existing.score || 0;
            const entryScore = entry.score || 0;
            const existingTime = existing.timestamp || 0;
            const entryTime = entry.timestamp || 0;

            if (entryScore > existingScore || (entryScore === existingScore && entryTime > existingTime)) {
                byKey.set(key, entry);
            }
        }

        return Array.from(byKey.values()).sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.timestamp || 0) - (a.timestamp || 0);
        });
    }

    // Fetch global leaderboard from API
    async fetchGlobal() {
        try {
            const response = await fetch(API_URL);
            if (response.ok) {
                const data = await response.json();
                this.entries = (data.entries || []).map(entry => ({
                    score: entry.score,
                    address: this.normalizeAddress(entry.wallet_address) || entry.wallet_address,
                    username: this.sanitizeUsername(entry.username),
                    displayAddress: this.sanitizeUsername(entry.username) || this.formatAddress(entry.wallet_address),
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
        const normalizedAddress = address ? this.normalizeAddress(address) : null;
        const sanitizedUsername = this.sanitizeUsername(username);
        const entry = {
            score,
            address: normalizedAddress || address || 'Anonymous',
            username: sanitizedUsername || null,
            displayAddress: sanitizedUsername || this.formatAddress(address),
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
                    walletAddress: normalizedAddress,
                    username: sanitizedUsername,
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
        const entries = this.entries.length > 0 ? this.entries : this.localEntries;
        return this.dedupeEntries(entries);
    }

    // Get player's best score
    getBestScore(address) {
        if (!address) return null;
        const normalizedAddress = this.normalizeAddress(address);
        const all = this.getAll();
        const playerEntries = all.filter(e => {
            if (!e.address || !normalizedAddress) return false;
            return this.normalizeAddress(e.address) === normalizedAddress;
        });
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

        const sanitizedUsername = this.sanitizeUsername(username);
        if (!sanitizedUsername) return;

        let updated = false;
        const normalizedAddress = this.normalizeAddress(address);
        this.localEntries.forEach(entry => {
            if (entry.address && this.normalizeAddress(entry.address) === normalizedAddress) {
                if (entry.username !== sanitizedUsername) {
                    entry.username = sanitizedUsername;
                    entry.displayAddress = sanitizedUsername;
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
