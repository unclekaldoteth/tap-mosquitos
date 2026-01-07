/* ============================================
   TAP THAT MOSQUITO - GAME LOGIC
   ============================================ */

// Base Mini App SDK
import { sdk } from '@farcaster/miniapp-sdk';
import { ethers } from 'ethers';
import { soundManager } from './sounds.js';
import { leaderboard } from './leaderboard.js';
import { nftMinter } from './nftMinter.js';
import { TIER_INFO, Tier } from './contract.js';
import { versusManager, getVictoryTitle } from './versusContract.js';
import { challengeManager } from './challengeManager.js';
import { shareManager } from './shareManager.js';
import { referralManager } from './referralManager.js';
import { sponsorManager } from './sponsorManager.js';

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
        this.menuBtn = document.getElementById('menu-btn');

        // Leaderboard Modal Elements
        this.leaderboardBtn = document.getElementById('leaderboard-btn');
        this.leaderboardModal = document.getElementById('leaderboard-modal');
        this.closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
        this.homeLeaderboardList = document.getElementById('home-leaderboard-list');

        // Versus mode elements
        this.versusBtn = document.getElementById('versus-btn');
        this.versusScreen = document.getElementById('versus-screen');
        this.versusWaiting = document.getElementById('versus-waiting');
        this.versusResultScreen = document.getElementById('versus-result-screen');
        this.opponentInput = document.getElementById('opponent-username');
        this.createChallengeBtn = document.getElementById('create-challenge-btn');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');
        this.cancelChallengeBtn = document.getElementById('cancel-challenge-btn');
        this.mintVictoryBtn = document.getElementById('mint-victory-btn');
        this.rematchBtn = document.getElementById('rematch-btn');
        this.challengeAnotherBtn = document.getElementById('challenge-another-btn');
        this.versusMenuBtn = document.getElementById('versus-menu-btn');
        this.versusResultTitle = document.getElementById('versus-result-title');
        this.yourVersusScore = document.getElementById('your-versus-score');
        this.opponentVersusScore = document.getElementById('opponent-versus-score');
        this.winnerMintSection = document.getElementById('winner-mint-section');
        this.loserSection = document.getElementById('loser-section');
        this.challengeStatus = document.getElementById('challenge-status');
        this.pendingChallengesList = document.getElementById('pending-challenges');
        this.challengeReceivedModal = document.getElementById('challenge-received-modal');
        this.challengerNameEl = document.getElementById('challenger-name');
        this.acceptChallengeBtn = document.getElementById('accept-challenge-btn');
        this.declineChallengeBtn = document.getElementById('decline-challenge-btn');

        // Wallet status indicator (on start screen)
        this.walletStatus = document.getElementById('wallet-status');
        this.walletStatusIcon = document.getElementById('wallet-status-icon');
        this.walletStatusText = document.getElementById('wallet-status-text');
        this.gameContent = document.getElementById('game-content');

        // Sponsor Wall elements
        this.sponsorWall = document.getElementById('sponsor-wall');
        this.poolBalance = document.getElementById('pool-balance');
        this.sponsorList = document.getElementById('sponsor-list');
        this.becomeSponsorBtn = document.getElementById('become-sponsor-btn');
        this.sponsorModal = document.getElementById('sponsor-modal');
        this.closeSponsorModal = document.getElementById('close-sponsor-modal');
        this.sponsorStatus = document.getElementById('sponsor-status');
        this.tierBtns = document.querySelectorAll('.tier-btn');

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
        this.fid = null;
        this.isConnecting = false;

        // Versus mode state
        this.isVersusMode = false;
        this.currentChallengeId = null;
        this.currentBattleId = null;
        this.opponentAddress = null;
        this.opponentUsername = null;
        this.opponentFid = null;
        this.opponentScore = 0; // Simulated for demo
        this.isWinner = false;
        this.challengeAcceptTimeout = null;
        this.challengePollInterval = null;
        this.pendingChallenges = [];
        this.activePendingChallenge = null;
        this.winStreak = 0;
        this.totalWins = 0;
        this.previousHighscore = this.highscore;

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

        // Challenge system
        this.comboMultiplier = 1;
        this.consecutiveTaps = 0;
        this.isSwarmActive = false;
        this.swarmTimeouts = [];

        // Initialize
        this.init();
    }

    async init() {
        // DEBUG: Log init start to verify debug endpoint works (remove after debugging)
        try {
            await fetch('/api/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'init() started', context: { time: new Date().toISOString() } })
            });
        } catch (e) { /* ignore */ }

        // Signal to Base Mini App that the app is ready to display FIRST
        try {
            sdk.actions.ready();
            console.log('SDK ready signal sent');

            // Set up primary button for start screen
            this.updatePrimaryButton('SOLO GAME', () => this.startGame());
        } catch (e) {
            console.log('SDK ready failed:', e.message);
        }

        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.walletBtn.addEventListener('click', () => this.handleWalletClick());
        this.shareBtn.addEventListener('click', () => this.shareScore());
        this.mintBtn.addEventListener('click', () => this.mintNFT());
        this.soundToggle.addEventListener('click', () => this.toggleSound());
        this.menuBtn.addEventListener('click', () => this.goToMainMenu());

        // Leaderboard modal listeners
        if (this.leaderboardBtn) {
            this.leaderboardBtn.addEventListener('click', () => {
                this.leaderboardModal.classList.remove('hidden');
                this.renderLeaderboard(); // Refresh when opening
            });
        }
        if (this.closeLeaderboardBtn) {
            this.closeLeaderboardBtn.addEventListener('click', () => {
                this.leaderboardModal.classList.add('hidden');
            });
        }

        // Versus mode event listeners
        this.versusBtn.addEventListener('click', () => this.showVersusScreen());
        this.backToMenuBtn.addEventListener('click', () => this.hideVersusScreen());
        this.createChallengeBtn.addEventListener('click', () => this.createChallenge());
        this.cancelChallengeBtn.addEventListener('click', () => this.cancelChallenge());
        this.mintVictoryBtn.addEventListener('click', () => this.mintVictoryNFT());
        this.rematchBtn.addEventListener('click', () => this.startVersusRematch());
        if (this.challengeAnotherBtn) {
            this.challengeAnotherBtn.addEventListener('click', () => this.showVersusScreenFromResult());
        }
        this.versusMenuBtn.addEventListener('click', () => this.backToMainMenu());
        if (this.acceptChallengeBtn) {
            this.acceptChallengeBtn.addEventListener('click', () => this.acceptActiveChallenge());
        }
        if (this.declineChallengeBtn) {
            this.declineChallengeBtn.addEventListener('click', () => this.declineActiveChallenge());
        }

        // Wallet status click handler (on start screen)
        this.walletStatus.addEventListener('click', () => this.handleWalletClick());

        // Prevent context menu on long press (mobile)
        this.playArea.addEventListener('contextmenu', (e) => e.preventDefault());

        // Initialize sound manager
        await soundManager.init();

        // Initialize NFT minter
        await nftMinter.init();

        // Try to auto-connect wallet if in Mini App context
        await this.tryAutoConnect();
        await this.refreshPendingChallenges();
        await this.handleChallengeLink();

        // Sponsor Wall event listeners
        this.becomeSponsorBtn.addEventListener('click', () => this.showSponsorModal());
        this.closeSponsorModal.addEventListener('click', () => this.hideSponsorModal());
        this.tierBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleTierClick(btn.dataset.amount));
        });

        // Load sponsors on init
        this.loadSponsors();

        // Fetch global leaderboard
        await leaderboard.fetchGlobal();

        // Show onboarding for first-time users
        this.initOnboarding();
    }

    initOnboarding() {
        const hasSeenOnboarding = localStorage.getItem('mosquito-onboarding-seen');

        if (!hasSeenOnboarding) {
            this.onboardingModal = document.getElementById('onboarding-modal');
            this.onboardingNextBtn = document.getElementById('onboarding-next-btn');
            this.onboardingSlides = document.querySelectorAll('.onboarding-slide');
            this.onboardingDots = document.querySelectorAll('.onboarding-dots .dot');
            this.currentSlide = 0;

            // Show onboarding modal
            this.onboardingModal.classList.remove('hidden');
            this.startScreen.classList.add('hidden');

            // Handle next button
            this.onboardingNextBtn.addEventListener('click', () => this.nextOnboardingSlide());

            // Handle dot clicks
            this.onboardingDots.forEach(dot => {
                dot.addEventListener('click', () => {
                    this.goToOnboardingSlide(parseInt(dot.dataset.slide));
                });
            });
        }
    }

    nextOnboardingSlide() {
        if (this.currentSlide < 3) {
            this.goToOnboardingSlide(this.currentSlide + 1);
        } else {
            // Last slide - complete onboarding
            this.completeOnboarding();
        }
    }

    goToOnboardingSlide(index) {
        // Update slides
        this.onboardingSlides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        // Update dots
        this.onboardingDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        this.currentSlide = index;

        // Update button text on last slide
        this.onboardingNextBtn.textContent = index === 3 ? 'START' : 'NEXT';
    }

    completeOnboarding() {
        localStorage.setItem('mosquito-onboarding-seen', 'true');
        this.onboardingModal.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
    }

    showSponsorModal() {
        if (!this.walletAddress) {
            this.sponsorStatus.textContent = 'Please connect wallet first!';
            this.sponsorStatus.style.color = '#ff6b6b';
            return;
        }
        this.sponsorModal.classList.remove('hidden');
        this.sponsorStatus.textContent = '';
    }

    hideSponsorModal() {
        this.sponsorModal.classList.add('hidden');
    }

    async handleTierClick(amount) {
        if (!this.walletAddress) {
            this.sponsorStatus.textContent = 'Connect wallet first!';
            return;
        }

        const sponsorReady = await this.initSponsorManager();
        if (!sponsorReady) {
            this.sponsorStatus.textContent = this.sponsorInitError || 'Sponsor system unavailable';
            this.sponsorStatus.style.color = '#ff6b6b';
            return;
        }

        this.sponsorStatus.textContent = 'Processing...';
        this.sponsorStatus.style.color = '#ffd700';

        try {
            await sponsorManager.deposit(parseInt(amount));
            this.sponsorStatus.textContent = '✅ Thank you for sponsoring!';
            this.sponsorStatus.style.color = 'var(--accent)';
            await this.loadSponsors();
            setTimeout(() => this.hideSponsorModal(), 2000);
        } catch (error) {
            this.sponsorStatus.textContent = this.getReadableError(error, 'Sponsor transaction failed.');
            this.sponsorStatus.style.color = '#ff6b6b';
        }
    }

    async loadSponsors() {
        try {
            const balance = await sponsorManager.getPoolBalance();
            this.poolBalance.textContent = `$${balance} Pool`;

            const sponsors = await sponsorManager.getAllSponsors();

            if (sponsors.length === 0) {
                this.sponsorList.innerHTML = '<span class="no-sponsors">Be the first sponsor!</span>';
                return;
            }

            this.sponsorList.innerHTML = sponsors.slice(0, 10).map(s => {
                const tierClass = s.tierName.toLowerCase();
                const tierIcon = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' }[tierClass] || '';
                const name = this.formatAddress(s.address);
                return `<span class="sponsor-badge ${tierClass}">${tierIcon} ${name}</span>`;
            }).join('');
        } catch (error) {
            console.log('Failed to load sponsors:', error.message);
        }
    }

    async tryAutoConnect() {
        try {
            // Check if we're in a Mini App context
            const isInMiniApp = await sdk.isInMiniApp();
            console.log('isInMiniApp:', isInMiniApp);

            if (isInMiniApp) {
                // Get context which includes user info
                const context = await sdk.context;
                console.log('SDK context:', JSON.stringify(context?.user || {}, null, 2));

                // Send to backend for Vercel logs (DEBUG - remove after fixing)
                try {
                    await fetch('/api/debug', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: 'tryAutoConnect SDK context',
                            context: context?.user || {}
                        })
                    });
                } catch (e) { /* ignore */ }

                if (context?.user) {
                    const user = context.user;
                    if (user?.fid) {
                        this.fid = user.fid;
                    }
                    const address = user.connectedAddress || user.wallet?.address || null;

                    // Try multiple sources for username
                    const username = user.username
                        || user.displayName
                        || user.name
                        || (user.fid ? `fid:${user.fid}` : null);

                    console.log('Auto-connect: address=', address, 'username=', username);

                    if (this.isValidAddress(address)) {
                        this.setWalletConnected(address, username);
                    }
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
            this.walletStatusText.textContent = 'Connecting...';

            // Try Quick Auth first (preferred for Base app)
            let connected = false;

            try {
                const isInMiniApp = await sdk.isInMiniApp();
                if (isInMiniApp) {
                    // Use Quick Auth for seamless in-app authentication
                    const { token } = await sdk.quickAuth.getToken();

                    if (token) {
                        // Get user context for address and username
                        const context = await sdk.context;
                        if (context?.user?.fid) {
                            this.fid = context.user.fid;
                        }
                        let address = context?.user?.connectedAddress || context?.user?.wallet?.address || null;

                        // Preserve existing username if context doesn't have one
                        const contextUsername = context?.user?.username || context?.user?.displayName || null;
                        const username = contextUsername || this.username;

                        // Store the auth token for future authenticated requests
                        this.authToken = token;

                        if (!this.isValidAddress(address)) {
                            try {
                                const provider = await sdk.wallet.getEthereumProvider();
                                if (provider?.request) {
                                    const accounts = await provider.request({ method: 'eth_requestAccounts' });
                                    address = accounts?.[0] || null;
                                }
                            } catch (providerError) {
                                console.log('SDK wallet provider unavailable:', providerError.message);
                            }
                        }

                        if (this.isValidAddress(address)) {
                            this.setWalletConnected(address, username);
                            connected = true;
                        }
                    }
                }
            } catch (sdkError) {
                console.log('Quick Auth not available, trying MetaMask...', sdkError.message);
            }

            // Fallback to MetaMask/window.ethereum
            if (!connected && typeof window.ethereum !== 'undefined') {
                try {
                    // Request account access
                    const accounts = await window.ethereum.request({
                        method: 'eth_requestAccounts'
                    });

                    if (accounts && accounts.length > 0) {
                        const address = accounts[0];
                        // Try to get Farcaster username for this address
                        const username = await this.fetchFarcasterUsername(address);
                        this.setWalletConnected(address, username);
                        connected = true;
                    }
                } catch (ethError) {
                    console.error('MetaMask connection failed:', ethError);
                    if (ethError.code === 4001) {
                        // User rejected the request
                        this.showWalletError('Rejected');
                        return;
                    }
                }
            }

            // No wallet available
            if (!connected) {
                alert('No wallet detected. Please install MetaMask or use this app in Farcaster/Warpcast.');
                this.walletText.textContent = '🔗';
                this.walletStatusText.textContent = 'Connect Wallet';
            }

        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.walletText.textContent = '🔗';
            this.walletStatusText.textContent = 'Connect Wallet';

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

        // Initialize referral system with wallet address and username
        referralManager.init(address, null, username);

        // Display username if available, otherwise formatted address
        const displayName = username || this.formatAddress(address);
        this.walletText.textContent = displayName;
        this.walletBtn.title = username ? `@${username} (${address})` : address;

        // Update wallet status indicator on start screen
        this.walletStatus.classList.remove('disconnected');
        this.walletStatus.classList.add('connected');
        this.walletStatusIcon.textContent = '✅';
        this.walletStatusText.textContent = displayName;

        // Show game content (buttons, sponsor wall) after wallet connected
        this.gameContent.classList.remove('hidden');

        // Initialize sponsor manager after wallet connection
        this.initSponsorManager()
            .then((initialized) => {
                if (initialized) {
                    this.loadSponsors();
                }
            })
            .catch((error) => {
                console.log('Sponsor manager init failed:', error.message);
            });

        // Retroactively update usernames in leaderboard for this user
        if (username) {
            leaderboard.updateUsername(address, username);
            this.renderLeaderboard(); // Re-render if looking at it
        }

        this.syncChallengeUser();
        this.refreshPendingChallenges();
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

    getOpponentLabel() {
        if (this.opponentUsername) return `@${this.opponentUsername}`;
        if (this.opponentFid) return `FID ${this.opponentFid}`;
        if (this.opponentAddress) return this.formatAddress(this.opponentAddress);
        return 'opponent';
    }

    parseOpponentInput(input) {
        const trimmed = input.trim();
        if (!trimmed) return null;

        const fidMatch = trimmed.match(/^fid[:\s]*(\d+)$/i);
        if (fidMatch) {
            return { type: 'fid', value: Number.parseInt(fidMatch[1], 10) };
        }

        if (/^\d+$/.test(trimmed)) {
            return { type: 'fid', value: Number.parseInt(trimmed, 10) };
        }

        const addressPattern = /^0x[a-fA-F0-9]{40}$/;
        if (addressPattern.test(trimmed)) {
            return { type: 'address', value: trimmed };
        }

        const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        if (!username) return null;
        return { type: 'username', value: username };
    }

    syncChallengeUser() {
        const fid = this.fid || this.authenticatedFid;
        if (!fid) return;
        challengeManager.setUser(fid, this.username);
    }

    async ensureFarcasterContext() {
        const existingFid = this.fid || this.authenticatedFid;
        if (existingFid) return existingFid;

        try {
            const isInMiniApp = await sdk.isInMiniApp();
            if (!isInMiniApp) return null;
            const context = await sdk.context;
            if (context?.user?.fid) {
                this.fid = context.user.fid;
                if (!this.username) {
                    if (context.user.username) {
                        this.username = context.user.username;
                    } else if (context.user.displayName) {
                        this.username = context.user.displayName;
                    }
                }
                this.syncChallengeUser();
                return this.fid;
            }
        } catch (error) {
            console.log('Failed to load Farcaster context:', error.message);
        }
        return null;
    }

    setChallengeStatus(message, isError = false) {
        if (!this.challengeStatus) return;
        this.challengeStatus.textContent = message || '';
        this.challengeStatus.style.color = isError ? '#ff6b6b' : '';
    }

    getChallengeDisplay(challenge) {
        const raw = typeof challenge?.challenger_username === 'string'
            ? challenge.challenger_username.trim()
            : '';
        if (raw) {
            const cleaned = raw.startsWith('@') ? raw.slice(1) : raw;
            return { label: `@${cleaned}`, name: cleaned };
        }
        if (challenge?.challenger_fid) {
            const fallback = `fid:${challenge.challenger_fid}`;
            return { label: fallback, name: fallback };
        }
        return { label: 'Unknown', name: 'Unknown' };
    }

    async refreshPendingChallenges(focusChallengeId = null) {
        if (!this.pendingChallengesList) return;
        const fid = await this.ensureFarcasterContext();
        if (!fid) {
            this.pendingChallengesList.innerHTML = '<p class="no-challenges">Connect Farcaster to view challenges</p>';
            return;
        }

        this.syncChallengeUser();

        const pending = await challengeManager.getPendingChallenges();
        this.pendingChallenges = pending;

        if (!pending.length) {
            this.pendingChallengesList.innerHTML = '<p class="no-challenges">No pending challenges</p>';
            return;
        }

        this.pendingChallengesList.innerHTML = pending.map(challenge => {
            const display = this.getChallengeDisplay(challenge);
            return `
                <div class="challenge-item" data-challenge-id="${challenge.id}">
                    <span class="challenge-from">${display.label}</span>
                    <button class="accept-btn" data-action="open">VIEW</button>
                </div>
            `;
        }).join('');

        const items = this.pendingChallengesList.querySelectorAll('.challenge-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.challengeId;
                const target = this.pendingChallenges.find(challenge => String(challenge.id) === String(id));
                if (target) {
                    this.openChallengeModal(target);
                }
            });
        });

        if (focusChallengeId) {
            const target = this.pendingChallenges.find(challenge => String(challenge.id) === String(focusChallengeId));
            if (target) {
                this.openChallengeModal(target);
            }
        }
    }

    async handleChallengeLink() {
        const params = new URLSearchParams(window.location.search);
        const challengeId = params.get('challenge');
        if (!challengeId) return;
        await this.refreshPendingChallenges(challengeId);
    }

    openChallengeModal(challenge) {
        if (!challenge || !this.challengeReceivedModal) return;
        this.activePendingChallenge = challenge;
        const display = this.getChallengeDisplay(challenge);
        if (this.challengerNameEl) {
            this.challengerNameEl.textContent = display.name;
        }
        this.challengeReceivedModal.classList.remove('hidden');
    }

    async acceptActiveChallenge() {
        const challenge = this.activePendingChallenge;
        if (!challenge) return;

        try {
            await this.ensureFarcasterContext();
            this.syncChallengeUser();
            await challengeManager.acceptChallenge(challenge.id);

            this.currentChallengeId = challenge.id;
            const rawOpponent = challenge.challenger_username || '';
            this.opponentUsername = rawOpponent ? rawOpponent.replace(/^@/, '') : null;
            this.opponentFid = challenge.challenger_fid || null;
            this.opponentAddress = null;

            this.challengeReceivedModal.classList.add('hidden');
            this.activePendingChallenge = null;

            this.versusScreen.classList.add('hidden');
            this.versusWaiting.classList.add('hidden');
            this.startScreen.classList.add('hidden');

            await this.refreshPendingChallenges();
            this.startVersusGame();
        } catch (error) {
            console.error('Accept challenge failed:', error);
            alert('Failed to accept challenge: ' + error.message);
        }
    }

    async declineActiveChallenge() {
        const challenge = this.activePendingChallenge;
        if (!challenge) return;

        try {
            await this.ensureFarcasterContext();
            this.syncChallengeUser();
            await challengeManager.declineChallenge(challenge.id);
            this.challengeReceivedModal.classList.add('hidden');
            this.activePendingChallenge = null;
            await this.refreshPendingChallenges();
        } catch (error) {
            console.error('Decline challenge failed:', error);
            alert('Failed to decline challenge: ' + error.message);
        }
    }

    isValidAddress(address) {
        return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    clearChallengeTimeout() {
        if (this.challengeAcceptTimeout) {
            clearTimeout(this.challengeAcceptTimeout);
            this.challengeAcceptTimeout = null;
        }
        if (this.challengePollInterval) {
            clearInterval(this.challengePollInterval);
            this.challengePollInterval = null;
        }
    }

    getReadableError(error, fallback) {
        const message = error?.shortMessage || error?.reason || error?.message;
        if (!message) return fallback;
        if (message.includes("Cannot read properties of undefined (reading 'error')")) {
            return 'Wallet provider error. Reconnect your wallet and try again.';
        }
        return message;
    }

    generateNonce() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    showWalletInfo() {
        // Simple alert for now - could be a modal
        alert(`Connected: ${this.walletAddress}`);
    }

    async initSponsorManager() {
        if (sponsorManager.isInitialized) return true;

        this.sponsorInitError = null;
        const prizePoolAddress = import.meta.env.VITE_PRIZE_POOL_ADDRESS;
        if (!prizePoolAddress) {
            this.sponsorInitError = 'Missing VITE_PRIZE_POOL_ADDRESS. Restart the dev server after updating .env.';
            return false;
        }

        let rawProvider = null;
        try {
            rawProvider = await sdk.wallet.getEthereumProvider();
        } catch (sdkError) {
            console.log('Sponsor provider not available via SDK:', sdkError.message);
        }

        if (!rawProvider && typeof window !== 'undefined' && window.ethereum) {
            rawProvider = window.ethereum;
        }

        if (!rawProvider) {
            this.sponsorInitError = 'No wallet provider found. Connect MetaMask or use the mini app wallet.';
            return false;
        }

        try {
            let chainId = null;
            if (rawProvider.request) {
                try {
                    await rawProvider.request({ method: 'eth_requestAccounts' });
                } catch (requestError) {
                    this.sponsorInitError = this.getReadableError(requestError, 'Wallet connection rejected.');
                    return false;
                }

                try {
                    const chainHex = await rawProvider.request({ method: 'eth_chainId' });
                    chainId = chainHex ? parseInt(chainHex, 16) : null;
                } catch (chainError) {
                    this.sponsorInitError = this.getReadableError(chainError, 'Unable to detect network.');
                    return false;
                }
            }
            const provider = new ethers.BrowserProvider(rawProvider);
            if (!chainId) {
                try {
                    const network = await provider.getNetwork();
                    chainId = Number(network.chainId);
                } catch (networkError) {
                    this.sponsorInitError = this.getReadableError(networkError, 'Unable to detect network.');
                    return false;
                }
            }
            if (chainId && chainId !== 8453) {
                this.sponsorInitError = 'Wrong network: switch to Base.';
                return false;
            }
            const initialized = await sponsorManager.init(provider);
            if (!initialized) {
                this.sponsorInitError = 'Sponsor contract not configured. Check VITE_PRIZE_POOL_ADDRESS.';
            }
            return initialized;
        } catch (error) {
            console.log('Sponsor manager init failed:', error?.message || error);
            this.sponsorInitError = this.getReadableError(error, 'Sponsor manager init failed');
            return false;
        }
    }

    showWalletError(message) {
        this.walletText.textContent = '❌';
        setTimeout(() => {
            this.walletText.textContent = '🔗';
        }, 2000);
    }

    // ============================================
    // SDK ACTIONS - MiniKit Integration
    // ============================================

    // Update the native Primary Button
    updatePrimaryButton(text, callback) {
        try {
            sdk.actions.setPrimaryButton({ text }, callback);
            console.log('Primary button set:', text);
        } catch (e) {
            console.log('Primary button not available:', e.message);
        }
    }

    // Hide the native Primary Button
    hidePrimaryButton() {
        try {
            sdk.actions.setPrimaryButton({ text: '', hidden: true }, () => { });
            console.log('Primary button hidden');
        } catch (e) {
            console.log('Hide primary button failed:', e.message);
        }
    }

    // Open native cast composer with prefilled content
    async composeCast(text, embeds = []) {
        try {
            await sdk.actions.composeCast({ text, embeds });
            console.log('Compose cast opened');
            return true;
        } catch (e) {
            console.log('composeCast not available:', e.message);
            // Fallback to URL share
            return false;
        }
    }

    // View a user's profile by FID
    async viewProfile(fid) {
        if (!fid) return;
        try {
            await sdk.actions.viewProfile({ fid });
            console.log('View profile:', fid);
        } catch (e) {
            console.log('viewProfile not available:', e.message);
        }
    }

    // Close the mini app
    async closeMiniApp() {
        try {
            await sdk.actions.close();
            console.log('Mini app closed');
        } catch (e) {
            console.log('close not available:', e.message);
        }
    }

    // Sign In with Farcaster - cryptographic authentication
    async signInWithFarcaster() {
        try {
            const result = await sdk.actions.signIn({
                nonce: this.generateNonce(),
                siweUri: 'https://tap-mosquito.vercel.app',
                domain: 'tap-mosquito.vercel.app'
            });

            if (result) {
                console.log('Signed in with Farcaster:', result.fid);
                // Store authenticated FID
                this.authenticatedFid = result.fid;
                this.fid = result.fid;
                this.authSignature = result.signature;
                this.authMessage = result.message;
                this.syncChallengeUser();
                return result;
            }
            return null;
        } catch (e) {
            console.log('signIn not available:', e.message);
            return null;
        }
    }

    // Add/Save the mini app to user's collection
    async addFrame() {
        try {
            const result = await sdk.actions.addFrame();

            if (result) {
                console.log('Mini app saved! Token:', result.token?.slice(0, 20) + '...');

                // Send token to backend for notifications
                if (result.token) {
                    try {
                        let fid = this.fid || this.authenticatedFid;
                        if (!fid) {
                            try {
                                const isInMiniApp = await sdk.isInMiniApp();
                                if (isInMiniApp) {
                                    const context = await sdk.context;
                                    if (context?.user?.fid) {
                                        fid = context.user.fid;
                                        this.fid = fid;
                                    }
                                }
                            } catch (e) {
                                console.log('Failed to load fid for notifications:', e.message);
                            }
                        }
                        if (!fid) {
                            console.log('Skipping notification token save: missing fid.');
                        } else {
                            const response = await fetch('/api/notification-tokens', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: result.token,
                                    url: result.url || 'https://tap-mosquito.vercel.app',
                                    fid
                                })
                            });
                            if (!response.ok) {
                                const detail = await response.text();
                                console.log('Failed to save notification token:', detail || response.statusText);
                            }
                        }
                    } catch (e) {
                        console.log('Failed to save notification token:', e.message);
                    }
                }
                return true;
            }
            return false;
        } catch (e) {
            console.log('addFrame not available:', e.message);
            return false;
        }
    }

    // ============================================
    // END SDK ACTIONS
    // ============================================

    loadHighscore() {
        return parseInt(localStorage.getItem('mosquito-highscore')) || 0;
    }

    saveHighscore(score) {
        localStorage.setItem('mosquito-highscore', score.toString());
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.resetGame();
        this.applyShareBoosts();
        this.isRunning = true;
        this.startTimers();
        this.spawnMosquito();
        soundManager.playStart();

        // Hide primary button during gameplay
        this.hidePrimaryButton();
    }

    restartGame() {
        this.gameOverScreen.classList.add('hidden');
        this.resetGame();
        this.applyShareBoosts();
        this.isRunning = true;
        this.startTimers();
        this.spawnMosquito();
        soundManager.playStart();
    }

    applyShareBoosts() {
        // Check for share boost first
        const shareBoost = shareManager.consumeBoost();
        if (shareBoost) {
            this.timeLeft += shareBoost.bonusTime;
            this.comboMultiplier = shareBoost.startMultiplier;
            this.consecutiveTaps = 5;
            this.hazardImmunity = shareBoost.hazardImmunity;
            this.timerEl.textContent = this.timeLeft;
            this.showMultiplier();
            this.showBoostNotification('share');
        }

        // Check for referral boost (can stack!)
        const refBoost = referralManager.consumeReferralBoost();
        if (refBoost) {
            this.timeLeft += refBoost.bonusTime;       // +10 seconds
            this.score += refBoost.bonusPoints;         // +50 starting points
            if (!shareBoost) {
                this.comboMultiplier = refBoost.startMultiplier;
                this.consecutiveTaps = 5;
            }
            this.timerEl.textContent = this.timeLeft;
            this.scoreEl.textContent = this.score;
            this.showMultiplier();
            this.showBoostNotification('referral');
        }

        // Check for sponsor perk (Silver+ = permanent boost!)
        this.applySponsorPerk();
    }

    async applySponsorPerk() {
        if (!this.walletAddress) return;

        try {
            const hasPerk = await sponsorManager.hasBoostPerk(this.walletAddress);
            if (hasPerk) {
                // Silver+ sponsors always get boosts
                this.timeLeft += 10;                   // +10 seconds
                this.comboMultiplier = Math.max(this.comboMultiplier, 2);
                this.consecutiveTaps = Math.max(this.consecutiveTaps, 5);
                this.timerEl.textContent = this.timeLeft;
                this.showMultiplier();
                this.showBoostNotification('sponsor');
            }
        } catch (error) {
            console.log('Sponsor perk check failed:', error.message);
        }
    }

    showBoostNotification(type = 'share') {
        const notification = document.createElement('div');
        notification.className = `boost-notification ${type}`;

        if (type === 'referral') {
            notification.innerHTML = `
                <div class="boost-title">🔗 REFERRAL BONUS!</div>
                <div class="boost-items">
                    <span>+10s</span>
                    <span>+50 pts</span>
                    <span>2x Start</span>
                </div>
            `;
        } else if (type === 'sponsor') {
            notification.innerHTML = `
                <div class="boost-title">🏆 SPONSOR PERK!</div>
                <div class="boost-items">
                    <span>+10s</span>
                    <span>2x Start</span>
                    <span>Forever!</span>
                </div>
            `;
        } else {
            notification.innerHTML = `
                <div class="boost-title">🚀 SHARE BOOST!</div>
                <div class="boost-items">
                    <span>+5s</span>
                    <span>2x Start</span>
                    <span>🛡️ Immunity</span>
                </div>
            `;
        }

        this.playArea.appendChild(notification);
        setTimeout(() => notification.remove(), 2500);
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

        // Reset challenge system
        this.comboMultiplier = 1;
        this.consecutiveTaps = 0;
        this.isSwarmActive = false;
        this.hazardImmunity = 0;
        this.swarmTimeouts.forEach(t => clearTimeout(t));
        this.swarmTimeouts = [];

        // Clear play area
        this.playArea.innerHTML = '';

        // Update display
        this.scoreEl.textContent = '0';
        this.timerEl.textContent = '60';
        this.timerEl.classList.remove('timer-warning');
        this.hideCombo();
        this.hideMultiplier();
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

        // Schedule swarm events (2-3 random times during game)
        this.scheduleSwarmEvents();
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

    // ============ SWARM EVENT SYSTEM ============

    scheduleSwarmEvents() {
        // Schedule 3 swarm events at fixed times with progressive difficulty
        const swarmTimes = [
            { time: 12, level: 1 },  // Early game: smaller swarm
            { time: 28, level: 2 },  // Mid game: medium swarm
            { time: 45, level: 3 },  // Late game: large swarm
        ];

        for (const swarm of swarmTimes) {
            const delay = (swarm.time + Math.random() * 3) * 1000;
            const timeout = setTimeout(() => this.triggerSwarm(swarm.level), delay);
            this.swarmTimeouts.push(timeout);
        }
    }

    triggerSwarm(level = 1) {
        if (!this.isRunning) return;

        this.isSwarmActive = true;
        this.currentSwarmLevel = level;
        this.showSwarmWarning(level);
        soundManager.playWarning();

        // Progressive spawn count based on level
        const spawnCounts = { 1: 6, 2: 10, 3: 15 };
        const count = spawnCounts[level] + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.isRunning) {
                    this.spawnMosquito(true, level);
                }
            }, i * 100);
        }

        // End swarm after 4 seconds
        setTimeout(() => {
            this.isSwarmActive = false;
        }, 4000);
    }

    showSwarmWarning(level = 1) {
        const warning = document.createElement('div');
        warning.className = `swarm-warning level-${level}`;

        const labels = {
            1: '⚠️ SWARM! ⚠️',
            2: '⚠️ BIG SWARM! ⚠️',
            3: '💀 MEGA SWARM! 💀'
        };
        warning.innerHTML = labels[level] || labels[1];
        this.playArea.appendChild(warning);

        // Flash play area border
        this.playArea.classList.add('swarm-active');

        setTimeout(() => {
            warning.remove();
            this.playArea.classList.remove('swarm-active');
        }, 2000);
    }

    // ============ SPAWN MOSQUITO (with hazard support) ============

    spawnMosquito(isSwarm = false, swarmLevel = 1) {
        if (!this.isRunning) return;

        // Determine insect type with progressive hazard chance
        let type = 'normal';
        if (isSwarm) {
            // Hazard chance increases with swarm level: 15%, 25%, 35%
            const hazardChance = 0.1 + (swarmLevel * 0.08);
            if (Math.random() < hazardChance) {
                type = Math.random() < 0.3 ? 'skull' : 'bee';
            }
        }

        const mosquito = document.createElement('div');
        mosquito.className = `mosquito mosquito-${type}`;
        mosquito.dataset.type = type;

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

        // Calculate speed based on difficulty (hazards slightly faster)
        const elapsed = 60 - this.timeLeft;
        const difficultyFactor = Math.min(elapsed / 60, 1);
        const speedRange = this.mosquitoSpeed.max - this.mosquitoSpeed.min;
        let duration = this.mosquitoSpeed.max - speedRange * difficultyFactor * 0.5;
        if (type !== 'normal') {
            duration *= 0.85; // Hazards are 15% faster
        }
        const actualDuration = duration + Math.random() * 1000;

        // Animate movement
        const startTime = Date.now();
        const mosquitoData = {
            element: mosquito,
            startX, startY, endX, endY,
            duration: actualDuration,
            startTime,
            tapped: false,
            type: type
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
        const type = data.type || 'normal';

        // Handle hazard taps (bee or skull)
        if (type === 'bee' || type === 'skull') {
            const penalty = type === 'skull' ? -100 : -50;
            this.handleHazardTap(data, penalty);
            return;
        }

        // Normal mosquito tap
        this.tappedCount++;
        this.consecutiveTaps++;

        // Update combo multiplier based on consecutive taps
        this.updateComboMultiplier();

        // Calculate combo for visual effects
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

        // Calculate score with new multiplier system
        const basePoints = 10;
        const points = basePoints * this.comboMultiplier;

        this.score += points;
        this.scoreEl.textContent = this.score;

        // Show effects
        this.showSplatEffect(data.element);
        this.showScorePopup(data.element, points, this.comboMultiplier > 1);

        // Play sounds
        soundManager.playSplat();
        if (this.currentCombo >= 2) {
            soundManager.playCombo(this.currentCombo);
        }

        if (this.currentCombo >= 2) {
            this.showCombo(this.currentCombo);
        }

        // Show multiplier badge
        this.showMultiplier();

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

    handleHazardTap(data, penalty) {
        // Check for hazard immunity from share boost
        if (this.hazardImmunity && this.hazardImmunity > 0) {
            this.hazardImmunity--;
            this.showImmunityBlock(data.element);

            // Remove hazard without penalty
            data.element.classList.add('blocked');
            setTimeout(() => {
                if (data.element.parentNode) {
                    data.element.remove();
                }
                this.removeMosquitoData(data);
            }, 300);
            return;
        }

        // Apply penalty (no immunity)
        this.score = Math.max(0, this.score + penalty);
        this.scoreEl.textContent = this.score;

        // Reset combo multiplier
        this.consecutiveTaps = 0;
        this.comboMultiplier = 1;
        this.currentCombo = 0;
        this.hideCombo();
        this.hideMultiplier();

        // Show penalty effect
        this.showPenaltyEffect(data.element, penalty);

        // Play buzz sound
        soundManager.playWarning();

        // Animate shake and remove
        data.element.classList.add('hazard-tapped');
        setTimeout(() => {
            if (data.element.parentNode) {
                data.element.remove();
            }
            this.removeMosquitoData(data);
        }, 300);
    }

    showImmunityBlock(element) {
        const popup = document.createElement('div');
        popup.className = 'score-popup immunity';
        popup.textContent = '🛡️ BLOCKED!';

        const rect = element.getBoundingClientRect();
        const areaRect = this.playArea.getBoundingClientRect();

        popup.style.left = `${rect.left - areaRect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - areaRect.top}px`;

        this.playArea.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    updateComboMultiplier() {
        if (this.consecutiveTaps >= 10) {
            this.comboMultiplier = 3;
        } else if (this.consecutiveTaps >= 5) {
            this.comboMultiplier = 2;
        } else {
            this.comboMultiplier = 1;
        }
    }

    showPenaltyEffect(element, penalty) {
        const popup = document.createElement('div');
        popup.className = 'score-popup penalty';
        popup.textContent = `${penalty}`;

        const rect = element.getBoundingClientRect();
        const areaRect = this.playArea.getBoundingClientRect();

        popup.style.left = `${rect.left - areaRect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - areaRect.top}px`;

        this.playArea.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    showMultiplier() {
        let badge = document.getElementById('multiplier-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'multiplier-badge';
            badge.className = 'multiplier-badge';
            this.playArea.appendChild(badge);
        }

        if (this.comboMultiplier > 1) {
            badge.textContent = `${this.comboMultiplier}x`;
            badge.className = `multiplier-badge x${this.comboMultiplier}`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    hideMultiplier() {
        const badge = document.getElementById('multiplier-badge');
        if (badge) {
            badge.classList.add('hidden');
        }
    }

    mosquitoEscaped(data) {
        if (data.tapped) return;

        const type = data.type || 'normal';

        // Normal mosquito escape = penalty (reset multiplier)
        if (type === 'normal') {
            this.escapedCount++;

            // Reset combo multiplier when you miss a normal mosquito
            this.consecutiveTaps = 0;
            this.comboMultiplier = 1;
            this.hideMultiplier();
        }
        // Hazard escape = REWARD for resisting temptation!
        else if (type === 'bee' || type === 'skull') {
            const bonus = type === 'skull' ? 30 : 20;
            this.score += bonus;
            this.scoreEl.textContent = this.score;

            // Show bonus popup
            this.showAvoidanceBonus(data.element, bonus);
        }

        if (data.element.parentNode) {
            data.element.remove();
        }
        this.removeMosquitoData(data);
    }

    showAvoidanceBonus(element, bonus) {
        const popup = document.createElement('div');
        popup.className = 'score-popup avoidance';
        popup.textContent = `+${bonus} 🛡️`;

        const rect = element.getBoundingClientRect();
        const areaRect = this.playArea.getBoundingClientRect();

        popup.style.left = `${rect.left - areaRect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - areaRect.top}px`;

        this.playArea.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
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

    async endGame() {
        try {
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
            const previousBest = this.previousHighscore;
            if (isNewHighscore) {
                this.previousHighscore = this.score;
                this.highscore = this.score;
                this.saveHighscore(this.score);
            }

            // Add to leaderboard (async, with fallback)
            let rank = -1;
            try {
                rank = await leaderboard.addScore(this.score, this.walletAddress, this.username, {
                    tapped: this.tappedCount,
                    bestCombo: this.bestCombo,
                });
            } catch (error) {
                console.error('Failed to save score to leaderboard:', error);
            }

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
            this.gameOverScreen.classList.remove('hidden');

            // Show Primary Button for Play Again
            this.updatePrimaryButton('PLAY AGAIN', () => this.restartGame());

            // Track game played for first game detection
            const isFirstGame = shareManager.isFirstGame();
            if (isFirstGame) {
                referralManager.onFirstGameComplete();
            }
            shareManager.trackGamePlayed();

            // Prompt contextual shares (don't await, let it run async)
            this.promptContextualShares({
                isFirstGame,
                isNewHighscore,
                previousBest,
                rank,
                achievement
            });

        } catch (error) {
            console.error('endGame error:', error);
            // Log error to backend for debugging
            try {
                await fetch('/api/debug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'endGame ERROR',
                        context: { error: error.message, stack: error.stack }
                    })
                });
            } catch (e) { /* ignore */ }

            // Force show game over screen even on error
            this.gameOverScreen.classList.remove('hidden');
        }
    }

    // Prompt contextual share options based on achievements
    async promptContextualShares({ isFirstGame, isNewHighscore, previousBest, rank, achievement }) {
        // Priority: First Game > New High Score > Leaderboard Rank
        if (isFirstGame && this.score > 0) {
            // Prompt first game share after a short delay
            setTimeout(() => {
                if (confirm('Great first game! Want to share your score and challenge friends?')) {
                    shareManager.shareFirstGame({
                        score: this.score,
                        combo: this.bestCombo || 1
                    });
                }
            }, 1500);
        } else if (isNewHighscore && this.score >= 100) {
            // Store for share button - will offer specific high score share
            this.pendingHighScoreShare = {
                score: this.score,
                previousBest,
                combo: this.bestCombo || 1,
                tierName: achievement.name
            };
        } else if (rank > 0 && rank <= 10) {
            // Store for share button - will offer leaderboard rank share  
            this.pendingRankShare = {
                rank,
                score: this.score
            };
        }
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

    // Get approximate rarity percentage for tier
    getTierRarity(tier) {
        const rarities = {
            4: '0.1',  // Legendary
            3: '1',    // Epic  
            2: '5',    // Rare
            1: '15',   // Uncommon
            0: null    // Common (no rarity display)
        };
        return rarities[tier] || null;
    }

    renderLeaderboard() {
        const entries = leaderboard.getAll();

        // Render to Game Over leaderboard
        this.renderLeaderboardList(this.leaderboardList, entries);

        // Render to Homepage leaderboard
        this.renderLeaderboardList(this.homeLeaderboardList, entries);
    }

    renderLeaderboardList(container, entries) {
        if (!container) return;

        if (entries.length === 0) {
            container.innerHTML = '<div class="leaderboard-entry">No scores yet!</div>';
            return;
        }

        const currentAddress = this.walletAddress?.toLowerCase();
        container.innerHTML = entries.map((entry, index) => {
            const entryAddress = entry.address ? entry.address.toLowerCase() : null;
            const isCurrentPlayer = (currentAddress && entryAddress && entryAddress === currentAddress) ||
                (entry.timestamp && Date.now() - entry.timestamp < 1000);

            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';

            // Use username if available, otherwise format address
            // Fix for old entries that might have "Connected" stored
            let nameDisplay = entry.username;

            // Fallback: If this is the current user and we know their username, use it!
            if ((!nameDisplay || nameDisplay === 'Connected') &&
                currentAddress &&
                entryAddress &&
                entryAddress === currentAddress &&
                this.username) {
                nameDisplay = this.username;
            }

            if (!nameDisplay || nameDisplay === 'Connected') {
                nameDisplay = entry.address && entry.address !== 'Anonymous'
                    ? this.formatAddress(entry.address)
                    : '???';
            }

            // Add data-fid for profile viewing if available
            const fidAttr = entry.fid ? `data-fid="${entry.fid}"` : '';
            const clickableClass = entry.fid ? 'clickable' : '';

            return `
                <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
                    <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
                    <span class="leaderboard-name ${clickableClass}" ${fidAttr}>${nameDisplay}</span>
                    <span class="leaderboard-score">${entry.score}</span>
                </div>
            `;
        }).join('');

        // Add click handlers for viewing profiles
        container.querySelectorAll('.leaderboard-name.clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                const fid = parseInt(e.target.dataset.fid);
                if (fid) this.viewProfile(fid);
            });
        });
    }



    // Share score to Farcaster with contextual options
    async shareScore() {
        const achievement = leaderboard.getAchievementTier(this.score);

        // Check for pending contextual shares
        if (this.pendingHighScoreShare) {
            await shareManager.shareNewHighScore(this.pendingHighScoreShare);
            this.pendingHighScoreShare = null;
            return;
        }

        if (this.pendingRankShare) {
            await shareManager.shareLeaderboardRank(this.pendingRankShare);
            this.pendingRankShare = null;
            return;
        }

        // Default share content
        const text = `🦟 I scored ${this.score} points in Tap That Mosquito!

${achievement.name} Tier
Tapped: ${this.tappedCount} | Best Combo: x${this.bestCombo || 1}

Can you beat my score?`;

        await shareManager.share(text);
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
            alert(`Success! You minted a "${tierInfo.name}" NFT!\n\nTransaction: ${result.hash.slice(0, 10)}...`);

            // Disable button after successful mint
            this.mintBtn.disabled = true;

            // Prompt to share achievement
            setTimeout(() => {
                if (confirm('Share your achievement on Farcaster?')) {
                    const tierRarity = this.getTierRarity(tier);
                    shareManager.shareAchievementMint({
                        tierName: tierInfo.name,
                        score: this.score,
                        tierRarity
                    });
                }
            }, 500);

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
        this.clearChallengeTimeout();
        this.isVersusMode = false;
        this.startScreen.classList.add('hidden');
        this.versusResultScreen.classList.add('hidden');
        this.versusScreen.classList.remove('hidden');
        this.refreshPendingChallenges();
    }

    hideVersusScreen() {
        this.clearChallengeTimeout();
        this.versusScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
    }

    async createChallenge() {
        const opponentInput = this.opponentInput?.value.trim() || '';
        const parsedOpponent = this.parseOpponentInput(opponentInput);

        if (!parsedOpponent) {
            alert('Please enter a valid username (e.g. @vitalik), FID (fid:1234 or 1234), or Ethereum address (0x...)');
            return;
        }

        if (parsedOpponent.type === 'address') {
            if (parsedOpponent.value.toLowerCase() === this.walletAddress?.toLowerCase()) {
                alert('You cannot challenge yourself!');
                return;
            }
        } else if (parsedOpponent.type === 'fid') {
            const selfFid = Number.parseInt(this.fid || this.authenticatedFid, 10);
            if (Number.isFinite(selfFid) && parsedOpponent.value === selfFid) {
                alert('You cannot challenge yourself!');
                return;
            }
        } else if (parsedOpponent.type === 'username' && this.username) {
            const normalizedSelf = this.username.replace('@', '').toLowerCase();
            if (parsedOpponent.value.toLowerCase() === normalizedSelf) {
                alert('You cannot challenge yourself!');
                return;
            }
        }

        this.createChallengeBtn.textContent = '⏳ Creating...';
        this.createChallengeBtn.disabled = true;

        try {
            this.setChallengeStatus('', false);

            const fid = await this.ensureFarcasterContext();
            if (!fid) {
                this.setChallengeStatus('Open in Farcaster to send challenges.', true);
                return;
            }

            let opponentUsername = null;
            let opponentFid = null;
            if (parsedOpponent.type === 'address') {
                opponentUsername = await this.fetchFarcasterUsername(parsedOpponent.value);
                if (!opponentUsername) {
                    this.setChallengeStatus('No Farcaster username found for that address.', true);
                    return;
                }
            } else if (parsedOpponent.type === 'fid') {
                opponentFid = parsedOpponent.value;
            } else {
                opponentUsername = parsedOpponent.value;
            }

            this.syncChallengeUser();
            const challenge = await challengeManager.createChallenge({
                opponentUsername,
                opponentFid
            });

            this.opponentAddress = parsedOpponent.type === 'address' ? parsedOpponent.value : null;
            const rawOpponent = challenge.opponent_username || opponentUsername || '';
            this.opponentUsername = rawOpponent ? rawOpponent.replace(/^@/, '') : null;
            this.opponentFid = challenge.opponent_fid || opponentFid || null;
            this.currentChallengeId = challenge.id;

            // Show waiting screen
            this.versusScreen.classList.add('hidden');
            this.versusWaiting.classList.remove('hidden');
            document.getElementById('waiting-text').textContent =
                `Waiting for ${this.getOpponentLabel()} to accept...`;

            this.startChallengePolling();
            const statusLabel = opponentUsername ? `@${opponentUsername}` : `FID ${opponentFid}`;
            this.setChallengeStatus(`Challenge sent to ${statusLabel}`, false);

            // Prompt to share challenge issued
            const opponentName = this.getOpponentLabel();
            if (confirm('Share this challenge on Farcaster to hype up the battle?')) {
                shareManager.shareChallengeIssued({ opponentName });
            }

        } catch (error) {
            console.error('Challenge creation failed:', error);
            this.setChallengeStatus(error.message || 'Failed to create challenge', true);
            alert('Failed to create challenge: ' + error.message);
        } finally {
            this.createChallengeBtn.textContent = 'SEND CHALLENGE';
            this.createChallengeBtn.disabled = false;
        }
    }

    startChallengePolling() {
        if (!this.currentChallengeId) return;
        this.clearChallengeTimeout();
        this.challengePollInterval = setInterval(async () => {
            try {
                const active = await challengeManager.getActiveChallenge();
                if (!active || String(active.id) !== String(this.currentChallengeId)) return;
                if (this.versusWaiting.classList.contains('hidden')) return;
                this.clearChallengeTimeout();
                this.startVersusGame();
            } catch (error) {
                console.log('Challenge polling failed:', error.message);
            }
        }, 3000);
    }

    cancelChallenge() {
        this.clearChallengeTimeout();
        this.currentChallengeId = null;
        this.opponentAddress = null;
        this.opponentUsername = null;
        this.opponentFid = null;
        this.versusWaiting.classList.add('hidden');
        this.versusScreen.classList.remove('hidden');
        this.setChallengeStatus('', false);
    }

    startVersusGame() {
        this.clearChallengeTimeout();
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

    showVersusScreenFromResult() {
        this.clearChallengeTimeout();
        this.isVersusMode = false;
        this.currentChallengeId = null;
        this.currentBattleId = null;
        this.opponentAddress = null;
        this.opponentUsername = null;
        this.opponentFid = null;
        this.versusResultScreen.classList.add('hidden');
        this.startScreen.classList.add('hidden');
        this.versusScreen.classList.remove('hidden');
    }

    // Go to main menu from game over screen
    goToMainMenu() {
        this.clearChallengeTimeout();
        this.gameOverScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
        this.loadSponsors(); // Refresh sponsors
    }

    backToMainMenu() {
        this.clearChallengeTimeout();
        this.isVersusMode = false;
        this.currentChallengeId = null;
        this.currentBattleId = null;
        this.opponentAddress = null;
        this.opponentUsername = null;
        this.opponentFid = null;
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

        // Update win tracking
        if (this.isWinner) {
            this.winStreak++;
            this.totalWins++;
        } else {
            this.winStreak = 0;
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
            this.mintVictoryBtn.textContent = '\u2705 MINTED!';
            this.mintVictoryBtn.disabled = true;

            const victoryInfo = getVictoryTitle(this.winStreak);
            alert(`Victory NFT Minted!\n\nTitle: ${victoryInfo.title}\nScore: ${this.score} vs ${this.opponentScore}\n\nYou defeated ${this.getOpponentLabel()}!`);

            // Prompt to share victory
            setTimeout(() => {
                if (confirm('Share your victory on Farcaster?')) {
                    const opponentName = this.getOpponentLabel();

                    shareManager.shareVersusVictory({
                        myScore: this.score,
                        opponentScore: this.opponentScore,
                        opponentName,
                        winStreak: this.winStreak
                    });
                }

                // Check for Champion NFT eligibility (5+ wins)
                if (this.totalWins >= 5) {
                    setTimeout(() => {
                        if (confirm(`You've won ${this.totalWins} battles! You're eligible for a CHAMPION NFT. Want to claim and share?`)) {
                            shareManager.shareChampionNFT({
                                totalWins: this.totalWins,
                                winStreak: this.winStreak
                            });
                        }
                    }, 1000);
                }
            }, 500);

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
