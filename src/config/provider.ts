/**
 * Singleton RPC Provider
 * Prevents redundant chain ID fetches and connection overhead
 */

import { ethers } from 'ethers';
import { CONFIG } from './contracts';

class ProviderSingleton {
    private static instance: ethers.JsonRpcProvider | null = null;

    static getProvider(): ethers.JsonRpcProvider {
        if (!this.instance) {
            const rpcUrl = CONFIG.RPC_URL;
            const chainId = parseInt(process.env.CHAIN_ID || '56');

            console.log(`[Provider] Initializing singleton provider: ${rpcUrl} (Chain ${chainId})`);
            this.instance = new ethers.JsonRpcProvider(rpcUrl, chainId);
        }
        return this.instance;
    }

    // For testing or reconnection scenarios
    static resetProvider(): void {
        this.instance = null;
    }
}

export const getProvider = () => ProviderSingleton.getProvider();
export const resetProvider = () => ProviderSingleton.resetProvider();
