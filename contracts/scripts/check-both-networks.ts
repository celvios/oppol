import { ethers } from "ethers";

const USER_ADDRESS = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

// Mainnet configuration
const MAINNET_RPC = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const MAINNET_USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // Real USDC on BSC mainnet

// Testnet configuration  
const TESTNET_RPC = "https://bsc-testnet-rpc.publicnode.com";
const TESTNET_USDC = "0x87D45E316f5f1f2faffCb600c97160658B799Ee0"; // MockUSDC on testnet

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

async function checkBothNetworks() {
    console.log(`Checking balances for: ${USER_ADDRESS}\n`);

    // Check Mainnet
    console.log("=== BSC MAINNET ===");
    try {
        const mainnetProvider = new ethers.JsonRpcProvider(MAINNET_RPC);
        const mainnetUsdc = new ethers.Contract(MAINNET_USDC, ERC20_ABI, mainnetProvider);
        
        const [bnbBalance, usdcBalance, decimals, symbol] = await Promise.all([
            mainnetProvider.getBalance(USER_ADDRESS),
            mainnetUsdc.balanceOf(USER_ADDRESS),
            mainnetUsdc.decimals(),
            mainnetUsdc.symbol()
        ]);
        
        console.log(`BNB Balance: ${ethers.formatEther(bnbBalance)}`);
        console.log(`${symbol} Balance: ${ethers.formatUnits(usdcBalance, decimals)}`);
        console.log(`Contract: ${MAINNET_USDC}`);
        
        // Check recent transactions on mainnet
        const latestBlock = await mainnetProvider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 1000);
        
        const filter = {
            address: MAINNET_USDC,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                null,
                ethers.zeroPadValue(USER_ADDRESS, 32)
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const logs = await mainnetProvider.getLogs(filter);
        console.log(`Recent USDC transfers: ${logs.length}`);
        
        if (logs.length > 0) {
            console.log("Recent transfers:");
            for (const log of logs.slice(-3)) {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
                const amount = ethers.formatUnits(decoded[0], decimals);
                const block = await mainnetProvider.getBlock(log.blockNumber);
                console.log(`  - ${amount} USDC at block ${log.blockNumber} (${new Date(block.timestamp * 1000).toLocaleString()})`);
            }
        }
        
    } catch (error) {
        console.log(`Mainnet error: ${error.message}`);
    }

    console.log("\n=== BSC TESTNET ===");
    try {
        const testnetProvider = new ethers.JsonRpcProvider(TESTNET_RPC);
        const testnetUsdc = new ethers.Contract(TESTNET_USDC, ERC20_ABI, testnetProvider);
        
        const [bnbBalance, usdcBalance, decimals, symbol] = await Promise.all([
            testnetProvider.getBalance(USER_ADDRESS),
            testnetUsdc.balanceOf(USER_ADDRESS),
            testnetUsdc.decimals(),
            testnetUsdc.symbol()
        ]);
        
        console.log(`BNB Balance: ${ethers.formatEther(bnbBalance)}`);
        console.log(`${symbol} Balance: ${ethers.formatUnits(usdcBalance, decimals)}`);
        console.log(`Contract: ${TESTNET_USDC}`);
        
        // Check recent transactions on testnet
        const latestBlock = await testnetProvider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 1000);
        
        const filter = {
            address: TESTNET_USDC,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                null,
                ethers.zeroPadValue(USER_ADDRESS, 32)
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const logs = await testnetProvider.getLogs(filter);
        console.log(`Recent USDC transfers: ${logs.length}`);
        
        if (logs.length > 0) {
            console.log("Recent transfers:");
            for (const log of logs.slice(-3)) {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
                const amount = ethers.formatUnits(decoded[0], decimals);
                const block = await testnetProvider.getBlock(log.blockNumber);
                console.log(`  - ${amount} USDC at block ${log.blockNumber} (${new Date(block.timestamp * 1000).toLocaleString()})`);
            }
        }
        
    } catch (error) {
        console.log(`Testnet error: ${error.message}`);
    }
}

checkBothNetworks().catch(console.error);