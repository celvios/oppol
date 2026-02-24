import { createPublicClient, http, encodeFunctionData, parseUnits } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import 'dotenv/config';

const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
// The address where you want to receive the funds:
const DESTINATION = '0x667967E3cA6e7d5F2750a172595d3a5416c3b984';
// User's private key for 0x42501490...
const USER_KEY = '0x8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';

// Use Ankr RPC as requested
const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
// Pimlico API key from env or default
const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "pim_QnC4R7VjigQW1FvQnSsm88";
const pimlicoUrl = `https://api.pimlico.io/v2/bsc/rpc?apikey=${apiKey}`;

async function main() {
    console.log("Setting up clients...");

    const publicClient = createPublicClient({
        chain: bsc,
        transport: http(rpcUrl),
    });

    const owner = privateKeyToAccount(USER_KEY as `0x${string}`);
    console.log(`Smart Account Owner: ${owner.address}`);

    const paymasterClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
        }
    });

    const simpleAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner,
        entryPoint: {
            address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
            version: "0.7"
        },
    });

    console.log(`Computed Smart Account Address: ${simpleAccount.address}`);

    if (simpleAccount.address.toLowerCase() !== '0xd0a115ea64b59f951b70276fcb65b4946465e3a9') {
        console.log(`Wait, the computed address doesn't match 0xd0A115...`);
        console.log(`It's possible this was a Biconomy Nexus account or a v0.6 account.`);
    }

    const smartAccountClient = createSmartAccountClient({
        account: simpleAccount,
        chain: bsc,
        bundlerTransport: http(pimlicoUrl),
        paymaster: paymasterClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                return (await paymasterClient.getUserOperationGasPrice()).fast;
            },
        },
    });

    // Get exact USDC balance
    const usdcAbi = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }, { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }, { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;

    const balance = await publicClient.readContract({
        address: USDC_ADDR,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [simpleAccount.address]
    });

    console.log(`USDC Balance: ${balance.toString()}`);

    if (balance === 0n) {
        console.log("No USDC to transfer.");
        return;
    }

    console.log(`Sending UserOperation to transfer all USDC...`);
    const callData = encodeFunctionData({
        abi: usdcAbi,
        functionName: 'transfer',
        args: [DESTINATION, balance],
    });

    try {
        const userOpHash = await smartAccountClient.sendUserOperation({
            to: USDC_ADDR,
            data: callData,
            value: 0n,
        });

        console.log(`✅ UserOperation Hash: ${userOpHash}`);
        console.log(`⏳ Waiting for receipt...`);

        // Use Pimlico's bundler to wait for receipt
        const receipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        console.log(`🎉 SUCCESS! Transaction hash: https://bscscan.com/tx/${receipt.receipt.transactionHash}`);
    } catch (e: any) {
        console.error(`❌ Failed to send UserOp:`, e.details || e.message);
    }
}

main().catch(console.error);
