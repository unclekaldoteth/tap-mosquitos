/* ============================================
   VERSUS CHALLENGE MANAGER
   Handles challenge creation, acceptance, and scoring
   ============================================ */

const CHALLENGE_API = '/api/challenge';

class ChallengeManager {
    constructor() {
        this.currentChallenge = null;
        this.userFid = null;
        this.username = null;
    }

    // Set user context
    setUser(fid, username) {
        this.userFid = fid;
        this.username = username;
    }

    // Create a challenge to a user
    async createChallenge(opponent) {
        if (!this.userFid) {
            throw new Error('Not logged in');
        }

        let opponentUsername = null;
        let opponentFid = null;

        if (typeof opponent === 'string') {
            opponentUsername = opponent;
        } else if (opponent && typeof opponent === 'object') {
            opponentUsername = opponent.opponentUsername || opponent.username || null;
            opponentFid = opponent.opponentFid ?? opponent.fid ?? null;
        }

        if (opponentUsername) {
            opponentUsername = opponentUsername.replace(/^@/, '');
        }
        if (!opponentUsername && (opponentFid === null || opponentFid === undefined)) {
            throw new Error('Missing opponent');
        }

        const response = await fetch(`${CHALLENGE_API}?action=create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengerFid: this.userFid,
                challengerUsername: this.username,
                opponentUsername,
                opponentFid
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create challenge');
        }

        return data.challenge;
    }

    // Accept a pending challenge
    async acceptChallenge(challengeId) {
        if (!this.userFid) {
            throw new Error('Not logged in');
        }

        const response = await fetch(`${CHALLENGE_API}?action=accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId,
                opponentFid: this.userFid
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to accept challenge');
        }

        this.currentChallenge = data.challenge;
        return data.challenge;
    }

    // Decline a challenge
    async declineChallenge(challengeId) {
        if (!this.userFid) {
            throw new Error('Not logged in');
        }

        const response = await fetch(`${CHALLENGE_API}?action=decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId,
                opponentFid: this.userFid
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to decline challenge');
        }

        return true;
    }

    // Submit score after playing
    async submitScore(challengeId, score) {
        if (!this.userFid) {
            throw new Error('Not logged in');
        }

        const response = await fetch(`${CHALLENGE_API}?action=submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId,
                fid: this.userFid,
                score
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit score');
        }

        this.currentChallenge = data.challenge;
        return data.challenge;
    }

    // Get pending challenges (where user is opponent)
    async getPendingChallenges() {
        if (!this.userFid) {
            return [];
        }

        const response = await fetch(`${CHALLENGE_API}?action=pending&fid=${this.userFid}`);
        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to get pending challenges:', data.error);
            return [];
        }

        return data.challenges || [];
    }

    // Get active challenge (accepted but not completed)
    async getActiveChallenge() {
        if (!this.userFid) {
            return null;
        }

        const response = await fetch(`${CHALLENGE_API}?action=active&fid=${this.userFid}`);
        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to get active challenge:', data.error);
            return null;
        }

        this.currentChallenge = data.challenge;
        return data.challenge;
    }

    // Check if in versus mode
    isVersusMode() {
        return !!this.currentChallenge && this.currentChallenge.status === 'accepted';
    }

    // Get current challenge
    getCurrentChallenge() {
        return this.currentChallenge;
    }

    // Clear current challenge
    clearChallenge() {
        this.currentChallenge = null;
    }

    // Get challenge result details
    getResultDetails(challenge) {
        if (!challenge || challenge.status !== 'completed') {
            return null;
        }

        const isChallenger = challenge.challenger_fid === this.userFid;
        const myScore = isChallenger ? challenge.challenger_score : challenge.opponent_score;
        const theirScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;
        const opponentName = isChallenger ? challenge.opponent_username : challenge.challenger_username;

        let result = 'tie';
        if (challenge.winner_fid === this.userFid) {
            result = 'win';
        } else if (challenge.winner_fid !== null) {
            result = 'loss';
        }

        return {
            result,
            myScore,
            theirScore,
            opponentName,
            challenge
        };
    }
}

export const challengeManager = new ChallengeManager();
