import { createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from '@biconomy/account';

const USER_KEY = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';
const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';

async function main() {
    const account = privateKeyToAccount(USER_KEY as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });

    for (let index = 0; index < 5; index++) {
        const smartAccount = await createSmartAccountClient({
            signer: walletClient as any,
            bundlerUrl: `https://bundler.biconomy.io/api/v2/56/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`,
            index: index
        });

        const saAddress = await smartAccount.getAccountAddress();
        console.log(`Biconomy V2 Address (index ${index}): ${saAddress}`);

        if (saAddress.toLowerCase() === '0xd0a115ea64b59f951b70276fcb65b4946465e3a9') {
            console.log("MATCH FOUND!");
            return;
        }
    }
}

main().catch(console.error);
