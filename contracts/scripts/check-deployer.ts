const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const bal = await ethers.provider.getBalance(signer.address);
    console.log(`Deployer address : ${signer.address}`);
    console.log(`BNB Balance      : ${ethers.formatEther(bal)} BNB`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
