/* ============================================
   SHARE MANAGER - Viral Content Sharing
   Handles all shareable content for Farcaster
   ============================================ */

import { sdk } from '@farcaster/miniapp-sdk';

const APP_URL = 'https://neon-shuttle.vercel.app';

class ShareManager {
    constructor() {
        this.hasSharedFirstGame = localStorage.getItem('mosquito-first-game-shared') === 'true';
    }

    /**
     * Core share function using Farcaster SDK
     */
    async share(text) {
        try {
            await sdk.actions.composeCast({
                text,
                embeds: [APP_URL],
            });
            return true;
        } catch (error) {
            console.error('Share failed:', error);
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(text + '\n\n' + APP_URL);
                alert('Copied to clipboard! Paste it in your Farcaster client.');
                return true;
            } catch {
                alert('Could not share. Try again in the Base app!');
                return false;
            }
        }
    }

    /**
     * 1. VERSUS VICTORY SHARE
     * When player wins a 1v1 battle and mints Victory NFT
     */
    async shareVersusVictory({ myScore, opponentScore, opponentName, winStreak = 1 }) {
        const streakText = winStreak > 1 ? `\nWin Streak: ${winStreak}` : '';
        const title = this.getVictoryTitle(winStreak);

        const text = `${title} I just defeated ${opponentName} in Tap That Mosquito!

Score: ${myScore} vs ${opponentScore}${streakText}

Claimed my Victory NFT on Base.

Think you can beat me? Challenge me:`;

        return this.share(text);
    }

    /**
     * 2. NEW HIGH SCORE SHARE
     * When player beats their personal best
     */
    async shareNewHighScore({ score, previousBest, combo, tierName }) {
        const improvementText = previousBest > 0
            ? `Beat my previous best of ${previousBest}!`
            : 'Set my first high score!';

        const text = `NEW PERSONAL BEST!

I just scored ${score} points in Tap That Mosquito!

${improvementText}
Best Combo: ${combo}x
Tier: ${tierName}

Can you beat my score?`;

        return this.share(text);
    }

    /**
     * 3. LEADERBOARD RANK SHARE
     * When player enters or climbs the leaderboard
     */
    async shareLeaderboardRank({ rank, score, previousRank = null }) {
        let rankText;
        if (previousRank && previousRank > rank) {
            rankText = `Just climbed from #${previousRank} to #${rank}`;
        } else if (rank <= 3) {
            const medals = { 1: 'Taking the crown at #1', 2: 'Claimed #2 spot', 3: 'Secured #3 position' };
            rankText = medals[rank];
        } else {
            rankText = `Just hit #${rank}`;
        }

        const text = `${rankText} on the Tap That Mosquito leaderboard!

Score: ${score} points

Who can knock me off?`;

        return this.share(text);
    }

    /**
     * 4. ACHIEVEMENT NFT MINT SHARE
     * When player mints a tier achievement NFT
     */
    async shareAchievementMint({ tierName, score, tierRarity }) {
        const rarityText = tierRarity ? `Only ${tierRarity}% of players reach this tier.` : '';

        const text = `Just unlocked ${tierName.toUpperCase()} status in Tap That Mosquito!

Scored ${score} points and minted my on-chain achievement NFT on Base.

${rarityText}

Collect yours:`;

        return this.share(text);
    }

    /**
     * 5. CHAMPION NFT SHARE
     * When player claims Champion NFT after 5+ wins
     */
    async shareChampionNFT({ totalWins, winStreak }) {
        const text = `I AM THE CHAMPION!

${totalWins} versus victories in Tap That Mosquito.
Current Win Streak: ${winStreak}

Claimed my exclusive Champion NFT on Base - only the best can earn this.

Want to challenge the champ?`;

        return this.share(text);
    }

    /**
     * 6. CHALLENGE ISSUED SHARE
     * When creating a versus challenge
     */
    async shareChallengeIssued({ opponentName }) {
        const text = `I just challenged ${opponentName} to a battle in Tap That Mosquito!

Who will survive the mosquito swarm?

Watch us fight:`;

        return this.share(text);
    }

    /**
     * 7. FIRST GAME SHARE
     * After playing the first game (onboarding)
     */
    async shareFirstGame({ score, combo }) {
        if (this.hasSharedFirstGame) {
            return false; // Only prompt once
        }

        const text = `Just played my first game of Tap That Mosquito!

Score: ${score} points
Best Combo: ${combo}x

Try to beat my newbie score:`;

        const shared = await this.share(text);
        if (shared) {
            this.hasSharedFirstGame = true;
            localStorage.setItem('mosquito-first-game-shared', 'true');
        }
        return shared;
    }

    /**
     * Get victory title based on win streak
     */
    getVictoryTitle(streak) {
        if (streak >= 10) return 'UNSTOPPABLE!';
        if (streak >= 7) return 'DOMINATING!';
        if (streak >= 5) return 'CHAMPION!';
        if (streak >= 3) return 'ON FIRE!';
        return 'VICTORY!';
    }

    /**
     * Check if this is player's first game
     */
    isFirstGame() {
        return !localStorage.getItem('mosquito-games-played');
    }

    /**
     * Track game played
     */
    trackGamePlayed() {
        const count = parseInt(localStorage.getItem('mosquito-games-played') || '0');
        localStorage.setItem('mosquito-games-played', (count + 1).toString());
    }

    /**
     * Get games played count
     */
    getGamesPlayed() {
        return parseInt(localStorage.getItem('mosquito-games-played') || '0');
    }
}

export const shareManager = new ShareManager();
