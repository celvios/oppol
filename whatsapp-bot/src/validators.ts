import { ethers } from 'ethers';
import { BotError, ErrorMessages } from './errors';

export class Validators {
    /**
     * Validate and parse amount input
     */
    static validateAmount(input: string, min: number = 1, max: number = 10000): number {
        // Remove common formatting
        const cleaned = input.replace(/[$,\s]/g, '');
        const amount = parseFloat(cleaned);
        
        if (isNaN(amount)) {
            throw new BotError('Invalid number', ErrorMessages.INVALID_AMOUNT, 'INVALID_AMOUNT');
        }
        
        if (amount < min) {
            throw new BotError('Amount too low', ErrorMessages.AMOUNT_TOO_LOW, 'AMOUNT_TOO_LOW');
        }
        
        if (amount > max) {
            throw new BotError('Amount too high', ErrorMessages.AMOUNT_TOO_HIGH, 'AMOUNT_TOO_HIGH');
        }
        
        return amount;
    }

    /**
     * Validate Ethereum address
     */
    static validateAddress(address: string): string {
        if (!address.startsWith('0x')) {
            throw new BotError('Invalid address', ErrorMessages.INVALID_ADDRESS, 'INVALID_ADDRESS');
        }
        
        if (address.length !== 42) {
            throw new BotError('Invalid address', ErrorMessages.INVALID_ADDRESS, 'INVALID_ADDRESS');
        }
        
        if (!ethers.isAddress(address)) {
            throw new BotError('Invalid address', ErrorMessages.INVALID_ADDRESS, 'INVALID_ADDRESS');
        }
        
        return address.toLowerCase();
    }

    /**
     * Validate phone number
     */
    static validatePhone(phone: string): string {
        // Remove all non-digit characters except +
        const cleaned = phone.replace(/[^\d+]/g, '');
        
        if (cleaned.length < 10) {
            throw new BotError('Invalid phone', '❌ Invalid phone number', 'INVALID_PHONE');
        }
        
        return cleaned;
    }

    /**
     * Validate market ID
     */
    static validateMarketId(input: string): number {
        const id = parseInt(input);
        
        if (isNaN(id) || id < 0) {
            throw new BotError('Invalid market ID', '❌ Invalid market selection', 'INVALID_MARKET');
        }
        
        return id;
    }
}
