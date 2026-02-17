
import { ethers } from "ethers";

async function main() {
    const RPC_URL = "https://bsc-dataseed.binance.org/";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Contracts
    const NFT_ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC"; // The CORRECT one
    const BC400_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";

    // Test Wallet (User can replace this with their address to test specific cases)
    // Using a random holder from bscscan for testing positive case, or the user's wallet if known
    // For now, let's use the layout of the check in the code
    const TEST_WALLET = "0xa4B1B886f955b2342bC9bB4f77B80839357378b76"; // Admin wallet from .env

    console.log(`Checking access for: ${TEST_WALLET}`);
    console.log(`NFT Contract: ${NFT_ADDRESS}`);
    console.log(`BC400 Contract: ${BC400_ADDRESS}`);

    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

    // 1. Check NFT
    const nftContract = new ethers.Contract(NFT_ADDRESS, erc20Abi, provider);
    const nftBalance = await nftContract.balanceOf(TEST_WALLET).catch(() => BigInt(0));
    console.log(`NFT Balance: ${nftBalance.toString()}`);

    // 2. Check BC400
    const bc400Contract = new ethers.Contract(BC400_ADDRESS, erc20Abi, provider);
    const bc400Balance = await bc400Contract.balanceOf(TEST_WALLET).catch(() => BigInt(0));
    console.log(`BC400 Balance: ${ethers.formatUnits(bc400Balance, 18)}`);

    // 3. Logic Verification
    const MIN_TOKENS = ethers.parseUnits("10000000", 18);
    const hasNft = nftBalance > 0n;
    const hasTokens = bc400Balance >= MIN_TOKENS;

    console.log(`\n--- Access Decision ---`);
    console.log(`Has NFT? ${hasNft}`);
    console.log(`Has 10M+ Tokens? ${hasTokens}`);
    console.log(`CAN CREATE MARKET? ${hasNft || hasTokens ? "✅ YES" : "❌ NO"}`);

    if (hasNft || hasTokens) {
        console.log("SUCCESS: Logic would allow creation.");
    } else {
        console.log("FAILURE (Expected if wallet empty): Logic would deny creation.");
    }
}

main().catch(console.error);
