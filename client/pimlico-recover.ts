// Advanced Recovery using permissionless.js + Pimlico
// Run with: npx tsx pimlico-recover.ts
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import pg from 'pg';
import crypto from 'crypto';
import { ethers } from 'ethers';

const TARGET_WALLET = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const SMART_ACCOUNT = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const USDT_ADDR = '0x55d398326f99059fF775485246999027B3197955';

function decrypt(enc: string) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY as string, 'hex');
    const [ivH, data] = enc.split(':');
    const dc = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivH, 'hex'));
    return dc.update(data, 'hex', 'utf8') + dc.final('utf8');
}

async function main() {
    const rpcUrl = 'https://rpc.ankr.com/bsc';
    const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8');

    // Check balance
    const usdt = new ethers.Contract(USDT_ADDR, ['function balanceOf(address) view returns(uint256)'], provider);
    const bal = await usdt.balanceOf(SMART_ACCOUNT);
    console.log(`Smart Account USDT: ${ethers.formatUnits(bal, 18)}`);

    if (bal === 0n) return console.log('❌ No USDT to recover');

    const privKey = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';
    const ownerAccount = privateKeyToAccount(privKey as `0x${string}`);

    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
    const pimlicoUrl = `https://api.pimlico.io/v2/56/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;
    const pimlicoClient = createPimlicoClient({ transport: http(pimlicoUrl), entryPoint: { address: entryPoint07Address, version: "0.7" } });

    console.log('\n--- 2. Building Smart Account Client ---');
    const simpleAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" }
    });

    console.log(`Calculated Smart Account Address: ${simpleAccount.address}`);

    const smartAccountClient = createSmartAccountClient({
        account: simpleAccount,
        chain: bsc,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast }
    });

    console.log(`\n--- 3. Submitting USDT Transfer UserOp ---`);
    const callData = encodeFunctionData({
        abi: parseAbi(['function transfer(address to, uint256 value)']),
        functionName: 'transfer',
        args: [TARGET_WALLET, bal]
    });

    try {
        const userOpHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: USDT_ADDR, value: 0n, data: callData }]
        });
        console.log(`UserOp Submitted: ${userOpHash}`);

        console.log('Waiting for receipt...');
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(`\n✅ TRANSFER SUCCESS! Tx Hash: https://bscscan.com/tx/${receipt.receipt.transactionHash}`);
    } catch (e: any) {
        console.log('\n❌ Failed: ' + e.message);
    }

}

main().catch(console.error);
