const { ethers } = require('ethers');

// Setup
const MARKET_ADDRESS = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const RPC_URL = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
const PRIVATE_KEY = '0xdbe5dc7428a337f186f76ca878b95f83dcc17392aadbd33950cfa1b32574209c';

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

    console.log("Admin:", wallet.address);
    const bal = await usdc.balanceOf(wallet.address);
    console.log("USDC Balance:", ethers.formatUnits(bal, 18)); // BSC USDC is actually 18 decimal sometimes, wait BSC-USD is 18. Let's check formatUnits 18

    const allowance = await usdc.allowance(wallet.address, MARKET_ADDRESS);
    console.log("Current Allowance:", allowance.toString());

    // Approve infinity
    console.log("Approving Market Contract...");
    const tx = await usdc.approve(MARKET_ADDRESS, ethers.MaxUint256);
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("Approved.");

    // Now run the market creation
    require('./create-trendy-market.js');
}

main().catch(console.error);
