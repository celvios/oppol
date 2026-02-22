
'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { bsc } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { createConfig } from 'wagmi';

// Create Wagmi config for Privy
const config = createConfig({
    chains: [bsc],
    transports: {
        [bsc.id]: http(),
    },
});

const queryClient = new QueryClient();

export function PrivyProvider({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProviderBase
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cl_dummy_id_for_build'}
            config={{
                loginMethods: ['email', 'google', 'wallet'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#10b981',
                    logo: 'https://www.opoll.org/logo.png',
                },
                embeddedWallets: {
                    createOnLogin: 'all-users',
                    // showWalletUIs: false suppresses all Privy signing popups for embedded wallet users.
                    // Email/Google users will never see a "sign this transaction" popup — trades are silent.
                    showWalletUIs: false,
                },
                defaultChain: bsc,
                supportedChains: [bsc],
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={config}>
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProviderBase>
    );
}
