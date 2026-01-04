/* ============================================
   TAP THAT MOSQUITO - GAME LOGIC
   ============================================ */

// Base Mini App SDK
import { sdk } from '@farcaster/miniapp-sdk';
import { soundManager } from './sounds.js';
import { leaderboard } from './leaderboard.js';
import { nftMinter } from './nftMinter.js';
import { TIER_INFO, Tier } from './contract.js';
import { versusManager, getVictoryTitle } from './versusContract.js';

class Game {
    constructor() {
        // DOM Elements
        this.playArea = document.getElementById('play-area');
        this.scoreEl = document.getElementById('score');
        this.timerEl = document.getElementById('timer');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.finalScoreEl = document.getElementById('final-score');
        this.newHighscoreEl = document.getElementById('new-highscore');
        this.tappedCountEl = document.getElementById('tapped-count');
        this.escapedCountEl = document.getElementById('escaped-count');
        this.bestComboEl = document.getElementById('best-combo');
        this.comboIndicator = document.getElementById('combo-indicator');
        this.comboText = document.getElementById('combo-text');
        this.walletBtn = document.getElementById('wallet-btn');
        this.walletText = document.getElementById('wallet-text');

        // New feature elements
        this.shareBtn = document.getElementById('share-btn');
        this.mintBtn = document.getElementById('mint-btn');
        this.soundToggle = document.getElementById('sound-toggle');
        this.soundIcon = document.getElementById('sound-icon');
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.achievementBadge = document.getElementById('achievement-badge');
        this.achievementIcon = document.getElementById('achievement-icon');

        // Versus mode elements
        this.versusBtn = document.getElementById('versus-btn');
        this.versusScreen = document.getElementById('versus-screen');
        this.versusWaiting = document.getElementById('versus-waiting');
        this.versusResultScreen = document.getElementById('versus-result-screen');
        this.opponentAddressInput = document.getElementById('opponent-address');
        this.createChallengeBtn = document.getElementById('create-challenge-btn');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');
        this.cancelChallengeBtn = document.getElementById('cancel-challenge-btn');
        this.mintVictoryBtn = document.getElementById('mint-victory-btn');
        this.rematchBtn = document.getElementById('rematch-btn');
        this.versusMenuBtn = document.getElementById('versus-menu-btn');
        this.versusResultTitle = document.getElementById('versus-result-title');
        this.yourVersusScore = document.getElementById('your-versus-score');
        this.opponentVersusScore = document.getElementById('opponent-versus-score');
        this.winnerMintSection = document.getElementById('winner-mint-section');
        this.loserSection = document.getElementById('loser-section');

        // Wallet status indicator (on start screen)
        this.walletStatus = document.getElementById('wallet-status');
        this.walletStatusIcon = document.getElementById('wallet-status-icon');
        this.walletStatusText = document.getElementById('wallet-status-text');

        this.achievementName = document.getElementById('achievement-name');
        this.rankDisplay = document.getElementById('rank-display');
        this.playerRank = document.getElementById('player-rank');

        // Game state
        this.score = 0;
        this.timeLeft = 60;
        this.highscore = this.loadHighscore();
        this.isRunning = false;
        this.mosquitoes = [];
        this.spawnInterval = null;
        this.gameTimer = null;

        // Wallet state
        this.walletAddress = null;
        this.username = null; // Farcaster username
        this.isConnecting = false;

        // Versus mode state
        this.isVersusMode = false;
        this.currentChallengeId = null;
        this.currentBattleId = null;
        this.opponentAddress = null;
        this.opponentScore = 0; // Simulated for demo
        this.isWinner = false;

        // Stats
        this.tappedCount = 0;
        this.escapedCount = 0;
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.lastTapTime = 0;
        this.comboTimeout = null;

        // Difficulty settings
        this.baseSpawnRate = 1200; // ms between spawns
        this.minSpawnRate = 400;
        this.mosquitoSpeed = { min: 3000, max: 6000 }; // ms to cross screen

        // Initialize
        this.init();
    }

    async init() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.walletBtn.addEventListener('click', () => this.handleWalletClick());
        this.shareBtn.addEventListener('click', () => this.shareScore());
        this.mintBtn.addEventListener('click', () => this.mintNFT());
        this.soundToggle.addEventListener('click', () => this.toggleSound());

        // Versus mode event listeners
        this.versusBtn.addEventListener('click', () => this.showVersusScreen());
        this.backToMenuBtn.addEventListener('click', () => this.hideVersusScreen());
        this.createChallengeBtn.addEventListener('click', () => this.createChallenge());
        this.cancelChallengeBtn.addEventListener('click', () => this.cancelChallenge());
        this.mintVictoryBtn.addEventListener('click', () => this.mintVictoryNFT());
        this.rematchBtn.addEventListener('click', () => this.startVersusRematch());
        this.versusMenuBtn.addEventListener('click', () => this.backToMainMenu());

        // Wallet status click handler (on start screen)
        this.walletStatus.addEventListener('click', () => this.handleWalletClick());

        // Prevent context menu on long press (mobile)
        this.playArea.addEventListener('contextmenu', (e) => e.preventDefault());

        // Initialize sound manager
        await soundManager.init();

        // Initialize NFT minter
        await nftMinter.init();

        // Signal to Base Mini App that the app is ready to display
        sdk.actions.ready();

        // Try to auto-connect wallet if in Mini App context
        await this.tryAutoConnect();
    }

    async tryAutoConnect() {
        try {
            // Check if we're in a Mini App context
            const isInMiniApp = await sdk.isInMiniApp();
            if (isInMiniApp) {
                // Get context which includes user info
                const context = await sdk.context;
                if (context?.user?.connectedAddress) {
                    const username = context.user.username || context.user.displayName || null;
                    this.setWalletConnected(context.user.connectedAddress, username);
                }
            }
        } catch (error) {
            console.log('Auto-connect skipped:', error.message);
        }
    }

    async handleWalletClick() {
        if (this.walletAddress) {
            // Already connected - show address info
            this.showWalletInfo();
            return;
        }

        if (this.isConnecting) return;

        try {
            this.isConnecting = true;
            this.walletText.textContent = '...';

            // Try to sign in with Farcaster
            const result = await sdk.actions.signIn({
                nonce: this.generateNonce(),
                acceptAuthAddress: true,
            });

            if (result?.signature) {
                // Successfully signed in
                const address = result.custody || result.fid?.toString() || 'Connected';

                // Try to get username from result or fetch it
                let username = result.username || null;
                if (!username && address.startsWith('0x')) {
                    username = await this.fetchFarcasterUsername(address);
                }

                this.setWalletConnected(address, username);
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
            // Reset button state
            this.walletText.textContent = '🔗';

            // Show error feedback
            if (error.message?.includes('rejected')) {
                this.showWalletError('Rejected');
            } else {
                this.showWalletError('Failed');
            }
        } finally {
            this.isConnecting = false;
        }
    }

    setWalletConnected(address, username = null) {
        this.walletAddress = address;
        this.username = username;
        this.walletBtn.classList.add('connected');

        // Display username if available, otherwise formatted address
        const displayName = username || this.formatAddress(address);
        this.walletText.textContent = displayName;
        this.walletBtn.title = username ? `@${username} (${address})` : address;

        // Update wallet status indicator on start screen
        this.walletStatus.classList.remove('disconnected');
        this.walletStatus.classList.add('connected');
        this.walletStatusIcon.textContent = '✅';
        this.walletStatusText.textContent = displayName;
    }

    // Get display name (username or formatted address)
    getDisplayName() {
        return this.username || this.formatAddress(this.walletAddress);
    }

    // Fetch Farcaster username by wallet address
    async fetchFarcasterUsername(address) {
        try {
            // Use Neynar API to look up user by verified address
            const apiKey = import.meta.env.VITE_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
            const response = await fetch(
                `https://api.neynar.com/v2/farcaster/user/by-verification?address=${address}`,
                {
                    headers: {
                        'accept': 'application/json',
                        'api_key': apiKey
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data?.user?.username) {
                    return data.user.username;
                }
            }
        } catch (error) {
            console.log('Farcaster lookup skipped:', error.message);
        }
        return null;
    }

    formatAddress(address) {
        if (!address) return '🔗';
        if (address.length <= 10) return address;
        return `${address.slice(0, 4)}..${address.slice(-4)}`;
    }

    generateNonce() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    showWalletInfo() {
        // Simple alert for now - could be a modal
        alert(`Connected: ${this.walletAddress}`);
    }

    showWalletError(message) {
        this.walletText.textContent = '❌';
        setTimeout(() => {
            this.walletText.textContent = '🔗';
        }, 2000);
    }

    loadHighscore() {
        return parseInt(localStorage.getItem('mosquito-highscore')) || 0;
    }

    saveHighscore(score) {
        localStorage.setItem('mosquito-highscore', score.toString());
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.resetGame();
        this.isRunning = true;
        this.startTimers();
        this.spawnMosquito();
        soundManager.playStart();
    }

    restartGame() {
        this.gameOverScreen.classList.add('hidden');
        this.resetGame();
        this.isRunning = true;
        this.startTimers();
        this.spawnMosquito();
        soundManager.playStart();
    }

    resetGame() {
        this.score = 0;
        this.timeLeft = 60;
        this.tappedCount = 0;
        this.escapedCount = 0;
        this.currentCombo = 0;
        this.bestCombo = 0;
        this.lastTapTime = 0;
        this.mosquitoes = [];

        // Clear play area
        this.playArea.innerHTML = '';

        // Update display
        this.scoreEl.textContent = '0';
        this.timerEl.textContent = '60';
        this.timerEl.classList.remove('timer-warning');
        this.hideCombo();
    }

    startTimers() {
        // Game timer (countdown)
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.timerEl.textContent = this.timeLeft;

            // Warning when time is low
            if (this.timeLeft <= 10) {
                this.timerEl.classList.add('timer-warning');
                soundManager.playWarning();
            }

            if (this.timeLeft <= 0) {
                if (this.isVersusMode) {
                    this.endVersusGame();
                } else {
                    this.endGame();
                }
            }
        }, 1000);

        // Spawn timer (difficulty increases over time)
        this.scheduleNextSpawn();
    }

    scheduleNextSpawn() {
        if (!this.isRunning) return;

        // Calculate spawn rate based on elapsed time
        const elapsed = 60 - this.timeLeft;
        const difficultyFactor = Math.min(elapsed / 60, 1);
        const spawnRate = this.baseSpawnRate - (this.baseSpawnRate - this.minSpawnRate) * difficultyFactor;

        this.spawnInterval = setTimeout(() => {
            this.spawnMosquito();
            this.scheduleNextSpawn();
        }, spawnRate + Math.random() * 300);
    }

    spawnMosquito() {
        if (!this.isRunning) return;

        const mosquito = document.createElement('div');
        mosquito.className = 'mosquito';

        // Random position
        const areaRect = this.playArea.getBoundingClientRect();
        const maxX = areaRect.width - 48;
        const maxY = areaRect.height - 48;

        // Start from edges (random side)
        const side = Math.floor(Math.random() * 4);
        let startX, startY, endX, endY;

        switch (side) {
            case 0: // Top
                startX = Math.random() * maxX;
                startY = -48;
                endX = Math.random() * maxX;
                endY = maxY + 48;
                break;
            case 1: // Right
                startX = maxX + 48;
                startY = Math.random() * maxY;
                endX = -48;
                endY = Math.random() * maxY;
                break;
            case 2: // Bottom
                startX = Math.random() * maxX;
                startY = maxY + 48;
                endX = Math.random() * maxX;
                endY = -48;
                break;
            case 3: // Left
                startX = -48;
                startY = Math.random() * maxY;
                endX = maxX + 48;
                endY = Math.random() * maxY;
                break;
        }

        mosquito.style.left = `${startX}px`;
        mosquito.style.top = `${startY}px`;

        // Calculate speed based on difficulty
        const elapsed = 60 - this.timeLeft;
        const difficultyFactor = Math.min(elapsed / 60, 1);
        const speedRange = this.mosquitoSpeed.max - this.mosquitoSpeed.min;
        const duration = this.mosquitoSpeed.max - speedRange * difficultyFactor * 0.5;
        const actualDuration = duration + Math.random() * 1000;

        // Animate movement
        const startTime = Date.now();
        const mosquitoData = {
            element: mosquito,
            startX, startY, endX, endY,
            duration: actualDuration,
            startTime,
            tapped: false
        };

        this.mosquitoes.push(mosquitoData);

        // Click handler
        mosquito.addEventListener('click', (e) => this.tapMosquito(e, mosquitoData));
        mosquito.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.tapMosquito(e, mosquitoData);
        }, { passive: false });

        this.playArea.appendChild(mosquito);

        // Animate
        this.animateMosquito(mosquitoData);
    }

    animateMosquito(data) {
        if (!this.isRunning || data.tapped) {
            return;
        }

        const elapsed = Date.now() - data.startTime;
        const progress = Math.min(elapsed / data.duration, 1);

        if (progress >= 1) {
            // Mosquito escaped
            this.mosquitoEscaped(data);
            return;
        }

        // Update position with easing
        const easeProgress = this.easeInOut(progress);
        const x = data.startX + (data.endX - data.startX) * easeProgress;
        const y = data.startY + (data.endY - data.startY) * easeProgress;

        data.element.style.left = `${x}px`;
        data.element.style.top = `${y}px`;

        requestAnimationFrame(() => this.animateMosquito(data));
    }

    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    tapMosquito(e, data) {
        if (data.tapped || !this.isRunning) return;

        data.tapped = true;
        this.tappedCount++;

        // Calculate combo
        const now = Date.now();
        if (now - this.lastTapTime < 800) {
            this.currentCombo++;
            if (this.currentCombo > this.bestCombo) {
                this.bestCombo = this.currentCombo;
            }
        } else {
            this.currentCombo = 1;
        }
        this.lastTapTime = now;

        // Calculate score with combo bonus
        const basePoints = 10;
        const comboMultiplier = Math.min(this.currentCombo, 10); // Cap at 10x
        const points = basePoints * comboMultiplier;

        this.score += points;
        this.scoreEl.textContent = this.score;

        // Show effects
        this.showSplatEffect(data.element);
        this.showScorePopup(data.element, points, this.currentCombo > 1);

        // Play sounds
        soundManager.playSplat();
        if (this.currentCombo >= 2) {
            soundManager.playCombo(this.currentCombo);
        }

        if (this.currentCombo >= 2) {
            this.showCombo(this.currentCombo);
        }

        // Animate squash
        data.element.classList.add('tapped');

        // Remove after animation
        setTimeout(() => {
            if (data.element.parentNode) {
                data.element.remove();
            }
            this.removeMosquitoData(data);
        }, 300);

        // Reset combo timeout
        clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => {
            this.hideCombo();
            this.currentCombo = 0;
        }, 1500);
    }

    mosquitoEscaped(data) {
        if (data.tapped) return;

        this.escapedCount++;

        if (data.element.parentNode) {
            data.element.remove();
        }
        this.removeMosquitoData(data);
    }

    removeMosquitoData(data) {
        const index = this.mosquitoes.indexOf(data);
        if (index > -1) {
            this.mosquitoes.splice(index, 1);
        }
    }

    showSplatEffect(mosquitoEl) {
        const splat = document.createElement('div');
        splat.className = 'splat';

        const rect = mosquitoEl.getBoundingClientRect();
        const areaRect = this.playArea.getBoundingClientRect();

        splat.style.left = `${rect.left - areaRect.left + rect.width / 2 - 30}px`;
        splat.style.top = `${rect.top - areaRect.top + rect.height / 2 - 30}px`;

        this.playArea.appendChild(splat);

        setTimeout(() => splat.remove(), 400);
    }

    showScorePopup(mosquitoEl, points, isCombo) {
        const popup = document.createElement('div');
        popup.className = `score-popup${isCombo ? ' combo' : ''}`;
        popup.textContent = `+${points}`;

        const rect = mosquitoEl.getBoundingClientRect();
        const areaRect = this.playArea.getBoundingClientRect();

        popup.style.left = `${rect.left - areaRect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - areaRect.top}px`;

        this.playArea.appendChild(popup);

        setTimeout(() => popup.remove(), 800);
    }

    showCombo(combo) {
        this.comboText.textContent = `x${combo} COMBO!`;
        this.comboIndicator.classList.remove('hidden');
    }

    hideCombo() {
        this.comboIndicator.classList.add('hidden');
    }

    endGame() {
        this.isRunning = false;

        // Clear timers
        clearInterval(this.gameTimer);
        clearTimeout(this.spawnInterval);
        clearTimeout(this.comboTimeout);

        // Clear remaining mosquitoes
        this.mosquitoes.forEach(data => {
            if (data.element.parentNode) {
                data.element.remove();
            }
        });
        this.mosquitoes = [];

        // Play game over sound
        soundManager.playGameOver();

        // Check high score
        const isNewHighscore = this.score > this.highscore;
        if (isNewHighscore) {
            this.highscore = this.score;
            this.saveHighscore(this.score);
        }

        // Add to leaderboard
        const rank = leaderboard.addScore(this.score, this.walletAddress, this.username, {
            tapped: this.tappedCount,
            bestCombo: this.bestCombo,
        });

        // Get achievement tier
        const achievement = leaderboard.getAchievementTier(this.score);

        // Update game over screen
        this.finalScoreEl.textContent = this.score;
        this.tappedCountEl.textContent = this.tappedCount;
        this.escapedCountEl.textContent = this.escapedCount;
        this.bestComboEl.textContent = `x${this.bestCombo || 1}`;

        // Update achievement badge
        this.achievementIcon.textContent = this.getAchievementIcon(achievement.tier);
        this.achievementName.textContent = achievement.name;
        this.achievementName.style.color = achievement.color;
        this.achievementBadge.style.borderColor = achievement.color;

        // Update rank display
        if (rank > 0) {
            this.rankDisplay.classList.remove('hidden');
            this.playerRank.textContent = rank;
        } else {
            this.rankDisplay.classList.add('hidden');
        }

        if (isNewHighscore && this.score > 0) {
            this.newHighscoreEl.classList.remove('hidden');
        } else {
            this.newHighscoreEl.classList.add('hidden');
        }

        // Update leaderboard display
        this.renderLeaderboard();

        // Update mint button visibility
        this.updateMintButton();

        // Show game over screen
        setTimeout(() => {
            this.gameOverScreen.classList.remove('hidden');
        }, 500);
    }

    getAchievementIcon(tier) {
        const icons = {
            legendary: '🏆',
            epic: '💎',
            rare: '⭐',
            uncommon: '🎖️',
            common: '🥉',
        };
        return icons[tier] || '🎖️';
    }

    renderLeaderboard() {
        const entries = leaderboard.getAll();

        if (entries.length === 0) {
            this.leaderboardList.innerHTML = '<div class="leaderboard-entry">No scores yet!</div>';
            return;
        }

        this.leaderboardList.innerHTML = entries.map((entry, index) => {
            const isCurrentPlayer = entry.address === this.walletAddress ||
                (entry.timestamp && Date.now() - entry.timestamp < 1000);

            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';

            return `
                <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
                    <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
                    <span class="leaderboard-name">${entry.displayAddress}</span>
                    <span class="leaderboard-score">${entry.score}</span>
                </div>
            `;
        }).join('');
    }

    // Share score to Farcaster
    async shareScore() {
        const achievement = leaderboard.getAchievementTier(this.score);

        const text = `🦟 I scored ${this.score} points in Tap That Mosquito!\n\n` +
            `${this.getAchievementIcon(achievement.tier)} ${achievement.name}\n` +
            `🎯 Tapped: ${this.tappedCount} | ⚡ Best Combo: x${this.bestCombo || 1}\n\n` +
            `Can you beat my score?`;

        try {
            await sdk.actions.composeCast({
                text,
                embeds: ['https://neon-shuttle.vercel.app'],
            });
        } catch (error) {
            console.error('Share failed:', error);
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(text + '\n\nhttps://neon-shuttle.vercel.app');
                alert('Score copied to clipboard!');
            } catch {
                alert('Could not share. Try again in the Base app!');
            }
        }
    }

    // Toggle sound on/off
    toggleSound() {
        const isMuted = soundManager.toggle();
        this.soundIcon.textContent = isMuted ? '🔇' : '🔊';
        this.soundToggle.classList.toggle('muted', isMuted);
    }

    // Mint achievement NFT
    async mintNFT() {
        if (!this.walletAddress) {
            alert('Please connect your wallet first!');
            return;
        }

        if (this.mintBtn.classList.contains('loading')) {
            return; // Already minting
        }

        try {
            // Get the best tier for current score
            const tier = nftMinter.getBestTierForScore(this.score);
            const tierInfo = nftMinter.getTierInfo(tier);

            // Show loading state
            this.mintBtn.classList.add('loading');
            this.mintBtn.textContent = '⏳ MINTING...';

            // Attempt to mint
            const result = await nftMinter.mintAchievement(tier, this.score);

            // Success!
            this.mintBtn.classList.remove('loading');
            this.mintBtn.classList.add('success');
            this.mintBtn.textContent = '✅ MINTED!';

            // Show success message
            alert(`🎉 Success! You minted a "${tierInfo.name}" NFT!\n\nTransaction: ${result.hash.slice(0, 10)}...`);

            // Disable button after successful mint
            this.mintBtn.disabled = true;

        } catch (error) {
            console.error('Mint failed:', error);

            // Reset button
            this.mintBtn.classList.remove('loading');
            this.mintBtn.textContent = '🎖️ MINT NFT';

            // Show error
            if (error.message.includes('Already claimed')) {
                alert('You already minted this tier! Try to beat your score for a higher tier.');
            } else if (error.message.includes('not available')) {
                alert('NFT minting is not available yet. Contract not deployed.');
            } else if (error.message.includes('rejected')) {
                alert('Transaction was rejected.');
            } else {
                alert(`Minting failed: ${error.message}`);
            }
        }
    }

    // Check if player can mint and show/hide button
    updateMintButton() {
        if (!this.walletAddress || !nftMinter.isAvailable()) {
            this.mintBtn.classList.add('hidden');
            return;
        }

        const tier = nftMinter.getBestTierForScore(this.score);
        const tierInfo = nftMinter.getTierInfo(tier);

        // Show mint button with tier info
        this.mintBtn.classList.remove('hidden');
        this.mintBtn.textContent = `🎖️ MINT ${tierInfo.name.toUpperCase()}`;
    }

    // ============================================
    // VERSUS MODE METHODS
    // ============================================

    showVersusScreen() {
        if (!this.walletAddress) {
            alert('Please connect your wallet first to use Versus mode!');
            return;
        }
        this.startScreen.classList.add('hidden');
        this.versusScreen.classList.remove('hidden');
    }

    hideVersusScreen() {
        this.versusScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
    }

    async createChallenge() {
        const opponentAddress = this.opponentAddressInput.value.trim();

        if (!opponentAddress || !opponentAddress.startsWith('0x') || opponentAddress.length !== 42) {
            alert('Please enter a valid Ethereum address (0x...)');
            return;
        }

        if (opponentAddress.toLowerCase() === this.walletAddress?.toLowerCase()) {
            alert('You cannot challenge yourself!');
            return;
        }

        this.createChallengeBtn.textContent = '⏳ Creating...';
        this.createChallengeBtn.disabled = true;

        try {
            // For demo: simulate challenge creation without actual contract call
            // In production, this would call: await versusManager.createChallenge(opponentAddress);

            this.opponentAddress = opponentAddress;
            this.currentChallengeId = Date.now(); // Simulated challenge ID

            // Show waiting screen
            this.versusScreen.classList.add('hidden');
            this.versusWaiting.classList.remove('hidden');
            document.getElementById('waiting-text').textContent =
                `Waiting for ${this.formatAddress(opponentAddress)}...`;

            // For demo: auto-accept after 2 seconds and start versus game
            setTimeout(() => {
                this.startVersusGame();
            }, 2000);

        } catch (error) {
            console.error('Challenge creation failed:', error);
            alert('Failed to create challenge: ' + error.message);
        } finally {
            this.createChallengeBtn.textContent = 'SEND CHALLENGE';
            this.createChallengeBtn.disabled = false;
        }
    }

    cancelChallenge() {
        this.currentChallengeId = null;
        this.opponentAddress = null;
        this.versusWaiting.classList.add('hidden');
        this.versusScreen.classList.remove('hidden');
    }

    startVersusGame() {
        this.isVersusMode = true;
        this.versusWaiting.classList.add('hidden');
        this.resetGame();
        this.isRunning = true;
        this.startTimers();
        this.spawnMosquito();
        soundManager.playStart();
    }

    startVersusRematch() {
        this.versusResultScreen.classList.add('hidden');
        this.startVersusGame();
    }

    backToMainMenu() {
        this.isVersusMode = false;
        this.currentChallengeId = null;
        this.currentBattleId = null;
        this.opponentAddress = null;
        this.versusResultScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
    }

    // Override endGame for versus mode
    endVersusGame() {
        this.isRunning = false;

        // Clear timers
        clearInterval(this.gameTimer);
        clearTimeout(this.spawnInterval);
        clearTimeout(this.comboTimeout);

        // Clear remaining mosquitoes
        this.mosquitoes.forEach(data => {
            if (data.element.parentNode) {
                data.element.remove();
            }
        });
        this.mosquitoes = [];

        // Simulate opponent score (for demo - in production this comes from chain)
        // Make it competitive but player has ~60% chance to win
        const baseOpponentScore = Math.floor(this.score * (0.6 + Math.random() * 0.6));
        this.opponentScore = Math.max(0, baseOpponentScore);

        // Determine winner
        this.isWinner = this.score > this.opponentScore;

        // Play appropriate sound
        if (this.isWinner) {
            soundManager.playStart(); // Victory sound
        } else {
            soundManager.playGameOver();
        }

        // Update versus result screen
        this.showVersusResult();
    }

    showVersusResult() {
        // Update scores
        this.yourVersusScore.textContent = this.score;
        this.opponentVersusScore.textContent = this.opponentScore;

        // Update title based on win/loss
        if (this.isWinner) {
            this.versusResultTitle.textContent = '🏆 VICTORY!';
            this.versusResultTitle.className = 'versus-result-title victory';
            this.winnerMintSection.classList.remove('hidden');
            this.loserSection.classList.add('hidden');

            // Reset mint button
            this.mintVictoryBtn.textContent = '🏆 MINT VICTORY NFT';
            this.mintVictoryBtn.disabled = false;
            this.mintVictoryBtn.classList.remove('loading', 'success');
        } else {
            this.versusResultTitle.textContent = '😢 DEFEAT';
            this.versusResultTitle.className = 'versus-result-title defeat';
            this.winnerMintSection.classList.add('hidden');
            this.loserSection.classList.remove('hidden');
        }

        // Show result screen
        this.versusResultScreen.classList.remove('hidden');
    }

    async mintVictoryNFT() {
        if (!this.isWinner) {
            alert('Only winners can mint Victory NFTs!');
            return;
        }

        if (this.mintVictoryBtn.classList.contains('loading')) {
            return;
        }

        try {
            this.mintVictoryBtn.classList.add('loading');
            this.mintVictoryBtn.textContent = '⏳ MINTING...';

            // For demo: simulate minting
            // In production: 
            // 1. Call finalizeBattle to record on-chain
            // 2. Call mintVictoryNFT with battleId

            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate tx

            /* Production code:
            const battleResult = await versusManager.finalizeBattle(
                this.currentChallengeId,
                this.score,
                this.opponentScore,
                true // winner is current player
            );
            this.currentBattleId = battleResult.battleId;
            
            const mintResult = await versusManager.mintVictoryNFT(this.currentBattleId);
            */

            this.mintVictoryBtn.classList.remove('loading');
            this.mintVictoryBtn.classList.add('success');
            this.mintVictoryBtn.textContent = '✅ MINTED!';
            this.mintVictoryBtn.disabled = true;

            const victoryInfo = getVictoryTitle(1); // Win streak = 1 for demo
            alert(`🎉 Victory NFT Minted!\n\nTitle: ${victoryInfo.title}\nScore: ${this.score} vs ${this.opponentScore}\n\nYou defeated ${this.formatAddress(this.opponentAddress)}!`);

        } catch (error) {
            console.error('Victory NFT mint failed:', error);
            this.mintVictoryBtn.classList.remove('loading');
            this.mintVictoryBtn.textContent = '🏆 MINT VICTORY NFT';
            alert('Minting failed: ' + error.message);
        }
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
