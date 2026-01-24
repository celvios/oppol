import { ethers } from "hardhat";

async function enablePublicCreation() {
    const contractAddress = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    
    console.log("🔧 Enabling public market creation...");
    
    try {
        const Market = await ethers.getContractFactory("PredictionMarketMultiV2");
        const market = Market.attach(contractAddress);
        
        // Enable public creation (no token required)
        const tx = await market.setCreationSettings(
            ethers.ZeroAddress,  // No token required
            0,                   // No minimum balance
            true                 // Enable public creation
        );
        
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        
        console.log("✅ Public market creation enabled!");
        console.log("Anyone can now create markets without tokens.");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

enablePublicCreation().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});