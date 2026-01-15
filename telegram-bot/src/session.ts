import Redis from 'ioredis';
import { Session, UserState } from './types';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
    lazyConnect: true
});

const inMemoryStore = new Map<number, Session>();
const SESSION_TTL = 1800;
let redisAvailable = false;

redis.connect().then(() => {
    console.log('✅ Redis connected');
    redisAvailable = true;
}).catch(() => {
    console.warn('⚠️  Redis unavailable, using in-memory sessions');
});

redis.on('error', () => { redisAvailable = false; });

export class SessionManager {
    private static getKey(userId: number): string {
        return `telegram:session:${userId}`;
    }

    static async get(userId: number): Promise<Session | null> {
        if (!redisAvailable) return inMemoryStore.get(userId) || null;
        try {
            const data = await redis.get(this.getKey(userId));
            return data ? JSON.parse(data) : null;
        } catch {
            return inMemoryStore.get(userId) || null;
        }
    }

    static async set(session: Session): Promise<void> {
        inMemoryStore.set(session.userId, session);
        if (!redisAvailable) return;
        try {
            await redis.setex(
                this.getKey(session.userId),
                SESSION_TTL,
                JSON.stringify(session)
            );
        } catch {}
    }

    static async update(userId: number, updates: Partial<Session>): Promise<void> {
        const session = await this.get(userId) || {
            userId,
            state: UserState.IDLE,
            data: {}
        };
        await this.set({ ...session, ...updates });
    }

    static async clear(userId: number): Promise<void> {
        inMemoryStore.delete(userId);
        if (!redisAvailable) return;
        try {
            await redis.del(this.getKey(userId));
        } catch {}
    }
}
