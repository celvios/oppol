import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

async function main() {
    const privKey = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';
    const ownerAccount = privateKeyToAccount(privKey as `0x${string}`);
    const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    const simpleAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" }
    });
    console.log(`Calculated Smart Account Address 0.7: ${simpleAccount.address}`);
}

main().catch(console.error);
