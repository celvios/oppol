/**
 * User Session State Machine for WhatsApp Bot
 * Now using Redis for persistence
 */

import { redis } from './rateLimit';

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

// Session timeout: 30 minutes
const SESSION_TIMEOUT = 30 * 60; // seconds

const defaultSession: UserSession = {
    state: BotState.IDLE,
    lastActivity: Date.now(),
};

export async function getSession(phoneNumber: string): Promise<UserSession> {
    try {
        const key = `session:${phoneNumber}`;
        const data = await redis.get(key);
        
        if (data) {
            const session = JSON.parse(data) as UserSession;
            session.lastActivity = Date.now();
            // Refresh TTL
            await redis.setex(key, SESSION_TIMEOUT, JSON.stringify(session));
            return session;
        }
        
        // Create new session
        const newSession = { ...defaultSession };
        await redis.setex(key, SESSION_TIMEOUT, JSON.stringify(newSession));
        return newSession;
    } catch (error) {
        console.error('Session get error:', error);
        // Fallback to default session if Redis fails
        return { ...defaultSession };
    }
}

export async function updateSession(phoneNumber: string, updates: Partial<UserSession>): Promise<UserSession> {
    try {
        const session = await getSession(phoneNumber);
        const updated = { ...session, ...updates, lastActivity: Date.now() };
        
        const key = `session:${phoneNumber}`;
        await redis.setex(key, SESSION_TIMEOUT, JSON.stringify(updated));
        
        return updated;
    } catch (error) {
        console.error('Session update error:', error);
        return { ...defaultSession, ...updates };
    }
}

export async function resetSession(phoneNumber: string): Promise<void> {
    try {
        const key = `session:${phoneNumber}`;
        const newSession: UserSession = {
            state: BotState.MAIN_MENU,
            lastActivity: Date.now(),
        };
        await redis.setex(key, SESSION_TIMEOUT, JSON.stringify(newSession));
    } catch (error) {
        console.error('Session reset error:', error);
    }
}

export async function deleteSession(phoneNumber: string): Promise<void> {
    try {
        await redis.del(`session:${phoneNumber}`);
    } catch (error) {
        console.error('Session delete error:', error);
    }
}
