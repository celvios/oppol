import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address, entryPoint06Address } from 'viem/account-abstraction';

async function main() {
    const privKey = '0xdbe5dc7428a337f186f76ca878b95f83dcc17392aadbd33950cfa1b32574209c';
    const ownerAccount = privateKeyToAccount(privKey as `0x${string}`);
    const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    const simpleAccount07 = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" }
    });
    console.log(`0.7: ${simpleAccount07.address}`);

    const simpleAccount06 = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint06Address, version: "0.6" }
    });
    console.log(`0.6: ${simpleAccount06.address}`);
}

main().catch(console.error);
