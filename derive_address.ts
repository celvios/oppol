
import { ethers } from "ethers";

async function main() {
    const privateKey = "0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8";
    const wallet = new ethers.Wallet(privateKey);
    console.log("Address:", wallet.address);

    // Connect to a provider (try to find RPC from .env or default to a common one)
    // For now I'll just print the address so we can grep for it or use it in the next step with a provider
}

main().catch(console.error);
