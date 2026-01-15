import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

redis.on('connect', () => {
    console.log('✅ Redis connected');
});

export class RateLimiter {
    /**
     * Check if action is rate limited
     */
    static async checkLimit(phoneNumber: string, action: string): Promise<boolean> {
        const key = `ratelimit:${phoneNumber}:${action}`;
        
        try {
            const count = await redis.incr(key);
            
            if (count === 1) {
                // Set expiry on first request
                await redis.expire(key, 60); // 1 minute window
            }
            
            const limits: Record<string, number> = {
                'message': 20,      // 20 messages per minute
                'bet': 5,           // 5 bets per minute
                'withdraw': 1,      // 1 withdrawal per minute
                'deposit': 10,      // 10 deposit checks per minute
            };
            
            const limit = limits[action] || 10;
            return count <= limit;
        } catch (error) {
            console.error('Rate limit check error:', error);
            // If Redis fails, allow the action (fail open)
            return true;
        }
    }

    /**
     * Get remaining requests
     */
    static async getRemaining(phoneNumber: string, action: string): Promise<number> {
        const key = `ratelimit:${phoneNumber}:${action}`;
        
        try {
            const count = await redis.get(key);
            const limits: Record<string, number> = {
                'message': 20,
                'bet': 5,
                'withdraw': 1,
                'deposit': 10,
            };
            
            const limit = limits[action] || 10;
            const used = count ? parseInt(count) : 0;
            return Math.max(0, limit - used);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Reset rate limit for a user (admin function)
     */
    static async reset(phoneNumber: string, action?: string): Promise<void> {
        try {
            if (action) {
                await redis.del(`ratelimit:${phoneNumber}:${action}`);
            } else {
                // Reset all actions
                const keys = await redis.keys(`ratelimit:${phoneNumber}:*`);
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            }
        } catch (error) {
            console.error('Rate limit reset error:', error);
        }
    }
}

export { redis };
