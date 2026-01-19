import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

import { CONFIG } from '../config/secure';

const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);

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
