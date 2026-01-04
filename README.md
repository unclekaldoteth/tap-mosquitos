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
- 60-second timed gameplay with combo multipliers
- Five achievement tiers: Common, Uncommon, Rare, Epic, Legendary
- Global leaderboard with Farcaster username integration
- Sound effects and pixel art aesthetics

### For Competitors
- Create and accept challenges via smart contract
- Victory NFTs for battle winners
- Champion NFT after 5 wins
- Win streak tracking

### For Developers
- Open-source Solidity contracts with OpenZeppelin base
- On-chain SVG generation for NFT metadata
- Vite development environment
- Farcaster SDK integration

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
│   └── VersusNFT.sol           # Versus mode battles
├── game.js                      # Main game logic
├── nftMinter.js                 # NFT minting integration
├── versusContract.js            # Versus mode integration
├── leaderboard.js               # Score tracking
├── index.html                   # Game UI
├── style.css                    # Pixel art styling
└── public/                      # Assets and manifest
```

### Game Features
- Wallet connection via ethers.js
- Farcaster Mini App SDK for context and actions
- Local and on-chain leaderboard tracking
- Real-time combo indicator and sound effects

---

## Live Demo

- https://neon-shuttle.vercel.app

---

## Base Sepolia Deployment

### Smart Contracts on Base Sepolia Testnet

| Contract Name | Description |
|--------------|-------------|
| **MosquitoSlayerNFT** | Achievement NFTs with tier-based scoring |
| **VersusNFT** | 1v1 challenge and victory tracking |

### Deployment Details
- **Network:** Base Sepolia
- **Solidity Version:** 0.8.20
- **OpenZeppelin:** 5.4.0
- **Framework:** Hardhat

---

## Smart Contract Functions

### MosquitoSlayerNFT

| Function | Description |
|----------|-------------|
| `mintAchievement(tier, score)` | Mint NFT for a specific tier |
| `getTierFromScore(score)` | Get tier based on score |
| `getClaimableTiers(player, score)` | Check which tiers player can claim |
| `generateSVG(tokenId)` | Get on-chain SVG artwork |
| `tokenURI(tokenId)` | Get full token metadata |

### VersusNFT

| Function | Description |
|----------|-------------|
| `createChallenge(opponent)` | Create a new 1v1 challenge |
| `acceptChallenge(challengeId)` | Accept a pending challenge |
| `cancelChallenge(challengeId)` | Cancel a pending challenge |
| `finalizeBattle(...)` | Submit battle results |
| `mintVictoryNFT(battleId)` | Mint victory NFT as winner |
| `mintChampionNFT()` | Mint champion NFT after 5 wins |

---

## Wallet Integration

### Browser Wallet
- MetaMask and other injected wallets
- EIP-1193 provider detection
- Automatic network switching to Base Sepolia

### Farcaster SDK
- Context detection for Mini App environment
- Ready signal for frame loading
- Share actions for social integration

---

## Quick Start

### Prerequisites
- Node.js 18+
- MetaMask or compatible wallet
- Base Sepolia testnet ETH

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

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network baseSepolia
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
- Base Sepolia Testnet

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
