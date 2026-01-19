# Tap That Mosquito - System Flow

Complete technical flow documentation for the Tap That Mosquito game, including all user journeys, smart contracts, and on-chain interactions.

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Vite + Vanilla JS)"]
        UI[index.html]
        Game[game.js]
        NFTMinter[nftMinter.js]
        VersusManager[versusContract.js]
        GamePassMgr[gamePassManager.js]
        SponsorMgr[sponsorManager.js]
    end

    subgraph Backend["Backend (Vercel Serverless)"]
        SignAPI["/api/sign-achievement.js"]
        ChallengeAPI["/api/challenge.js"]
        LeaderboardAPI["/api/leaderboard.js"]
    end

    subgraph Contracts["Smart Contracts (Base Mainnet)"]
        MosquitoNFT[MosquitoSlayerNFT]
        VersusNFT[VersusNFT]
        PrizePool[PrizePool]
        GamePassNFT[GamePassNFT]
    end

    subgraph External["External Services"]
        Supabase[(Supabase DB)]
        Neynar[Neynar API]
        Farcaster[Farcaster SDK]
    end

    UI --> Game
    Game --> NFTMinter --> MosquitoNFT
    Game --> VersusManager --> VersusNFT
    Game --> GamePassMgr --> GamePassNFT
    Game --> SponsorMgr --> PrizePool
    Game --> SignAPI
    Game --> LeaderboardAPI --> Supabase
    Game --> Neynar
    Game --> Farcaster
```

---

## User Entry Flow

```mermaid
flowchart TD
    Start([User Opens App]) --> CheckOnboarding{First Time?}
    CheckOnboarding -->|Yes| Onboarding[Show Onboarding Slides]
    CheckOnboarding -->|No| HomeScreen
    Onboarding --> HomeScreen[Home Screen]
    
    HomeScreen --> CheckWallet{Wallet Connected?}
    CheckWallet -->|No| ShowConnect[Show Connect Wallet]
    ShowConnect --> WalletClick[User Clicks Connect]
    WalletClick --> TrySDK{In Farcaster?}
    TrySDK -->|Yes| QuickAuth[Quick Auth + SDK Wallet]
    TrySDK -->|No| TryBase[Try Base Account SDK]
    TryBase --> TryMM[Fallback: MetaMask]
    QuickAuth --> Connected
    TryMM --> Connected[Wallet Connected]
    
    CheckWallet -->|Yes| Connected
    Connected --> ShowGameContent[Show Game Content]
    ShowGameContent --> GameOptions{User Choice}
    
    GameOptions --> SoloGame[Solo Game]
    GameOptions --> VersusMode[Versus Mode]
    GameOptions --> Leaderboard[View Leaderboard]
    GameOptions --> GamePass[Mint Game Pass]
    GameOptions --> Sponsor[Become Sponsor]
```

---

## Solo Game Flow

```mermaid
flowchart TD
    Start([Start Solo Game]) --> InitGame[Initialize Game State]
    InitGame --> StartTimer[Start 60s Timer]
    StartTimer --> SpawnLoop[Spawn Mosquitoes Loop]
    
    SpawnLoop --> CheckTime{Time Left?}
    CheckTime -->|Yes| SpawnMosquito[Spawn Mosquito]
    SpawnMosquito --> CheckSwarm{Swarm Event?}
    CheckSwarm -->|Yes| TriggerSwarm[Trigger Swarm Wave]
    CheckSwarm -->|No| SpawnLoop
    TriggerSwarm --> SpawnLoop
    
    CheckTime -->|No| EndGame[Game Over]
    
    subgraph Gameplay["During Game"]
        Tap[User Taps] --> CheckType{What Type?}
        CheckType -->|Mosquito| AddScore["+10-25 pts"]
        CheckType -->|Armored| NeedTwoTaps["2 Taps Required"]
        CheckType -->|Bee| LosePoints["-50 pts"]
        CheckType -->|Skull| LoseBig["-100 pts"]
        AddScore --> UpdateCombo[Update Combo]
        UpdateCombo --> CheckMultiplier{Combo >= 5?}
        CheckMultiplier -->|Yes| ApplyMultiplier["2x or 3x Multiplier"]
    end
    
    EndGame --> SaveScore[Save to Leaderboard]
    SaveScore --> ShowResults[Show Game Over Screen]
    ShowResults --> CheckTier{Score Tier?}
    CheckTier --> ShowBadge[Display Achievement Badge]
    ShowBadge --> Options{User Choice}
    
    Options --> MintNFT[Mint Achievement NFT]
    Options --> ShareScore[Share Score]
    Options --> PlayAgain[Play Again]
    Options --> MainMenu[Back to Menu]
```

---

## Versus Mode Flow

```mermaid
flowchart TD
    Start([Open Versus Mode]) --> Options{Action}
    
    Options --> CreateChallenge[Create Challenge]
    Options --> ViewPending[View Pending Challenges]
    
    subgraph Create["Create Challenge"]
        CreateChallenge --> EnterOpponent[Enter @username or FID]
        EnterOpponent --> LookupUser[Lookup via Neynar API]
        LookupUser --> GetAddress[Get Wallet Address]
        GetAddress --> CallContract[POST /api/challenge?action=create]
        CallContract --> WaitAccept[Wait for Accept]
        WaitAccept --> Notify[Send Notification via Farcaster]
    end
    
    subgraph Accept["Accept Challenge"]
        ViewPending --> SelectChallenge[Select Challenge]
        SelectChallenge --> AcceptBtn[Click Accept]
        AcceptBtn --> CallAccept[POST /api/challenge?action=accept]
        CallAccept --> BothPlay[Both Players Play Game]
    end
    
    BothPlay --> SubmitScores[POST /api/challenge?action=submit]
    SubmitScores --> RecordResult[Backend Records Winner + Notifies]
    RecordResult --> DetermineWinner{Who Won?}
    
    DetermineWinner -->|Winner| ShowVictory[Victory Screen]
    DetermineWinner -->|Loser| ShowDefeat[Defeat Screen]
    
    ShowVictory --> CanMint[Mint Victory NFT (demo)]
    ShowVictory --> CheckStreak{5+ Total Wins?}
    CheckStreak -->|Yes| ChampionNFT[Champion NFT (future)]
```

---

## GamePass P2W Flow

```mermaid
flowchart TD
    Start([GamePass Section]) --> CheckPass{Has GamePass?}
    
    CheckPass -->|No| ShowMint[Show Mint Button]
    ShowMint --> ClickMint[User Clicks Mint]
    ClickMint --> ResolveRef[Resolve referrer (?ref username or 0x)]
    ResolveRef --> Pay["Pay 0.0005 ETH"]
    Pay --> Contract[GamePassNFT.mintGamePass]
    
    subgraph Revenue["Revenue Split"]
        Contract --> Split[Split Payment]
        Split --> Prize["70% → Prize Pool"]
        Split --> Treasury["20% → Treasury"]
        Split --> Referral["10% → Referrer (must hold GamePass) or Treasury"]
    end
    
    Contract --> MintNFT[Mint ERC-721 Token]
    MintNFT --> UpdateUI[Update UI: Pass Owned]
    
    CheckPass -->|Yes| ShowEligible[Show Prize Eligible Badge]
    ShowEligible --> ViewPool[View Prize Pool Balance]
    
    subgraph Weekly["Weekly Distribution"]
        WeekEnd([Week Ends]) --> Backend[Backend Calculates Top 10]
        Backend --> SignDistribution[Sign Distribution]
        SignDistribution --> CallDistribute[distributeWeeklyPrize]
        CallDistribute --> PayWinners[Pay ETH to Winners]
        PayWinners --> RollOver[Unpaid → Next Week Pool]
    end
```

---

## Achievement NFT Minting Flow

```mermaid
flowchart TD
    GameOver([Game Over]) --> CheckScore{Score Tier}
    CheckScore --> Common["0+ = Common"]
    CheckScore --> Uncommon["200+ = Uncommon"]
    CheckScore --> Rare["500+ = Rare"]
    CheckScore --> Epic["1000+ = Epic"]
    CheckScore --> Legendary["2000+ = Legendary"]
    
    Common & Uncommon & Rare & Epic & Legendary --> ShowMintBtn[Show Mint Button]
    ShowMintBtn --> ClickMint[User Clicks Mint]
    ClickMint --> CheckClaimed{Already Claimed Tier?}
    CheckClaimed -->|Yes| ShowError[Already Claimed]
    CheckClaimed -->|No| RequestSig[Request Signature from Backend]
    
    RequestSig --> Backend["/api/sign-achievement.js"]
    Backend --> VerifyScore[Verify Score Valid]
    VerifyScore --> SignMessage[Sign with Trusted Signer]
    SignMessage --> ReturnSig[Return Signature]
    
    ReturnSig --> CallMint[mintAchievement on Contract]
    CallMint --> VerifyOnChain[Contract Verifies Signature]
    VerifyOnChain --> MintToken[Mint ERC-721]
    MintToken --> GenerateSVG[Generate On-Chain SVG]
    MintToken --> EmitEvent[Emit AchievementMinted]
    
    MintToken --> Success[Show Success]
```

---

## Sponsor Flow

```mermaid
flowchart TD
    Start([Click Become Sponsor]) --> ShowTiers[Show Tier Options]
    
    ShowTiers --> Bronze["🥉 Bronze $3"]
    ShowTiers --> Silver["🥈 Silver $5"]
    ShowTiers --> Gold["🥇 Gold $10"]
    ShowTiers --> Diamond["💎 Diamond $20"]
    
    Bronze & Silver & Gold & Diamond --> SelectTier[User Selects Tier]
    SelectTier --> ApproveUSDC[Approve USDC Spend]
    ApproveUSDC --> Deposit[PrizePool.deposit]
    Deposit --> TrackSponsor[Track in Contract]
    
    TrackSponsor --> UpdateWall[Update Sponsor Wall]
    
    subgraph Perks["Sponsor Perks"]
        Silver --> Boost["Permanent Game Boosts"]
        Gold --> SponsorNFT["Mint Sponsor NFT"]
        Diamond --> Featured["Featured in Casts"]
    end
    
    subgraph Distribution["Weekly Distribution"]
        Pool[Prize Pool] --> Calculate["100% Distribute (reserve 0%)"]
        Calculate --> Top10[Pay Top 10 Players]
    end
```

---

## Referral System Flow

```mermaid
flowchart TD
    Start([Share Game]) --> GenerateLink["Generate ?ref=username Link"]
    GenerateLink --> ShareCast[Share on Farcaster]
    
    NewUser([New User Opens Link]) --> ParseRef[Parse ref Parameter]
    ParseRef --> StoreRef[Store Referrer Locally]
    StoreRef --> Connect[User Connects Wallet]
    Connect --> Play[User Plays Game]
    
    subgraph Boosts["Referral Boosts"]
        Play --> ApplyBoost[Apply Referral Boosts]
        ApplyBoost --> BonusTime["+10 seconds"]
        ApplyBoost --> BonusPoints["+50 starting points"]
        ApplyBoost --> BonusMulti["2x multiplier start"]
    end
    
    subgraph GamePass["GamePass Referral"]
        MintPass([Mint GamePass]) --> CheckRef{Resolve Referrer Address?}
        CheckRef -->|Yes| PayRef["10% → Referrer (must hold GamePass)"]
        CheckRef -->|No| ToTreasury["10% → Treasury"]
    end
```

---

## Smart Contract Summary

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| **MosquitoSlayerNFT** | Achievement NFTs | `mintAchievement`, `getClaimableTiers` |
| **VersusNFT** | 1v1 Battles | `createChallenge`, `acceptChallenge`, `finalizeBattle`, `mintVictoryNFT` |
| **PrizePool** | Sponsor Rewards (USDC) | `deposit`, `distribute`, `mintSponsorNFT` |
| **GamePassNFT** | P2W Entry (ETH) | `mintGamePass`, `mintWithReferral`, `distributeWeeklyPrize` |

---

## Security Model

```mermaid
flowchart LR
    subgraph Trusted["Trusted Signer (Backend)"]
        Signer[Private Key]
    end
    
    subgraph Verification["On-Chain Verification"]
        Contract[Smart Contract]
        ECDSA[ECDSA.recover]
    end
    
    Player[Player] --> Backend[Request Signature]
    Backend --> Signer
    Signer --> SignedMsg["Signed Message + Nonce"]
    SignedMsg --> Player
    Player --> Contract
    Contract --> ECDSA
    ECDSA --> Verify{Valid?}
    Verify -->|Yes| Execute[Execute Action]
    Verify -->|No| Reject[Reject Transaction]
```

All score-based actions require backend signature verification to prevent cheating.

---

## Environment Variables

```bash
# Contracts
VITE_NFT_CONTRACT_ADDRESS=0x...      # MosquitoSlayerNFT
VITE_VERSUS_CONTRACT_ADDRESS=0x...   # VersusNFT
VITE_PRIZE_POOL_ADDRESS=0x...        # PrizePool
VITE_GAMEPASS_CONTRACT_ADDRESS=0x... # GamePassNFT

# Backend Signing
SIGNER_PRIVATE_KEY=0x...
SIGNER_ADDRESS=0x...

# External Services
NEYNAR_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Deployment Checklist

- [ ] Deploy GamePassNFT to Base Sepolia
- [ ] Test mint flow with testnet ETH
- [ ] Verify contract on BaseScan
- [ ] Deploy to Base Mainnet
- [ ] Update `.env` with mainnet address
- [ ] Test full flow in production
- [ ] Create weekly distribution cron job
