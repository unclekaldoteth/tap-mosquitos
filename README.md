# Tap That Mosquito

A pixel art arcade game built as a Farcaster Mini App on Base, featuring solo and versus modes with on-chain achievement NFTs.

Tap That Mosquito is a fast-paced tapping game where players score points by eliminating mosquitoes before they escape. Supports wallet integration for leaderboard tracking, achievement NFTs, and a competitive versus mode with on-chain battles.

---

## Why Tap That Mosquito?

- **Fun and Addictive**: Simple mechanics with combo system for competitive gameplay
- **On-Chain Achievements**: Mint ERC-721 NFTs based on your score tier
- **Versus Mode**: Challenge friends to 1v1 battles with winner-takes-all NFT rewards
- **Farcaster Native**: Built as a Mini App for seamless integration with Farcaster ecosystem

---

## Key Features

### For Players
- 60-second timed gameplay with progressive difficulty
- **Swarm Events**: Random bursts of insects with hazards
- **Elite Mosquitoes**: Armored (2-tap), Healer (speed buff), Blink (teleport)
- **Combo Multiplier**: 5 taps = 2x, 10 taps = 3x points
- **Hazard System**: Avoid bees (-50 pts) and skulls (-100 pts)
- Five achievement tiers: Common, Uncommon, Rare, Epic, Legendary
- Global leaderboard with Farcaster username integration
- Sound effects and pixel art aesthetics

### For Competitors
- Create and accept challenges via smart contract
- Victory NFTs for battle winners
- Champion NFT after 5 wins
- Win streak tracking
- Challenge by @username, fid:1234, or 0x address
- Optional notification opt-in for challenge alerts

### For Developers
- Open-source Solidity contracts with OpenZeppelin base
- **Trusted Signer Oracle**: ECDSA signature verification for game results
- On-chain SVG generation for NFT metadata
- Vite development environment
- Farcaster SDK integration
- Paymaster-sponsored minting via `wallet_sendCalls` with fallback paths

---

## Challenge System

| Feature | Description |
|---------|-------------|
| **Swarm Events** | 3 waves at 12s, 28s, 45s with escalating difficulty |
| **Bee Hazard** | Tap = -50 pts, Avoid = +20 pts |
| **Skull Hazard** | Tap = -100 pts, Avoid = +30 pts |
| **Combo Multiplier** | Build up to 3x points with consecutive taps |
| **Strategic Depth** | Balance speed vs. accuracy during swarm chaos |

---

## Viral Mechanics

### Share-to-Boost
Share your score → Get rewards in next game:
- **+5 seconds** bonus time
- **2x multiplier** from the start
- **Hazard immunity** (first hazard blocked)

### Referral System
Invite friends via your unique link:
- Referral code based on Farcaster username (no `@`)
- Friend opens `/?ref=username` link → Both get boosts:
  - **+10 seconds** bonus time
  - **+50 starting points**
  - **2x multiplier** start
- Boosts can stack!

---

## Architecture Overview

### Smart Contracts (Solidity)
- **MosquitoSlayerNFT**
  Achievement NFTs with five tiers based on player scores. Fully on-chain SVG artwork.

- **VersusNFT**
  Challenge system with 1v1 battles. Victory NFTs for winners and Champion NFTs for 5+ wins.

```
tap-that-mosquito/
├── contracts/
│   ├── MosquitoSlayerNFT.sol   # Achievement NFTs
│   ├── VersusNFT.sol           # Versus mode battles
│   └── PrizePool.sol           # Sponsor-funded rewards
├── api/                         # Serverless endpoints (signing, leaderboard, notifications)
├── game.js                      # Main game logic
├── nftMinter.js                 # NFT minting integration
├── versusContract.js            # Versus mode integration
├── leaderboard.js               # Score tracking
├── sponsorManager.js            # Prize pool + sponsor tiers
├── referralManager.js           # Referral tracking
├── shareManager.js              # Share-to-boost flow
├── index.html                   # Game UI
├── style.css                    # Pixel art styling
├── supabaseClient.js            # Supabase client setup
├── scripts/                     # Deploy + admin scripts
└── public/                      # Assets and manifest
```

### Game Features
- Wallet connection via ethers.js
- Farcaster Mini App SDK for context and actions
- Local and on-chain leaderboard tracking
- Real-time combo indicator and sound effects

---

## Live Demo

- https://tap-mosquito.vercel.app

---

## Base Mainnet Deployment

### Smart Contracts on Base Mainnet

| Contract Name | Description |
|--------------|-------------|
| **MosquitoSlayerNFT** | Achievement NFTs with tier-based scoring |
| **VersusNFT** | 1v1 challenge and victory tracking |
| **PrizePool** | Sponsor-funded USDC rewards + sponsor NFTs |

### Deployment Details
- **Network:** Base Mainnet
- **Solidity Version:** 0.8.20
- **OpenZeppelin:** 5.4.0
- **Framework:** Hardhat
- **Addresses:** Update `contract.js`, `versusContract.js`, and `VITE_PRIZE_POOL_ADDRESS` after deploys.

### Addresses

| Contract | Base Mainnet | Base Sepolia |
|---------|--------------|--------------|
| MosquitoSlayerNFT | `0xB7f6D7456837555D7A983f95982cBdb34F102897` | `0x0cb3B5B40491F9c1b5f62Eb1094eF4BAE518a464` |
| VersusNFT | `0x58fA308a7AE80A1bAe56b33183C78B7de092BBf6` | `0x0F48Fd7aAC0A3e4FE75029b618b32a66266666B5` |

### Deployment Notes
- 2026-01-16: VersusNFT redeployed on Base mainnet to snapshot win streak per battle (`battleWinStreak`). New address: `0x58fA308a7AE80A1bAe56b33183C78B7de092BBf6`.

---

## Smart Contract Functions

### MosquitoSlayerNFT

| Function | Description |
|----------|-------------|
| `mintAchievement(tier, score, nonce, signature)` | Mint NFT with backend signature verification |
| `getTierFromScore(score)` | Get tier based on score |
| `getClaimableTiers(player, score)` | Check which tiers player can claim |
| `setTrustedSigner(address)` | Admin: update signer address |
| `generateSVG(tokenId)` | Get on-chain SVG artwork |
| `tokenURI(tokenId)` | Get full token metadata |

### VersusNFT

| Function | Description |
|----------|-------------|
| `createChallenge(opponent)` | Create a new 1v1 challenge |
| `acceptChallenge(challengeId)` | Accept a pending challenge |
| `cancelChallenge(challengeId)` | Cancel a pending challenge |
| `finalizeBattle(..., signature)` | Submit battle results with backend signature |
| `mintVictoryNFT(battleId)` | Mint victory NFT as winner |
| `setTrustedSigner(address)` | Admin: update signer address |
| `mintChampionNFT()` | Mint champion NFT after 5 wins |

### PrizePool

| Function | Description |
|----------|-------------|
| `deposit(amount)` | Sponsor the pool in USDC (min $3) |
| `distribute(week, winners, nonce, signature)` | Signed weekly distribution to top 10 |
| `hasBoostPerk(address)` | Silver+ boost eligibility |
| `canMintSponsorNFT(address)` | Gold+ sponsor NFT eligibility |
| `mintSponsorNFT()` | Mint sponsor NFT (Gold+ only) |
| `setTrustedSigner(address)` | Admin: update signer address |

---

## Wallet Integration

### Browser Wallet
- MetaMask and other injected wallets
- EIP-1193 provider detection

### Farcaster SDK
- Context detection for Mini App environment
- Ready signal for frame loading
- Share actions for social integration
- Quick Auth for seamless Base app wallet access
- Optional notification opt-in for challenge alerts

---

## Quick Start

### Prerequisites
- Node.js 18+
- MetaMask or compatible wallet
- Base Mainnet ETH for gas

### Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev
# Opens at http://localhost:5173

# Build for production
npm run build
```

### Smart Contracts
```bash
# Compile contracts
npx hardhat compile

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.cjs --network baseMainnet

# Deploy all contracts (NFT + PrizePool + Versus)
npx hardhat run scripts/deploy-mainnet-all.cjs --network baseMainnet

# Update trusted signer without redeploy
npx hardhat run scripts/update-nft-signer.cjs --network baseMainnet
```

### Environment Variables
Create a `.env` with the values you need for your environment:

```bash
# Deployment + verification
PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
SIGNER_PRIVATE_KEY=0x...
SIGNER_ADDRESS=0x...

# App config
VITE_PRIZE_POOL_ADDRESS=0x...
VITE_NFT_CONTRACT_ADDRESS=0x...
VITE_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base/...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
NEYNAR_API_KEY=...
```

---

## Tech Stack

### Frontend
- HTML5
- Vanilla JavaScript (ES Modules)
- CSS3 with pixel art fonts
- Vite bundler

### Blockchain
- Solidity 0.8.20
- OpenZeppelin Contracts 5.4.0
- Hardhat
- ethers.js

### Integration
- Farcaster Mini App SDK
- Base Mainnet

---

## Roadmap

### Phase 1 - Core Game (Completed)
- [x] Pixel art game mechanics
- [x] Combo system
- [x] Sound effects
- [x] Local score tracking

### Phase 2 - Wallet Integration (Completed)
- [x] MetaMask connection
- [x] Leaderboard with addresses
- [x] Farcaster username lookup

### Phase 3 - Achievement NFTs (Completed)
- [x] MosquitoSlayerNFT contract
- [x] Five achievement tiers
- [x] On-chain SVG generation
- [x] Mint button integration

### Phase 4 - Versus Mode (Completed)
- [x] VersusNFT contract
- [x] Challenge creation and acceptance
- [x] Victory NFT minting
- [x] Champion NFT system

### Phase 5 - Security and Game Balance (Completed)
- [x] Trusted Signer Oracle for score verification
- [x] ECDSA signature validation on contracts
- [x] Swarm events with progressive difficulty
- [x] Hazard system (bees and skulls)
- [x] Combo multiplier (2x/3x) system
- [x] Avoidance rewards for strategic play

### Phase 6 - Viral Mechanics (Completed)
- [x] Share-to-Boost rewards system
- [x] Referral code generation from wallet
- [x] URL parameter tracking (?ref=CODE)
- [x] Stackable boost rewards
- [x] Referral link in all shares

### Phase 7 - Prize Pool (Completed)
- [x] PrizePool smart contract with USDC
- [x] Sponsor tiers: Bronze $3, Silver $5, Gold $10, Diamond $20
- [x] 90% weekly distribution, 10% rollover
- [x] Signed distribution with trusted signer
- [x] Sponsor NFT for Gold+ donors
- [x] Permanent game boosts for Silver+ sponsors

### Phase 8 - UX Polish and Mainnet (Completed)
- [x] Wallet-gated homepage (game hidden until connected)
- [x] Neon Arcade UI revamp with premium buttons
- [x] Leaderboard modal accessible from homepage
- [x] VersusNFT deployed to Base Mainnet
- [x] Challenge expiration (7-day timeout)
- [x] Username sanitization and leaderboard deduplication
- [x] Normalized wallet address matching
- [x] Improved referral system (username-only codes)
- [x] FID-based notification token storage
- [x] Full Farcaster-based challenge system (create, accept, decline)
- [x] FID and username-based opponent lookup
- [x] Challenge notification opt-in button
- [x] Revamped Challenge Modal with glassmorphism design
- [x] Polished notification status messages

### Phase 9 - Hardcore Mode (In Progress)
- [x] Elite Mosquitoes: Armored (2-tap, +25 pts), Healer (+20% speed buff), Blink (teleport)
- [x] Faster spawn rates (1000ms base, 320ms min)
- [x] Progressive difficulty with extra spawn chances
- [x] Increased swarm counts (7/12/18 per level)
- [x] Improved NFT minting with on-chain tier checks
- [x] Wallet provider improvements with timeout handling
- [x] Paymaster-sponsored minting with `wallet_sendCalls` fallback
- [ ] Daily Jackpot mode with ETH entry fees
- [ ] Streak NFTs for consecutive play
- [ ] Sponsor Bounty Board

---

## Prize Pool

### How It Works
Sponsors deposit USDC to fund weekly rewards for top players.

| Tier | Deposit | Perks |
|------|---------|-------|
| 🥉 Bronze | $3 USDC | Name on Sponsor Wall |
| 🥈 Silver | $5 USDC | + Permanent game boosts (+10s, 2x) |
| 🥇 Gold | $10 USDC | + Exclusive Sponsor NFT |
| 💎 Diamond | $20 USDC | + Featured in winner casts |

### Weekly Distribution (90% paid / 10% rollover)
| Rank | % of Pool |
|------|-----------|
| #1 | 30% |
| #2 | 20% |
| #3 | 12% |
| #4 | 8% |
| #5 | 6% |
| #6 | 5% |
| #7 | 4% |
| #8 | 3% |
| #9 | 1% |
| #10 | 1% |
| Rollover | 10% (remains in pool) |

---

## Contributing

Contributions are welcome. Please fork the repository and submit a pull request.

---

## License

MIT License

---

## Acknowledgments

- OpenZeppelin for secure contract libraries
- Farcaster for Mini App ecosystem
- Base for L2 infrastructure
- Press Start 2P font for pixel art aesthetics
