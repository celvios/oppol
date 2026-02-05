export enum UserState {
  IDLE = 'IDLE',
  BROWSING_MARKETS = 'BROWSING_MARKETS',
  VIEWING_MARKET = 'VIEWING_MARKET',
  ENTERING_AMOUNT = 'ENTERING_AMOUNT',
  CONFIRMING_BET = 'CONFIRMING_BET',
  ENTERING_WITHDRAW_ADDRESS = 'ENTERING_WITHDRAW_ADDRESS',
  ENTERING_WITHDRAW_AMOUNT = 'ENTERING_WITHDRAW_AMOUNT',
  SEARCHING_MARKETS = 'SEARCHING_MARKETS'
}

export interface Session {
  phoneNumber: string;
  state: UserState;
  data: {
    page?: number;
    allMarkets?: Market[];
    marketId?: number;
    outcome?: number;
    amount?: number;
    withdrawAddress?: string;
    searchQuery?: string;
  };
  lastActivity: number;
}

export interface Market {
  market_id: number;
  question: string;
  description: string;
  image_url: string;
  category_id: string;
  outcomes: string[];
  prices: number[];
  outcomeCount: number;
  endTime: number;
  liquidityParam: string;
  resolved: boolean;
  winningOutcome: number;
  totalVolume?: string;
}

export interface Position {
  marketId: number;
  question: string;
  outcome: number;
  outcomeName: string;
  shares: number;
  totalInvested: number;
  resolved: boolean;
  winningOutcome?: number;
}

export interface UserData {
  user: {
    wallet_address: string;
  };
  isNew: boolean;
}
