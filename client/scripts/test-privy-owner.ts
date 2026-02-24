import { createWalletClient, http, createPublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

const RPC_URL = 'https://bscrpc.com';
const TARGET = '0xd0a115ea64b59f951b70276fcb65b4946465e3a9';

// The user's Privy embedded wallet address (from DB / Google login)
const PRIVY_WALLET = '0x667967E3cA6e7d5F2750a172595d3a5416c3b984';

async function main() {
    console.log(`Checking if simple smart account owned by ${PRIVY_WALLET} is ${TARGET}`);

    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC_URL) });

    // Dummy owner object to bypass viem's eth_accounts RPC call
    const dummyOwner = {
        address: PRIVY_WALLET as `0x${string}`,
        type: 'local' as const,
        publicKey: '0x' as `0x${string}`,
        source: 'custom' as const,
        async signMessage() { return '0x' as `0x${string}`; },
        async signTypedData() { return '0x' as `0x${string}`; },
        async signTransaction() { return '0x' as `0x${string}`; },
    };

    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: dummyOwner,
        entryPoint: {
            address: entryPoint07Address,
            version: "0.7"
        },
    });

    console.log(`Computed SA Address: ${smartAccount.address}`);
    if (smartAccount.address.toLowerCase() === TARGET) {
        console.log(`🎉 MATCH! The Privy Embedded Wallet owns the Smart Account!`);
    } else {
        console.log(`❌ No match.`);
    }
}

main().catch(console.error);
