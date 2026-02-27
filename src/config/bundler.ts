/**
 * Bundler Abstraction
 *
 * Centralises all bundler/paymaster URL construction behind a single function.
 * Switch providers at runtime by setting BUNDLER_PROVIDER in the environment:
 *   - "pimlico"   (default)
 *   - "alchemy"
 *   - "biconomy"
 *
 * This means if Pimlico has an outage, you can switch with one env-var change
 * and a server restart — no code changes needed.
 */

export type BundlerProvider = 'pimlico' | 'alchemy' | 'biconomy';

/**
 * Returns the full RPC URL for the active bundler/paymaster provider.
 * All consumers (walletController, etc.) must call this instead of hardcoding URLs.
 */
export function getBundlerUrl(chainId?: number | string): string {
    const provider = (process.env.BUNDLER_PROVIDER || 'pimlico').toLowerCase() as BundlerProvider;
    const id = chainId ?? process.env.CHAIN_ID ?? '56'; // Default: BSC Mainnet

    switch (provider) {
        case 'alchemy': {
            const apiKey = process.env.ALCHEMY_API_KEY;
            if (!apiKey) throw new Error('[Bundler] ALCHEMY_API_KEY is not set');
            // Alchemy Account Abstraction RPC
            return `https://bsc-mainnet.g.alchemy.com/v2/${apiKey}`;
        }

        case 'biconomy': {
            const apiKey = process.env.BICONOMY_API_KEY;
            if (!apiKey) throw new Error('[Bundler] BICONOMY_API_KEY is not set');
            return `https://bundler.biconomy.io/api/v2/${id}/${apiKey}`;
        }

        case 'pimlico':
        default: {
            const apiKey = process.env.PIMLICO_API_KEY || process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
            if (!apiKey) throw new Error('[Bundler] PIMLICO_API_KEY is not set');
            return `https://api.pimlico.io/v2/${id}/rpc?apikey=${apiKey}`;
        }
    }
}

/**
 * Returns the currently active bundler provider name (for logging/diagnostics).
 */
export function getActiveBundlerProvider(): BundlerProvider {
    return (process.env.BUNDLER_PROVIDER || 'pimlico').toLowerCase() as BundlerProvider;
}
