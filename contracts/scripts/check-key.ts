import { ethers } from "ethers";

async function main() {
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff15';
    const wallet = new ethers.Wallet(key);
    console.log("Address derived from key:", wallet.address);
    console.log("Expected Hardhat #0:", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
}

main();
