export class BotError extends Error {
    constructor(
        message: string,
        public userMessage: string,
        public code: string
    ) {
        super(message);
        this.name = 'BotError';
    }
}

export const ErrorMessages = {
    INSUFFICIENT_BALANCE: '❌ Insufficient balance. Deposit more USDC to continue.',
    INVALID_AMOUNT: '❌ Invalid amount. Please enter a number greater than 0.',
    AMOUNT_TOO_LOW: '❌ Minimum bet is $1.',
    AMOUNT_TOO_HIGH: '❌ Maximum bet is $10,000.',
    MARKET_CLOSED: '❌ This market has ended. Choose another market.',
    NETWORK_ERROR: '❌ Network error. Please try again in a moment.',
    RATE_LIMITED: '⏳ Too many requests. Please wait a moment.',
    INVALID_ADDRESS: '❌ Invalid Ethereum address. Must start with 0x and be 42 characters.',
    WALLET_NOT_FOUND: '❌ Wallet not found. Please contact support.',
    BET_FAILED: '❌ Bet failed. Please try again or contact support.',
    WITHDRAWAL_FAILED: '❌ Withdrawal failed. Please try again later.',
    UNKNOWN_ERROR: '❌ Something went wrong. Reply *menu* to start over.'
};

export function handleError(error: any): string {
    if (error instanceof BotError) {
        return error.userMessage;
    }
    
    // Handle common errors
    if (error.message?.includes('insufficient funds')) {
        return ErrorMessages.INSUFFICIENT_BALANCE;
    }
    
    if (error.message?.includes('network')) {
        return ErrorMessages.NETWORK_ERROR;
    }
    
    if (error.message?.includes('timeout')) {
        return ErrorMessages.NETWORK_ERROR;
    }
    
    // Default error
    return ErrorMessages.UNKNOWN_ERROR;
}
