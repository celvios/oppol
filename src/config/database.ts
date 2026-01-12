import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// MOCK DATABASE IMPLEMENTATION
class MockPool {
    private markets = new Map(); // Store market data if needed
    private users = new Map();
    private wallets = new Map();
    private tokens = new Map();
    private marketMetadata = new Map();
    private categories = new Map();

    async query(text: string, params: any[] = []) {
        console.log('📝 [MOCK DB] Query:', text);
        const q = text.toLowerCase();

        // --- AUTH & WALLET ---

        // 1. SELECT User (Auth)
        if (q.includes('select id from users')) {
            const phone = params[0];
            const user = Array.from(this.users.values()).find(u => u.phone_number === phone);
            return { rows: user ? [user] : [] };
        }

        // 2. INSERT User
        if (q.includes('insert into users')) {
            const id = 'user-' + Math.random().toString(36).substr(2, 9);
            const newUser = { id, phone_number: params[0] };
            this.users.set(id, newUser);
            return { rows: [newUser] };
        }

        // 3. INSERT Token
        if (q.includes('insert into auth_tokens')) {
            const token = params[0];
            this.tokens.set(token, { token, user_id: params[1], expires_at: params[2], used: false });
            return { rows: [] };
        }

        // 4. SELECT Token (Verify)
        if (q.includes('select * from auth_tokens')) {
            const token = params[0];
            const data = this.tokens.get(token);
            if (token === 'demo-token') {
                return { rows: [{ token: 'demo-token', user_id: 'demo-user-123', expires_at: new Date(Date.now() + 9999999), used: false }] };
            }
            return { rows: data ? [data] : [] };
        }

        // 5. UPDATE Token (Mark Used)
        if (q.includes('update auth_tokens')) {
            const token = params[0];
            if (this.tokens.has(token)) {
                const t = this.tokens.get(token);
                t.used = true;
                this.tokens.set(token, t);
            }
            return { rows: [] };
        }

        // 6. INSERT Wallet
        if (q.includes('insert into wallets')) {
            const newWallet = { id: 'wallet-' + Math.random(), user_id: params[0], public_address: params[1], encrypted_private_key: params[2], balance: 0 };
            this.wallets.set(params[0], newWallet);
            return { rows: [newWallet] };
        }

        // 7. GET Wallet
        if (q.includes('select id, public_address, balance from wallets')) {
            const userId = params[0];
            if (userId === 'demo-user-123') {
                return { rows: [{ id: 'demo-wallet', public_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', balance: 50.00 }] };
            }
            const w = this.wallets.get(userId);
            return { rows: w ? [w] : [] };
        }

        // --- MARKET METADATA ---

        // 8. INSERT Market Metadata
        if (q.includes('insert into market_metadata')) {
            const marketId = params[0];
            const meta = {
                market_id: marketId,
                question: params[1],
                description: params[2],
                image_url: params[3],
                category_id: params[4],
                created_at: new Date()
            };
            this.marketMetadata.set(marketId.toString(), meta);
            return { rows: [meta] };
        }

        // 9. SELECT Market Metadata (Single)
        if (q.includes('select * from market_metadata where market_id')) {
            const marketId = params[0].toString();
            const meta = this.marketMetadata.get(marketId);
            return { rows: meta ? [meta] : [] };
        }

        // 10. SELECT All Metadata
        if (q.includes('select * from market_metadata')) {
            return { rows: Array.from(this.marketMetadata.values()) };
        }

        // --- CATEGORIES ---

        // 11. INSERT Category
        if (q.includes('insert into categories')) {
            const id = 'cat-' + Math.random().toString(36).substr(2, 9);
            const cat = { id, name: params[0], slug: params[0].toLowerCase().replace(/\s+/g, '-') };
            this.categories.set(cat.id, cat);
            return { rows: [cat] };
        }

        // 12. SELECT Categories
        if (q.includes('select * from categories')) {
            // Seed defaults if empty
            if (this.categories.size === 0) {
                const defaults = ['Crypto', 'Sports', 'Politics', 'Pop Culture'];
                defaults.forEach(d => {
                    const id = d.toLowerCase();
                    this.categories.set(id, { id, name: d, slug: id });
                });
            }
            return { rows: Array.from(this.categories.values()) };
        }

        return { rows: [] };
    }

    on(event: string, cb: any) { }
}

let pool: any;

// Try to use Real DB, fall back to Mock if URL is default/empty or explicitly requested
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.warn('⚠️  USING IN-MEMORY MOCK DATABASE (For Demo/Dev only)');
    pool = new MockPool();
} else {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
}

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;
