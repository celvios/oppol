
import { ethers } from "ethers";

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const ADDRESS = "0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4";

async function check() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const code = await provider.getCode(ADDRESS);
    const isContract = code !== "0x";

    console.log(`Address: ${ADDRESS}`);
    console.log(`Type: ${isContract ? "📝 Contract" : "👤 EOA (External Wallet)"}`);

    // Also get balance of recipient
    const balance = await provider.getBalance(ADDRESS);
    console.log(`Balance: ${ethers.formatEther(balance)} BNB`);
}

check().catch(console.error);
