import { UserState, SessionData } from './types';

const sessions = new Map<string, SessionData>();

export class SessionManager {
    static async get(phoneNumber: string): Promise<SessionData | undefined> {
        return sessions.get(phoneNumber);
    }

    static async update(phoneNumber: string, update: Partial<SessionData>) {
        const existing = sessions.get(phoneNumber) || {
            state: UserState.IDLE,
            data: {},
            updatedAt: Date.now()
        };

        sessions.set(phoneNumber, {
            ...existing,
            ...update,
            data: { ...existing.data, ...update.data }, // Merge data
            updatedAt: Date.now()
        });
    }

    static async clear(phoneNumber: string) {
        sessions.delete(phoneNumber);
    }
}
