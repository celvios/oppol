import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyCreation() {
    try {
        console.log("🔍 Verifying Market Creation Logic...");

        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

        // Correct Contract Address from config
        const MARKET_ADDR = '0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717';

        // Correct V2 ABI
        const abi = [
            'function createMarket(string _question, string _image, string _description, string[] _outcomes, uint256 _duration) external returns (uint256)',
            'function marketCount() view returns (uint256)'
        ];

        const contract = new ethers.Contract(MARKET_ADDR, abi, signer);

        // Test Data
        const question = "System Verification Test Market?";
        const image = "https://example.com/image.png";
        const description = "Verifying admin creation flow.";
        const outcomes = ["Yes", "No", "maybe"];
        const duration = 86400; // 1 day

        console.log(`Target: ${MARKET_ADDR}`);
        console.log(`Params: q="${question}", outcomes=[${outcomes}]`);

        // Use staticCall to simulate execution without spending gas
        try {
            await contract.createMarket.staticCall(
                question,
                image,
                description,
                outcomes,
                duration
            );
            console.log("✅ Static Call Success! The contract accepts these parameters.");
        } catch (e: any) {
            console.error("❌ Static Call Failed:", e.message);
            if (e.info && e.info.error) console.error("Nested Error:", e.info.error.message);

            // Analyze reason
            const reason = e.reason || e.message;
            if (reason.includes("Insufficient creation token")) {
                console.log("⚠️ Result: Failed due to Insufficient BFT (Expected if wallet is empty).");
                console.log("✅ This CONFIRMS the parameters were valid enough to reach the logic check!");
            } else {
                console.log("⚠️ Unknown failure reason.");
            }
        }

    } catch (e: any) {
        console.error("Script Error:", e.message);
    }
}

verifyCreation();
