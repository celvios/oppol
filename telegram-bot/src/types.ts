export enum UserState {
    IDLE = 'IDLE',
    BROWSING_MARKETS = 'BROWSING_MARKETS',
    SEARCHING_MARKETS = 'SEARCHING_MARKETS',
    VIEWING_MARKET = 'VIEWING_MARKET',
    PLACING_BET = 'PLACING_BET',
    ENTERING_AMOUNT = 'ENTERING_AMOUNT',
    ENTERING_WITHDRAW_ADDRESS = 'ENTERING_WITHDRAW_ADDRESS',
    ENTERING_WITHDRAW_AMOUNT = 'ENTERING_WITHDRAW_AMOUNT'
}

export interface Session {
    userId: number;
    state: UserState;
    data: {
        marketId?: number;
        outcome?: number;
        amount?: string;
        page?: number;
        searchQuery?: string;
        allMarkets?: any[];
        withdrawAddress?: string;
    };
}
