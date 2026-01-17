import { ethers } from 'ethers';
import { query } from '../config/database';
import { EncryptionService } from './encryption';

export class CustodialWalletService {
    /**
     * Create a new custodial wallet for a WhatsApp user
     */
    static async createWallet(identifier: string): Promise<{ address: string, encryptedPrivateKey: string }> {
        // Generate new wallet
        const wallet = ethers.Wallet.createRandom();

        // Encrypt private key
        const encryptedKey = EncryptionService.encrypt(wallet.privateKey);

        console.log(`✅ Created wallet for ${identifier}: ${wallet.address}`);
        return { address: wallet.address, encryptedPrivateKey: encryptedKey };
    }

    /**
     * Get wallet address for a phone number
     */
    static async getWalletAddress(phoneNumber: string): Promise<string | null> {
        const result = await query(
            'SELECT wallet_address FROM whatsapp_users WHERE phone_number = $1',
            [phoneNumber]
        );

        return result.rows[0]?.wallet_address || null;
    }

    /**
     * Get wallet instance for signing transactions
     */
    static async getWallet(phoneNumber: string, provider: ethers.Provider): Promise<ethers.Wallet> {
        const result = await query(
            'SELECT encrypted_private_key FROM whatsapp_users WHERE phone_number = $1',
            [phoneNumber]
        );

        if (!result.rows[0]) {
            throw new Error('Wallet not found for phone number');
        }

        const privateKey = EncryptionService.decrypt(result.rows[0].encrypted_private_key);
        return new ethers.Wallet(privateKey, provider);
    }

    /**
     * Get or create wallet for a phone number
     */
    static async getOrCreateWallet(phoneNumber: string): Promise<string> {
        let address = await this.getWalletAddress(phoneNumber);

        if (!address) {
            const walletData = await this.createWallet(phoneNumber);
            address = walletData.address;
        } else {
            // Update last active
            await query(
                'UPDATE whatsapp_users SET last_active = NOW() WHERE phone_number = $1',
                [phoneNumber]
            );
        }

        return address;
    }
    /**
     * Fund a wallet with BNB for gas
     */
    static async fundWallet(address: string, amountEth: string, provider: ethers.Provider): Promise<string> {
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error('Server wallet not configured');

        const signer = new ethers.Wallet(privateKey, provider);
        const tx = await signer.sendTransaction({
            to: address,
            value: ethers.parseEther(amountEth)
        });

        await tx.wait();
        console.log(`⛽ Funded ${address} with ${amountEth} BNB. TX: ${tx.hash}`);
        return tx.hash;
    }
}
