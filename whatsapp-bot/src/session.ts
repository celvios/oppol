/**
 * User Session State Machine for WhatsApp Bot
 */

export enum BotState {
    IDLE = 'IDLE',
    WELCOME = 'WELCOME',
    MAIN_MENU = 'MAIN_MENU',
    MARKETS_LIST = 'MARKETS_LIST',
    MARKET_DETAIL = 'MARKET_DETAIL',
    BET_AMOUNT = 'BET_AMOUNT',
    BET_CONFIRM = 'BET_CONFIRM',
    PROFILE = 'PROFILE',
    DEPOSIT = 'DEPOSIT',
    WITHDRAW_AMOUNT = 'WITHDRAW_AMOUNT',
    WITHDRAW_ADDRESS = 'WITHDRAW_ADDRESS',
    WITHDRAW_CONFIRM = 'WITHDRAW_CONFIRM',
}

export interface UserSession {
    state: BotState;
    selectedMarketId?: number;
    betSide?: 'YES' | 'NO';
    betAmount?: number;
    withdrawAmount?: number;
    withdrawAddress?: string;
    lastActivity: number;
}

// In-memory session store (use Redis for production)
const sessions: Map<string, UserSession> = new Map();

// Session timeout: 10 minutes
const SESSION_TIMEOUT = 10 * 60 * 1000;

export function getSession(phoneNumber: string): UserSession {
    const existing = sessions.get(phoneNumber);

    // Check for timeout
    if (existing && Date.now() - existing.lastActivity > SESSION_TIMEOUT) {
        sessions.delete(phoneNumber);
    }

    if (!sessions.has(phoneNumber)) {
        sessions.set(phoneNumber, {
            state: BotState.IDLE,
            lastActivity: Date.now(),
        });
    }

    const session = sessions.get(phoneNumber)!;
    session.lastActivity = Date.now();
    return session;
}

export function updateSession(phoneNumber: string, updates: Partial<UserSession>): UserSession {
    const session = getSession(phoneNumber);
    Object.assign(session, updates, { lastActivity: Date.now() });
    sessions.set(phoneNumber, session);
    return session;
}

export function resetSession(phoneNumber: string): void {
    sessions.set(phoneNumber, {
        state: BotState.MAIN_MENU,
        lastActivity: Date.now(),
    });
}
