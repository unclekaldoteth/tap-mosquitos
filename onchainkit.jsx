import '@coinbase/onchainkit/styles.css';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import {
    Wallet,
    ConnectWallet,
    WalletDropdown,
    WalletDropdownDisconnect,
    WalletDropdownLink
} from '@coinbase/onchainkit/wallet';
import { Identity, Avatar, Name, Address } from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import { base } from 'wagmi/chains';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';

const rootElement = document.getElementById('onchainkit-root');
const onchainkitConfig = {
    appearance: {
        name: 'Tap That Mosquito',
        logo: '/icon.png',
        mode: 'dark',
        theme: 'default'
    },
    wallet: {
        display: 'modal'
    }
};

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

function OnchainKitMount() {
    const apiKey = import.meta.env.VITE_ONCHAINKIT_API_KEY;
    return (
        <OnchainKitProvider
            apiKey={apiKey}
            chain={base}
            config={onchainkitConfig}
            miniKit={{ enabled: true }}
        >
            <OnchainKitWallet />
        </OnchainKitProvider>
    );
}

if (rootElement) {
    createRoot(rootElement).render(<OnchainKitMount />);
}
