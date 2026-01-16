import '@coinbase/onchainkit/styles.css';
import { OnchainKitProvider, useOnchainKit } from '@coinbase/onchainkit';
import {
    Wallet,
    ConnectWallet,
    WalletDropdown,
    WalletDropdownDisconnect,
    WalletDropdownLink
} from '@coinbase/onchainkit/wallet';
import { Identity, Avatar, Name, Address, IdentityCard } from '@coinbase/onchainkit/identity';
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
                    </Identity>
                    <WalletDropdownLink href={basescanUrl} target="_blank" rel="noreferrer">
                        View on Basescan
                    </WalletDropdownLink>
                    <WalletDropdownDisconnect />
                </WalletDropdown>
            </Wallet>
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
    const tierBadge = isConnected ? 'Verified Player' : 'Connect to view profile';

    return (
        <div className="onchainkit-shell">
            <OnchainKitWallet />
            {isConnected ? (
                <IdentityCard
                    address={address}
                    className="onchainkit-identity-card"
                    badgeTooltip={tierBadge}
                />
            ) : null}
            <MintAchievementPanel />
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
