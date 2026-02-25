const { ethers } = require('ethers');
require('dotenv').config();

const {
    createPublicClient,
    http,
    encodeFunctionData,
    parseAbi
} = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const { createSmartAccountClient } = require('permissionless');
const { createPimlicoClient } = require('permissionless/clients/pimlico');
const { toSimpleSmartAccount } = require('permissionless/accounts');
const { entryPoint07Address } = require('viem/account-abstraction');

const MARKET_ADDRESS = process.env.MARKET_CONTRACT || '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xdbe5dc7428a337f186f76ca878b95f83dcc17392aadbd33950cfa1b32574209c';
const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || process.env.PIMLICO_API_KEY;

async function getSmartAccountClient(privateKeyHex) {
    const pimlicoUrl = `https://api.pimlico.io/v2/56/rpc?apikey=${PIMLICO_API_KEY}`;

    const publicClient = createPublicClient({ chain: bsc, transport: http(RPC_URL) });

    const formattedKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
    const ownerAccount = privateKeyToAccount(formattedKey);

    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: bsc,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                return (await pimlicoClient.getUserOperationGasPrice()).fast;
            },
        },
    });

    return { smartAccountClient, pimlicoClient, smartAccountAddress: smartAccount.address, publicClient };
}

async function main() {
    console.log("Setting up Pimlico Smart Account Client...");

    if (!PIMLICO_API_KEY) {
        throw new Error("PIMLICO_API_KEY is not set in environment or .env file.");
    }

    const { smartAccountClient, pimlicoClient, smartAccountAddress, publicClient } = await getSmartAccountClient(PRIVATE_KEY);

    console.log("Admin Smart Account Wallet:", smartAccountAddress);
    console.log("Market Contract:", MARKET_ADDRESS);

    const question = "Will Ethereum (ETH) stay above $3,000 for the next 1 hour?";
    const description = "Predict if ETH will maintain a price above $3,000 continuously for the next 60 minutes.";
    const image = "https://cryptologos.cc/logos/ethereum-eth-logo.png";
    const outcomes = ["Yes", "No"];

    // Exactly 60 minutes
    const durationMinutes = 60n;

    console.log("Preparing createMarket UserOperation...");

    const createMarketData = encodeFunctionData({
        abi: parseAbi(["function createMarket(string memory _question, string memory _description, string memory _image, string[] memory _outcomeNames, uint256 _durationMinutes) external returns (uint256)"]),
        functionName: "createMarket",
        args: [question, description, image, outcomes, durationMinutes],
    });

    const calls = [
        { to: MARKET_ADDRESS, data: createMarketData }
    ];

    try {
        console.log("Sending batched createMarket UserOperation via Pimlico...");
        const userOpHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Create Market] UserOperation sent! Waiting for confirmation... Hash: ${userOpHash}`);

        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(`✅ [Create Market] Success! Tx: ${receipt.receipt.transactionHash}`);
    } catch (e) {
        console.error("FAILED REASON:", JSON.stringify(e, null, 2));
    }
}

main().catch(console.error);
