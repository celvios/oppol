const { ethers } = require('ethers');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = 'https://1rpc.io/bnb';

async function checkAdmin() {
    if (!PRIVATE_KEY) {
        console.error('No PRIVATE_KEY in env');
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Admin Address: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Admin Balance: ${ethers.formatEther(balance)} BNB`);
}

checkAdmin().catch(console.error);
