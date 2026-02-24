import { createWalletClient, http, createPublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
    toSimpleSmartAccount,
    toSafeSmartAccount,
    toBiconomySmartAccount,
    toCoinbaseSmartAccount
} from 'permissionless/accounts';
import { entryPoint06Address, entryPoint07Address } from 'viem/account-abstraction';

const USER_KEY = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';
const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
const TARGET = '0xd0a115ea64b59f951b70276fcb65b4946465e3a9';

async function main() {
    const account = privateKeyToAccount(USER_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    const checks = [
        { name: 'Simple v0.7', fn: toSimpleSmartAccount, ep: entryPoint07Address, v: '0.7' },
        { name: 'Simple v0.6', fn: toSimpleSmartAccount, ep: entryPoint06Address, v: '0.6' },
        { name: 'Safe v0.7', fn: toSafeSmartAccount, ep: entryPoint07Address, v: '0.7', safeVersion: '1.4.1' },
        { name: 'Safe v0.6 (1.4.1)', fn: toSafeSmartAccount, ep: entryPoint06Address, v: '0.6', safeVersion: '1.4.1' },
        { name: 'Biconomy v0.6', fn: toBiconomySmartAccount, ep: entryPoint06Address, v: '0.6' }
    ];

    for (const check of checks) {
        try {
            const acc = await check.fn({
                client: publicClient,
                owner: walletClient,
                safeVersion: check.safeVersion as any,
                entryPoint: { address: check.ep, version: check.v as any },
            });
            console.log(`${check.name}: ${acc.address}`);
            if (acc.address.toLowerCase() === TARGET.toLowerCase()) {
                console.log(`🎉 MATCH FOUND: ${check.name}`);
            }
        } catch (e) {
            console.log(`Error with ${check.name}: ${e.message.split('\n')[0]}`);
        }
    }
}

main().catch(console.error);
