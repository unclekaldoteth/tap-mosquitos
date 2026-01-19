import '@coinbase/onchainkit/styles.css';
import { OnchainKitProvider, useOnchainKit } from '@coinbase/onchainkit';
import {
    Wallet,
    ConnectWallet,
    WalletDropdown,
    WalletDropdownFundLink,
    WalletDropdownDisconnect,
    WalletDropdownLink,
    useGetETHBalance,
    useGetTokenBalance
} from '@coinbase/onchainkit/wallet';
import { Identity, Avatar, Name, Address, IdentityCard, EthBalance, Socials } from '@coinbase/onchainkit/identity';
import { Buy } from '@coinbase/onchainkit/buy';
import { Checkout, CheckoutButton, CheckoutStatus } from '@coinbase/onchainkit/checkout';
import { Earn } from '@coinbase/onchainkit/earn';
import { FundCard } from '@coinbase/onchainkit/fund';
import { NFTCard } from '@coinbase/onchainkit/nft';
import { Signature } from '@coinbase/onchainkit/signature';
import { Swap } from '@coinbase/onchainkit/swap';
import { TokenRow } from '@coinbase/onchainkit/token';
import {
    Transaction,
    TransactionButton,
    TransactionStatus
} from '@coinbase/onchainkit/transaction';
import { useAccount } from 'wagmi';
import { base } from 'wagmi/chains';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTRACT_ADDRESSES, MOSQUITO_NFT_ABI, TIER_INFO, getTierFromScore } from './contract.js';

const rootElement = document.getElementById('onchainkit-root');
const BASE_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;
const USDC_BASE_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDC_BASE_SEPOLIA_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const BASE_ETH_TOKEN = {
    address: '',
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    image: null,
    name: 'Ether',
    symbol: 'ETH'
};
const BASE_USDC_TOKEN = {
    address: USDC_BASE_ADDRESS,
    chainId: BASE_CHAIN_ID,
    decimals: 6,
    image: null,
    name: 'USD Coin',
    symbol: 'USDC'
};
const BASE_SEPOLIA_ETH_TOKEN = {
    address: '',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    decimals: 18,
    image: null,
    name: 'Ether',
    symbol: 'ETH'
};
const BASE_SEPOLIA_USDC_TOKEN = {
    address: USDC_BASE_SEPOLIA_ADDRESS,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    decimals: 6,
    image: null,
    name: 'USD Coin',
    symbol: 'USDC'
};

const getTokenConfig = (chainId) => {
    if (chainId === BASE_SEPOLIA_CHAIN_ID) {
        return {
            ethToken: BASE_SEPOLIA_ETH_TOKEN,
            usdcToken: BASE_SEPOLIA_USDC_TOKEN,
            swapFrom: [BASE_SEPOLIA_ETH_TOKEN, BASE_SEPOLIA_USDC_TOKEN],
            swapTo: [BASE_SEPOLIA_USDC_TOKEN, BASE_SEPOLIA_ETH_TOKEN]
        };
    }

    return {
        ethToken: BASE_ETH_TOKEN,
        usdcToken: BASE_USDC_TOKEN,
        swapFrom: [BASE_ETH_TOKEN, BASE_USDC_TOKEN],
        swapTo: [BASE_USDC_TOKEN, BASE_ETH_TOKEN]
    };
};

const onchainkitConfig = {
    appearance: {
        name: 'Tap That Mosquito',
        logo: '/icon.png',
        mode: 'dark',
        theme: 'default'
    },
    paymaster: import.meta.env.VITE_PAYMASTER_URL || null,
    wallet: {
        display: 'modal'
    }
};

const initialMintState = {
    score: null,
    tier: null,
    label: null,
    canMint: false
};

function useGameMintState() {
    const [mintState, setMintState] = useState(initialMintState);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleMintAvailability = (event) => {
            const detail = event?.detail ?? {};
            setMintState({
                score: Number.isFinite(detail.score) ? detail.score : null,
                tier: Number.isFinite(detail.tier) ? detail.tier : null,
                label: typeof detail.label === 'string' ? detail.label : null,
                canMint: Boolean(detail.canMint)
            });
        };

        window.addEventListener('game:mint-availability', handleMintAvailability);
        return () => {
            window.removeEventListener('game:mint-availability', handleMintAvailability);
        };
    }, []);

    return mintState;
}

async function fetchMintSignature(playerAddress, tier, score, nonce) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch('/api/sign-achievement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerAddress, tier, score, nonce }),
            signal: controller.signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Backend signing failed');
        }

        const data = await response.json();
        return data.signature;
    } finally {
        clearTimeout(timeoutId);
    }
}

// GamePass Contract Logic
const GAMEPASS_ADDRESS = '0x050Ac333BE960bDf46Cc09452dA5e800bD8b358a'; // Base Sepolia
const GAMEPASS_ABI = [
    { inputs: [{ name: "account", type: "address" }], name: "hasGamePass", outputs: [{ name: "", type: "bool" }], type: "function", stateMutability: "view" },
    { inputs: [], name: "mintGamePass", outputs: [], type: "function", stateMutability: "payable" }
];

function GamePassDropdownItem() {
    const { address, isConnected } = useAccount();
    const { chain } = useOnchainKit();
    const [hasPass, setHasPass] = useState(false);

    // Simple read to check status
    useEffect(() => {
        if (!address || !isConnected) return;
        // In a real app we'd use useReadContract, but for now we trust the game state or just fetch it
        // Since we don't have direct wagmi read hook setup here easily without ABI import issues, 
        // let's rely on the window.gamePassManager if available or just show the option

        const checkStatus = async () => {
            if (window.gamePassManager) {
                const status = await window.gamePassManager.hasGamePass(address);
                setHasPass(status);
            }
        };
        checkStatus();

        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [address, isConnected]);

    const buildMintCall = useCallback(async () => {
        return [{
            address: GAMEPASS_ADDRESS,
            abi: GAMEPASS_ABI,
            functionName: 'mintGamePass',
            value: 500000000000000n, // 0.0005 ETH
            args: []
        }];
    }, []);

    if (!isConnected) return null;

    if (hasPass) {
        return (
            <div className="onchainkit-dropdown-item" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#00ff88' }}>PREMIUM MEMBER</span>
                    <span style={{ fontSize: '8px', color: '#888' }}>Game Pass Active</span>
                </div>
            </div>
        );
    }

    return (
        <div className="onchainkit-dropdown-item" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <Transaction calls={buildMintCall}>
                <TransactionButton text="MINT GAME PASS (0.0005 ETH)" />
                <TransactionStatus />
            </Transaction>
        </div>
    );
}

function OnchainKitWallet() {
    const { address, isConnected, connector } = useAccount();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const detail = {
            address: address ?? null,
            isConnected: Boolean(isConnected),
            connectorName: connector?.name ?? null
        };
        window.__onchainkitState = detail;
        window.dispatchEvent(new CustomEvent('onchainkit:account', { detail }));
    }, [address, isConnected, connector]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let isActive = true;

        const syncProvider = async () => {
            if (!isConnected || typeof connector?.getProvider !== 'function') {
                window.__onchainkitProvider = null;
                return;
            }
            try {
                const provider = await connector.getProvider();
                if (isActive) {
                    window.__onchainkitProvider = provider ?? null;
                }
            } catch {
                if (isActive) {
                    window.__onchainkitProvider = null;
                }
            }
        };

        syncProvider();

        return () => {
            isActive = false;
        };
    }, [connector, isConnected]);

    const basescanUrl = address
        ? `https://basescan.org/address/${address}`
        : 'https://basescan.org';

    return (
        <div className="onchainkit-panel">
            <Wallet className="onchainkit-wallet">
                <ConnectWallet className="onchainkit-connect" disconnectedLabel="CONNECT WALLET" />
                <WalletDropdown className="onchainkit-dropdown">
                    <Identity className="onchainkit-identity">
                        <Avatar className="onchainkit-avatar" />
                        <Name className="onchainkit-name" />
                        <Address className="onchainkit-address" />
                        <EthBalance className="onchainkit-balance" />
                        <Socials className="onchainkit-socials" />
                    </Identity>

                    {/* Game Pass Integration */}
                    <GamePassDropdownItem />

                    <WalletDropdownFundLink />
                    <WalletDropdownLink href={basescanUrl} target="_blank" rel="noreferrer">
                        View on Basescan
                    </WalletDropdownLink>
                    <WalletDropdownDisconnect />
                </WalletDropdown>
            </Wallet>
        </div>
    );
}

function OnchainKitTokenBalances({ ethToken, usdcToken }) {
    const { address } = useAccount();
    const ethBalance = useGetETHBalance(address);
    const usdcBalance = useGetTokenBalance(address, usdcToken);

    const ethAmount = ethBalance.roundedBalance || undefined;
    const usdcAmount = usdcBalance.roundedBalance || undefined;

    return (
        <div className="onchainkit-token-list">
            <TokenRow token={ethToken} amount={ethAmount} />
            <TokenRow token={usdcToken} amount={usdcAmount} />
        </div>
    );
}

function OnchainKitPlayerSignature() {
    const { address } = useAccount();
    const signatureMessage = useMemo(() => {
        const label = address ? `player ${address}` : 'player';
        return `Tap That Mosquito pledge for ${label}`;
    }, [address]);

    const handleSuccess = useCallback((signature) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('onchainkit:signature', { detail: { signature } }));
    }, []);

    return (
        <Signature
            className="onchainkit-widget"
            message={signatureMessage}
            label="SIGN PLAYER OATH"
            onSuccess={handleSuccess}
        />
    );
}

function OnchainKitArcade() {
    const vaultAddress = import.meta.env.VITE_MORPHO_VAULT_ADDRESS;
    const checkoutProductId = import.meta.env.VITE_CHECKOUT_PRODUCT_ID;
    const showcaseTokenId = import.meta.env.VITE_ACHIEVEMENT_TOKEN_ID;
    const { chain } = useOnchainKit();
    const { chainId } = useAccount();
    const resolvedChainId = chainId ?? chain?.id ?? BASE_CHAIN_ID;
    const isBaseMainnet = resolvedChainId === BASE_CHAIN_ID;
    const tokenConfig = useMemo(() => getTokenConfig(resolvedChainId), [resolvedChainId]);
    const contractAddress = chain?.id === 84532
        ? CONTRACT_ADDRESSES.sepolia
        : CONTRACT_ADDRESSES.mainnet;

    return (
        <div className="onchainkit-hub">
            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Wallet Inventory</span>
                    <span className="onchainkit-card-tier">Balances</span>
                </div>
                <Connected fallback={<div className="onchainkit-note">Connect to view your stash.</div>}>
                    <OnchainKitTokenBalances
                        ethToken={tokenConfig.ethToken}
                        usdcToken={tokenConfig.usdcToken}
                    />
                </Connected>
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Swap Power-Ups</span>
                    <span className="onchainkit-card-tier">Swap</span>
                </div>
                {isBaseMainnet ? (
                    <Connected fallback={<div className="onchainkit-note">Connect to swap ETH and USDC.</div>}>
                        <Swap className="onchainkit-widget" from={tokenConfig.swapFrom} to={tokenConfig.swapTo} />
                    </Connected>
                ) : (
                    <div className="onchainkit-note">Switch to Base Mainnet to use swaps.</div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Quick Buy</span>
                    <span className="onchainkit-card-tier">Buy</span>
                </div>
                {isBaseMainnet ? (
                    <Connected fallback={<div className="onchainkit-note">Connect to buy USDC.</div>}>
                        <Buy className="onchainkit-widget" toToken={tokenConfig.usdcToken} fromToken={tokenConfig.ethToken} />
                    </Connected>
                ) : (
                    <div className="onchainkit-note">Switch to Base Mainnet to use Coinbase Buy.</div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Top Up</span>
                    <span className="onchainkit-card-tier">Fund</span>
                </div>
                {isBaseMainnet ? (
                    <FundCard
                        className="onchainkit-widget"
                        assetSymbol="USDC"
                        headerText="Fund your run"
                        presetAmountInputs={['5', '10', '20']}
                    />
                ) : (
                    <div className="onchainkit-note">Switch to Base Mainnet to use Funding.</div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Sponsor Checkout</span>
                    <span className="onchainkit-card-tier">Pay</span>
                </div>
                {isBaseMainnet ? (
                    checkoutProductId ? (
                        <Checkout className="onchainkit-widget" productId={checkoutProductId}>
                            <CheckoutButton coinbaseBranded />
                            <CheckoutStatus />
                        </Checkout>
                    ) : (
                        <div className="onchainkit-note">
                            Set `VITE_CHECKOUT_PRODUCT_ID` to enable Coinbase Pay checkout.
                        </div>
                    )
                ) : (
                    <div className="onchainkit-note">Switch to Base Mainnet to use Coinbase Pay checkout.</div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Prize Pool Yield</span>
                    <span className="onchainkit-card-tier">Earn</span>
                </div>
                {isBaseMainnet ? (
                    vaultAddress ? (
                        <Connected fallback={<div className="onchainkit-note">Connect to access the vault.</div>}>
                            <Earn className="onchainkit-widget" vaultAddress={vaultAddress} />
                        </Connected>
                    ) : (
                        <div className="onchainkit-note">
                            Add `VITE_MORPHO_VAULT_ADDRESS` to enable vault deposits.
                        </div>
                    )
                ) : (
                    <div className="onchainkit-note">Switch to Base Mainnet to use Earn.</div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Achievement NFT</span>
                    <span className="onchainkit-card-tier">View</span>
                </div>
                {showcaseTokenId ? (
                    <NFTCard
                        className="onchainkit-widget"
                        contractAddress={contractAddress}
                        tokenId={showcaseTokenId}
                    />
                ) : (
                    <div className="onchainkit-note">
                        Set `VITE_ACHIEVEMENT_TOKEN_ID` to spotlight a minted NFT.
                    </div>
                )}
            </div>

            <div className="onchainkit-card">
                <div className="onchainkit-card-header">
                    <span className="onchainkit-card-title">Player Signature</span>
                    <span className="onchainkit-card-tier">Sign</span>
                </div>
                <Connected fallback={<div className="onchainkit-note">Connect to sign your pledge.</div>}>
                    <OnchainKitPlayerSignature />
                </Connected>
            </div>
        </div>
    );
}

function MintAchievementPanel() {
    const { address, isConnected } = useAccount();
    const { chain } = useOnchainKit();
    const mintState = useGameMintState();

    const score = mintState.score;
    const resolvedTier = useMemo(() => {
        if (Number.isFinite(mintState.tier)) return mintState.tier;
        if (Number.isFinite(score)) return getTierFromScore(score);
        return null;
    }, [mintState.tier, score]);

    const tierInfo = resolvedTier !== null ? TIER_INFO[resolvedTier] : null;
    const isMintReady = Boolean(isConnected && mintState.canMint && resolvedTier !== null);
    const contractAddress = chain?.id === 84532
        ? CONTRACT_ADDRESSES.sepolia
        : CONTRACT_ADDRESSES.mainnet;

    const buttonText = useMemo(() => {
        if (!isConnected) return 'CONNECT WALLET TO MINT';
        if (!mintState.canMint) return 'FINISH A RUN TO UNLOCK MINT';
        if (mintState.label) return mintState.label;
        if (tierInfo) return `🎖️ MINT ${tierInfo.name.toUpperCase()}`;
        return '🎖️ MINT ACHIEVEMENT';
    }, [isConnected, mintState.canMint, mintState.label, tierInfo]);

    const buildCalls = useCallback(async () => {
        if (!address) {
            throw new Error('Connect wallet to mint.');
        }
        if (!Number.isFinite(score) || resolvedTier === null) {
            throw new Error('Finish a game to mint.');
        }

        const nonce = Date.now();
        const signature = await fetchMintSignature(address, resolvedTier, score, nonce);

        return [{
            address: contractAddress,
            abi: MOSQUITO_NFT_ABI,
            functionName: 'mintAchievement',
            args: [resolvedTier, BigInt(score), BigInt(nonce), signature]
        }];
    }, [address, contractAddress, resolvedTier, score]);

    return (
        <div className="onchainkit-card onchainkit-mint">
            <div className="onchainkit-card-header">
                <span className="onchainkit-card-title">Achievement Mint</span>
                <span className="onchainkit-card-tier">
                    {tierInfo ? `${tierInfo.icon} ${tierInfo.name}` : 'Play to unlock'}
                </span>
            </div>
            <Transaction calls={buildCalls} isSponsored={Boolean(onchainkitConfig.paymaster)} disabled={!isMintReady}>
                <TransactionButton text={buttonText} />
                <TransactionStatus />
            </Transaction>
        </div>
    );
}

function OnchainKitApp() {
    const { address, isConnected } = useAccount();

    return (
        <div className="onchainkit-shell">
            <OnchainKitWallet />
        </div>
    );
}

function OnchainKitMount() {
    const apiKey = import.meta.env.VITE_ONCHAINKIT_API_KEY;
    const projectId = import.meta.env.VITE_ONCHAINKIT_PROJECT_ID;
    const rpcUrl = import.meta.env.VITE_ONCHAINKIT_RPC_URL;
    return (
        <OnchainKitProvider
            apiKey={apiKey}
            chain={base}
            config={onchainkitConfig}
            projectId={projectId}
            rpcUrl={rpcUrl}
            miniKit={{ enabled: true }}
        >
            <OnchainKitApp />
        </OnchainKitProvider>
    );
}

if (rootElement) {
    createRoot(rootElement).render(<OnchainKitMount />);
}
