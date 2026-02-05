export enum UserState {
  IDLE = 'IDLE',
  BROWSING_MARKETS = 'BROWSING_MARKETS',
  VIEWING_MARKET = 'VIEWING_MARKET',
  ENTERING_AMOUNT = 'ENTERING_AMOUNT',
  CONFIRMING_BET = 'CONFIRMING_BET',
  ENTERING_WITHDRAW_ADDRESS = 'ENTERING_WITHDRAW_ADDRESS',
  ENTERING_WITHDRAW_AMOUNT = 'ENTERING_WITHDRAW_AMOUNT',
  SEARCHING_MARKETS = 'SEARCHING_MARKETS',
  SETTING_ALERT = 'SETTING_ALERT',
  SETTING_ALERT_OUTCOME = 'SETTING_ALERT_OUTCOME',
  SETTING_ALERT_PRICE = 'SETTING_ALERT_PRICE',
  SETTING_ALERT_DIRECTION = 'SETTING_ALERT_DIRECTION'
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
    withdrawAmount?: number;
    searchQuery?: string;
    alertMarketId?: number;
    alertOutcome?: number;
    alertPrice?: number;
    alertDirection?: 'above' | 'below';
  };
  lastActivity: number;
}

export interface PriceAlert {
  phoneNumber: string;
  marketId: number;
  outcome: number;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: number;
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
  category?: string;
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

export interface BotStats {
  totalUsers: number;
  activeUsers24h: number;
  totalBets: number;
  totalVolume: number;
  messagesProcessed: number;
}
