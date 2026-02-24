import { createWalletClient, http, createPublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

const USER_KEY = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';
const rpcUrl = 'https://bsc-dataseed.binance.org/';
const TARGET = '0xd0a115ea64b59f951b70276fcb65b4946465e3a9';

async function main() {
    const account = privateKeyToAccount(USER_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    console.log("Checking Simple Smart Account indices 0-20 for EntryPoint 0.7...");
    for (let i = 0n; i < 20n; i++) {
        const smartAccount = await toSimpleSmartAccount({
            client: publicClient,
            owner: walletClient,
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7"
            },
            index: i,
        });

        const addr = smartAccount.address;

        if (addr.toLowerCase() === TARGET) {
            console.log(`✅ MATCH FOUND AT INDEX ${i}: ${addr}`);
            return;
        }
    }

    console.log("Checking Simple Smart Account indices 0-20 for EntryPoint 0.6...");
    for (let i = 0n; i < 20n; i++) {
        const smartAccount = await toSimpleSmartAccount({
            client: publicClient,
            owner: walletClient,
            entryPoint: {
                address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // EP 0.6
                version: "0.6"
            },
            index: i,
        });

        const addr = smartAccount.address;

        if (addr.toLowerCase() === TARGET) {
            console.log(`✅ MATCH FOUND AT INDEX ${i} (EP 0.6): ${addr}`);
            return;
        }
    }

    console.log("Not found.");
}

main().catch(console.error);
