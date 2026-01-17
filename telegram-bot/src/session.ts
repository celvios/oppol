import Redis from 'ioredis';
import { Session, UserState } from './types';

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
    const masked = redisUrl.replace(/:[^@]+@/, ':***@');
    console.log(`🔌 Connecting to REDIS_URL: ${masked}`);
} else {
    console.warn('⚠️ No REDIS_URL provided, defaulting to localhost');
}

const redis = redisUrl
    ? new Redis(redisUrl, {
        retryStrategy: (times) => {
            if (times > 20) return null;
            return 1000;
        },
        maxRetriesPerRequest: null,
        lazyConnect: true,
        family: 0
    })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: () => null,
        maxRetriesPerRequest: 1,
        lazyConnect: true
    });

const SESSION_TTL = 1800;

redis.connect().then(() => {
    console.log('✅ Redis connected');
}).catch((err) => {
    // Log error but don't exit; allow retryStrategy to work
    console.error('❌ Redis connection failed:', err);
});

export class SessionManager {
    private static getKey(userId: number): string {
        return `telegram:session:${userId}`;
    }

    static async get(userId: number): Promise<Session | null> {
        try {
            const data = await redis.get(this.getKey(userId));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    static async set(session: Session): Promise<void> {
        try {
            await redis.setex(
                this.getKey(session.userId),
                SESSION_TTL,
                JSON.stringify(session)
            );
        } catch (error) {
            console.error('Redis set error:', error);
        }
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
        try {
            await redis.del(this.getKey(userId));
        } catch (error) {
            console.error('Redis clear error:', error);
        }
    }
}
