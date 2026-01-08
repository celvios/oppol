import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');

export const createRandomWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
    };
};

export const getWalletFromPrivateKey = (privateKey: string) => {
    return new ethers.Wallet(privateKey, provider);
};

export const getProvider = () => provider;
