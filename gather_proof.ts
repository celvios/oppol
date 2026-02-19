
import { ethers } from "ethers";

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
// We can't easily fetch 1700 txs without an indexer API (like BscScan API).
// But we can fetch the nonce which proves the COUNT.
// And we can show the code for the RATE.

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const address = "0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8"; // Private Key... wait, need public address
    const wallet = new ethers.Wallet("0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8", provider);

    console.log("Gathering Proof Data...");
    console.log(`Address: ${wallet.address}`);

    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Total Transactions Sent: ${nonce}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Current Balance: ${ethers.formatEther(balance)} BNB`);

    // We can't list all txs via RPC easily. 
    // We will rely on the nonce and the contract code file path.
}

main().catch(console.error);
