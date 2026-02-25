import 'dotenv/config';
import {
    createPublicClient,
    http,
    encodeFunctionData,
    parseAbi
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

const MARKET_ADDRESS = process.env.MARKET_CONTRACT || '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || process.env.PIMLICO_API_KEY;

if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env');
if (!PIMLICO_API_KEY) throw new Error('PIMLICO_API_KEY not set in .env');

const CHAIN_ID = 56; // BSC Mainnet
const pimlicoUrl = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;

const publicClient = createPublicClient({ chain: bsc, transport: http(RPC_URL) });
const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const ownerAccount = privateKeyToAccount(formattedKey);

const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
});

console.log('Building Smart Account...');
const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: ownerAccount,
    entryPoint: { address: entryPoint07Address, version: '0.7' },
});

const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: bsc,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
        estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
});

console.log('Admin Smart Account:', smartAccount.address);
console.log('Market Contract:', MARKET_ADDRESS);

const question = "Will Ethereum (ETH) stay above $3,000 for the next 1 hour?";
const description = "Predict if ETH will maintain a price above $3,000 for the next 60 minutes.";
const image = "https://cryptologos.cc/logos/ethereum-eth-logo.png";
const outcomes = ["Yes", "No"];
const durationMinutes = 60n;

const createMarketData = encodeFunctionData({
    abi: parseAbi(["function createMarket(string _question, string _description, string _image, string[] _outcomeNames, uint256 _durationMinutes) external returns (uint256)"]),
    functionName: "createMarket",
    args: [question, description, image, outcomes, durationMinutes],
});

console.log('Sending createMarket UserOperation via Pimlico...');
try {
    const userOpHash = await smartAccountClient.sendUserOperation({ calls: [{ to: MARKET_ADDRESS, data: createMarketData }] });
    console.log('UserOp sent:', userOpHash);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log('✅ Market created! Tx:', receipt.receipt.transactionHash);
} catch (e) {
    console.error('❌ Failed:', e?.shortMessage || e?.message || JSON.stringify(e));
}
