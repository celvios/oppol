import { createWalletClient, http, encodeFunctionData, createPublicClient } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from '@biconomy/account';
import 'dotenv/config';

const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
// The address where you want to receive the funds:
const DESTINATION = '0x667967E3cA6e7d5F2750a172595d3a5416c3b984';
// User's private key
const USER_KEY = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';

const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';

async function main() {
    console.log("Setting up Biconomy client...");

    const account = privateKeyToAccount(USER_KEY as `0x${string}`);
    console.log(`EOA Owner: ${account.address}`);

    const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: http(rpcUrl),
    });

    // We can also let the biconomy sdk figure out the paymaster via their dashboard if needed,
    // but the user only needs a basic smart account client to sign the UserOp. We will fund gas manually if we must, 
    // or use biconomy paymaster.

    // To use Biconomy SDK:
    const smartAccount = await createSmartAccountClient({
        signer: walletClient as any,
        biconomyPaymasterApiKey: process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY,
        bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL || `https://bundler.biconomy.io/api/v2/${bsc.id}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`,
        paymasterUrl: process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_URL || `https://paymaster.biconomy.io/api/v1/${bsc.id}/N-xS8Qh-F.242dd744-93ff-4fa7-88cc-8d48a113d508`,
    });

    const saAddress = await smartAccount.getAccountAddress();
    console.log(`Biconomy Smart Account Address: ${saAddress}`);

    if (saAddress.toLowerCase() !== '0xd0a115ea64b59f951b70276fcb65b4946465e3a9') {
        console.log(`⚠️ Warning: still doesn't match 0xd0A115...`);
        console.log(`Maybe it uses a specific index or version?`);
    } else {
        console.log(`✅ MATCH! We found the right account.`);
    }

    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
    const usdcAbi = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }, { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;

    const balance = await publicClient.readContract({
        address: USDC_ADDR,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [saAddress as `0x${string}`]
    });

    console.log(`USDC Balance: ${balance.toString()}`);

    if (balance === 0n) {
        console.log("No USDC to transfer.");
        return;
    }

    console.log(`Sending UserOperation to transfer USDC...`);
    const tx = {
        to: USDC_ADDR,
        data: encodeFunctionData({
            abi: usdcAbi,
            functionName: 'transfer',
            args: [DESTINATION, balance],
        }),
    };

    try {
        const userOpResponse = await smartAccount.sendTransaction(tx, {
            paymasterServiceData: { mode: "SPONSORED" }
        });

        console.log(`✅ UserOp Hash: ${userOpResponse.userOpHash}`);
        console.log(`⏳ Waiting for receipt...`);
        const { receipt } = await userOpResponse.wait();
        console.log(`🎉 SUCCESS! https://bscscan.com/tx/${receipt.transactionHash}`);
    } catch (e: any) {
        console.error("❌ Failed:", e.message || e);
    }
}

main().catch(console.error);
