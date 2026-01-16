import { createBaseAccountSDK } from '@base-org/account';

const APP_NAME = 'Tap That Mosquito';
const APP_CHAIN_IDS = [8453, 84532];

const getAppLogoUrl = () => {
    if (typeof window === 'undefined') return null;
    try {
        return new URL('/icon.png', window.location.origin).toString();
    } catch {
        return null;
    }
};

let cachedProvider = null;
let initPromise = null;

export async function getBaseAccountProvider() {
    if (typeof window === 'undefined') return null;
    if (window.__baseAccountProvider) return window.__baseAccountProvider;
    if (cachedProvider) return cachedProvider;

    if (!initPromise) {
        initPromise = Promise.resolve()
            .then(() => {
                const sdk = createBaseAccountSDK({
                    appName: APP_NAME,
                    appLogoUrl: getAppLogoUrl(),
                    appChainIds: APP_CHAIN_IDS
                });
                const provider = sdk.getProvider();
                cachedProvider = provider;
                window.__baseAccountProvider = provider;
                return provider;
            })
            .catch((error) => {
                console.log('Base Account SDK init failed:', error?.message || error);
                return null;
            })
            .finally(() => {
                initPromise = null;
            });
    }

    return initPromise;
}
