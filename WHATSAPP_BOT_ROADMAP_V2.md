# WhatsApp Bot Roadmap V2 - Realistic Implementation Plan

**Current Status:** 30% Complete (Prototype with UI, no backend integration)  
**Goal:** Production-ready WhatsApp bot with real money handling  
**Timeline:** 4-6 weeks to MVP

---

## 🎯 PHASE 1: MAKE IT WORK (Week 1-2)
**Goal:** Connect bot to real backend and blockchain  
**Priority:** CRITICAL - Nothing else matters until this works

### 1.1 Backend API Endpoints (3 days)

**Create `/api/whatsapp/user` endpoint:**
```typescript
// src/controllers/whatsappController.ts
POST /api/whatsapp/user
- Input: { phone: string }
- Output: { walletAddress: string, isNew: boolean }
- Logic:
  1. Check if phone exists in whatsapp_users table
  2. If not, create custodial wallet
  3. Store phone → wallet mapping
  4. Return wallet address
```

**Fix `/api/bet` for custodial wallets:**
```typescript
// src/controllers/betController.ts
POST /api/bet
- Input: { walletAddress: string, marketId: number, side: 'YES'|'NO', amount: number }
- Logic:
  1. Get encrypted private key from database
  2. Decrypt and sign transaction
  3. Execute bet on blockchain
  4. Return transaction hash + shares
```

**Create `/api/portfolio/:address`:**
```typescript
GET /api/portfolio/:address
- Output: { positions: Array<Position> }
- Logic:
  1. Query blockchain for user positions
  2. Calculate current value vs cost basis
  3. Return formatted positions
```

**Files to modify:**
- `src/controllers/whatsappController.ts` (NEW)
- `src/controllers/betController.ts` (UPDATE)
- `src/routes/api.ts` (ADD ROUTES)

**Success Criteria:**
- ✅ User can place real bet via WhatsApp
- ✅ Balance shows real USDC amount
- ✅ Positions show actual blockchain data

---

### 1.2 Database Schema (1 day)

**Add WhatsApp users table:**
```sql
CREATE TABLE whatsapp_users (
    phone_number VARCHAR(20) PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_wallet ON whatsapp_users(wallet_address);
```

**Add transaction log:**
```sql
CREATE TABLE whatsapp_transactions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES whatsapp_users(phone_number),
    type VARCHAR(20) NOT NULL, -- BET, DEPOSIT, WITHDRAW
    market_id INTEGER,
    side VARCHAR(3), -- YES, NO
    amount DECIMAL(18,6) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_phone_tx ON whatsapp_transactions(phone_number);
CREATE INDEX idx_tx_hash ON whatsapp_transactions(tx_hash);
```

**Files to modify:**
- `src/models/index.ts` (ADD MODELS)
- `src/config/database.ts` (RUN MIGRATIONS)

**Success Criteria:**
- ✅ Phone numbers stored in database
- ✅ Wallets persist across restarts
- ✅ Transaction history tracked

---

### 1.3 Custodial Wallet Service (2 days)

**Create wallet management service:**
```typescript
// src/services/custodialWallet.ts

class CustodialWalletService {
    // Create new wallet for user
    async createWallet(phoneNumber: string): Promise<string> {
        const wallet = ethers.Wallet.createRandom();
        const encryptedKey = await this.encrypt(wallet.privateKey);
        
        await db.query(
            'INSERT INTO whatsapp_users (phone_number, wallet_address, encrypted_private_key) VALUES ($1, $2, $3)',
            [phoneNumber, wallet.address, encryptedKey]
        );
        
        return wallet.address;
    }
    
    // Sign transaction for user
    async signTransaction(phoneNumber: string, tx: any): Promise<string> {
        const result = await db.query(
            'SELECT encrypted_private_key FROM whatsapp_users WHERE phone_number = $1',
            [phoneNumber]
        );
        
        const privateKey = await this.decrypt(result.rows[0].encrypted_private_key);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const signedTx = await wallet.signTransaction(tx);
        return signedTx;
    }
    
    // Encrypt private key (use AES-256)
    private async encrypt(privateKey: string): Promise<string> {
        // Use process.env.ENCRYPTION_KEY
        // Implementation with crypto module
    }
    
    private async decrypt(encrypted: string): Promise<string> {
        // Decrypt using process.env.ENCRYPTION_KEY
    }
}
```

**Files to create:**
- `src/services/custodialWallet.ts` (NEW)
- `src/services/encryption.ts` (NEW)

**Environment variables needed:**
```env
ENCRYPTION_KEY=<generate-with-crypto.randomBytes(32)>
```

**Success Criteria:**
- ✅ New users get auto-created wallets
- ✅ Private keys encrypted at rest
- ✅ Bot can sign transactions on behalf of users

---

### 1.4 Testing & Validation (1 day)

**Test complete flow:**
1. New user sends "menu" → wallet created
2. User deposits USDC → balance updates
3. User places bet → transaction executes
4. User checks profile → sees position
5. User withdraws → funds sent

**Files to create:**
- `whatsapp-bot/tests/integration.test.ts` (NEW)

**Success Criteria:**
- ✅ End-to-end bet flow works
- ✅ No mock data in responses
- ✅ All transactions confirmed on blockchain

---

## 🔐 PHASE 2: MAKE IT SAFE (Week 3)
**Goal:** Security, persistence, and error handling  
**Priority:** HIGH - Required before real users

### 2.1 Redis Session Management (1 day)

**Replace in-memory sessions:**
```typescript
// whatsapp-bot/src/session.ts

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getSession(phoneNumber: string): Promise<Session> {
    const data = await redis.get(`session:${phoneNumber}`);
    return data ? JSON.parse(data) : defaultSession;
}

export async function updateSession(phoneNumber: string, updates: Partial<Session>): Promise<void> {
    const session = await getSession(phoneNumber);
    const updated = { ...session, ...updates };
    await redis.setex(`session:${phoneNumber}`, 1800, JSON.stringify(updated)); // 30 min TTL
}
```

**Files to modify:**
- `whatsapp-bot/src/session.ts` (REWRITE)
- `whatsapp-bot/package.json` (ADD ioredis)

**Success Criteria:**
- ✅ Sessions persist across bot restarts
- ✅ Sessions expire after 30 minutes
- ✅ No memory leaks

---

### 2.2 Error Handling & Validation (2 days)

**Add comprehensive error handling:**
```typescript
// whatsapp-bot/src/errors.ts

export class BotError extends Error {
    constructor(
        message: string,
        public userMessage: string,
        public code: string
    ) {
        super(message);
    }
}

export const ErrorMessages = {
    INSUFFICIENT_BALANCE: '❌ Insufficient balance. Deposit more USDC to continue.',
    INVALID_AMOUNT: '❌ Invalid amount. Please enter a number greater than 0.',
    MARKET_CLOSED: '❌ This market has ended. Choose another market.',
    NETWORK_ERROR: '❌ Network error. Please try again in a moment.',
    RATE_LIMITED: '⏳ Too many requests. Please wait a moment.',
};
```

**Add input validation:**
```typescript
// whatsapp-bot/src/validators.ts

export function validateAmount(input: string): number {
    const amount = parseFloat(input.replace(/[$,]/g, ''));
    
    if (isNaN(amount)) throw new BotError('Invalid number', ErrorMessages.INVALID_AMOUNT, 'INVALID_AMOUNT');
    if (amount <= 0) throw new BotError('Amount too low', ErrorMessages.INVALID_AMOUNT, 'INVALID_AMOUNT');
    if (amount > 10000) throw new BotError('Amount too high', '❌ Maximum bet is $10,000', 'AMOUNT_TOO_HIGH');
    
    return amount;
}

export function validateAddress(address: string): string {
    if (!address.startsWith('0x')) throw new BotError('Invalid address', '❌ Address must start with 0x', 'INVALID_ADDRESS');
    if (address.length !== 42) throw new BotError('Invalid address', '❌ Address must be 42 characters', 'INVALID_ADDRESS');
    if (!ethers.utils.isAddress(address)) throw new BotError('Invalid address', '❌ Invalid Ethereum address', 'INVALID_ADDRESS');
    
    return address.toLowerCase();
}
```

**Files to create:**
- `whatsapp-bot/src/errors.ts` (NEW)
- `whatsapp-bot/src/validators.ts` (NEW)

**Files to modify:**
- `whatsapp-bot/src/commands.ts` (ADD TRY-CATCH)

**Success Criteria:**
- ✅ All user inputs validated
- ✅ Friendly error messages
- ✅ No crashes from bad input

---

### 2.3 Rate Limiting (1 day)

**Add rate limiter:**
```typescript
// whatsapp-bot/src/rateLimit.ts

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(phoneNumber: string, action: string): Promise<boolean> {
    const key = `ratelimit:${phoneNumber}:${action}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
        // Set expiry on first request
        await redis.expire(key, 60); // 1 minute window
    }
    
    const limits = {
        'message': 20,      // 20 messages per minute
        'bet': 5,           // 5 bets per minute
        'withdraw': 1,      // 1 withdrawal per minute
    };
    
    return count <= (limits[action] || 10);
}
```

**Files to create:**
- `whatsapp-bot/src/rateLimit.ts` (NEW)

**Files to modify:**
- `whatsapp-bot/src/index.ts` (ADD RATE LIMIT CHECK)

**Success Criteria:**
- ✅ Users can't spam commands
- ✅ Prevents abuse
- ✅ Graceful rate limit messages

---

### 2.4 Logging & Monitoring (1 day)

**Add structured logging:**
```typescript
// whatsapp-bot/src/logger.ts

import winston from 'winston';

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Usage:
logger.info('Bet placed', { phone: phoneNumber, marketId, amount });
logger.error('Bet failed', { phone: phoneNumber, error: error.message });
```

**Files to create:**
- `whatsapp-bot/src/logger.ts` (NEW)

**Files to modify:**
- `whatsapp-bot/src/index.ts` (REPLACE console.log)
- `whatsapp-bot/src/commands.ts` (ADD LOGGING)

**Success Criteria:**
- ✅ All actions logged
- ✅ Errors tracked with context
- ✅ Easy to debug issues

---

## 🚀 PHASE 3: MAKE IT SCALE (Week 4)
**Goal:** Production deployment and reliability  
**Priority:** HIGH - Required for public launch

### 3.1 WhatsApp Business API Migration (3 days)

**Why migrate:**
- `whatsapp-web.js` requires QR code (not scalable)
- WhatsApp Business API is official and stable
- Supports webhooks (no polling)
- Better for production

**Setup steps:**
1. Create Meta Business Account
2. Get Phone Number ID
3. Generate Access Token
4. Configure Webhook URL

**Rewrite bot to use official API:**
```typescript
// whatsapp-bot/src/whatsappClient.ts

import axios from 'axios';

const GRAPH_API = 'https://graph.facebook.com/v18.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function sendMessage(to: string, message: string): Promise<void> {
    await axios.post(
        `${GRAPH_API}/${PHONE_ID}/messages`,
        {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: message }
        },
        {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
}

// Webhook handler
export function handleWebhook(req: any): void {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
        const from = message.from;
        const text = message.text?.body;
        // Process message
    }
}
```

**Files to create:**
- `whatsapp-bot/src/whatsappClient.ts` (NEW)
- `whatsapp-bot/src/webhook.ts` (NEW)

**Files to modify:**
- `whatsapp-bot/src/index.ts` (REWRITE)

**Success Criteria:**
- ✅ No QR code needed
- ✅ Webhook receives messages
- ✅ Bot responds via API

---

### 3.2 Deployment (2 days)

**Deploy to Railway/Render:**

**Option A: Railway**
```yaml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
```

**Option B: Render**
```yaml
# render.yaml
services:
  - type: web
    name: whatsapp-bot
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
```

**Environment setup:**
```env
# Production .env
NODE_ENV=production
API_URL=https://your-api.com/api
REDIS_URL=redis://your-redis:6379
DATABASE_URL=postgresql://user:pass@host:5432/db
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_token
ENCRYPTION_KEY=your_32_byte_key
```

**Files to create:**
- `whatsapp-bot/Dockerfile` (OPTIONAL)
- `railway.toml` or `render.yaml`
- `.github/workflows/deploy.yml` (CI/CD)

**Success Criteria:**
- ✅ Bot runs 24/7
- ✅ Auto-restarts on crash
- ✅ Environment variables secure

---

## 💎 PHASE 4: MAKE IT BETTER (Week 5-6)
**Goal:** Enhanced features and UX improvements  
**Priority:** MEDIUM - Nice to have

### 4.1 Notifications (2 days)

**Implement proactive notifications:**
```typescript
// src/services/whatsappNotifications.ts

export async function sendNotification(phoneNumber: string, type: string, data: any): Promise<void> {
    let message = '';
    
    switch (type) {
        case 'BET_PLACED':
            message = `✅ Bet placed!\n${data.side} on "${data.market}"\nShares: ${data.shares}`;
            break;
        case 'MARKET_RESOLVED':
            message = `🎉 Market resolved!\n"${data.market}"\nYou ${data.won ? 'WON' : 'LOST'} $${data.amount}`;
            break;
        case 'DEPOSIT_RECEIVED':
            message = `💰 Deposit received!\n$${data.amount} USDC\nNew balance: $${data.newBalance}`;
            break;
    }
    
    await sendMessage(phoneNumber, message);
}
```

**Add notification preferences:**
```sql
CREATE TABLE notification_preferences (
    phone_number VARCHAR(20) PRIMARY KEY,
    bet_confirmations BOOLEAN DEFAULT TRUE,
    market_resolutions BOOLEAN DEFAULT TRUE,
    deposit_alerts BOOLEAN DEFAULT TRUE,
    daily_summary BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (phone_number) REFERENCES whatsapp_users(phone_number)
);
```

**Files to modify:**
- `src/services/whatsappNotifications.ts` (IMPLEMENT)
- `src/models/index.ts` (ADD TABLE)

**Success Criteria:**
- ✅ Users get bet confirmations
- ✅ Users notified when markets resolve
- ✅ Users can disable notifications

---

### 4.2 Withdrawal System (2 days)

**Implement real withdrawals:**
```typescript
// src/controllers/walletController.ts

export async function processWithdrawal(phoneNumber: string, amount: number, toAddress: string): Promise<string> {
    // 1. Validate balance
    const balance = await getBalance(phoneNumber);
    if (amount > parseFloat(balance)) {
        throw new Error('Insufficient balance');
    }
    
    // 2. Get user wallet
    const user = await db.query('SELECT wallet_address, encrypted_private_key FROM whatsapp_users WHERE phone_number = $1', [phoneNumber]);
    const privateKey = await decrypt(user.rows[0].encrypted_private_key);
    
    // 3. Create transaction
    const wallet = new ethers.Wallet(privateKey, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
    
    // 4. Send USDC
    const tx = await usdcContract.transfer(toAddress, ethers.utils.parseUnits(amount.toString(), 6));
    await tx.wait();
    
    // 5. Log transaction
    await db.query(
        'INSERT INTO whatsapp_transactions (phone_number, type, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5)',
        [phoneNumber, 'WITHDRAW', amount, tx.hash, 'SUCCESS']
    );
    
    return tx.hash;
}
```

**Add withdrawal limits:**
```typescript
const WITHDRAWAL_LIMITS = {
    MIN: 10,        // $10 minimum
    MAX_DAILY: 1000, // $1000 per day
    MAX_WEEKLY: 5000 // $5000 per week
};
```

**Files to modify:**
- `src/controllers/walletController.ts` (IMPLEMENT)
- `whatsapp-bot/src/commands.ts` (CONNECT)

**Success Criteria:**
- ✅ Users can withdraw to any address
- ✅ Withdrawals execute on blockchain
- ✅ Limits prevent abuse

---

### 4.3 Enhanced UX (2 days)

**Add rich features:**

1. **Market images** (if WhatsApp Business API supports)
2. **Quick reply buttons** (instead of typing numbers)
3. **Portfolio charts** (text-based)
4. **Leaderboard** (top traders)
5. **Referral system** (invite friends)

**Example - Quick reply buttons:**
```typescript
await sendMessage(phoneNumber, {
    type: 'interactive',
    interactive: {
        type: 'button',
        body: { text: 'Choose an option:' },
        action: {
            buttons: [
                { type: 'reply', reply: { id: '1', title: 'Markets' } },
                { type: 'reply', reply: { id: '2', title: 'Profile' } },
                { type: 'reply', reply: { id: '3', title: 'Deposit' } }
            ]
        }
    }
});
```

**Files to modify:**
- `whatsapp-bot/src/messages.ts` (ENHANCE)
- `whatsapp-bot/src/commands.ts` (ADD FEATURES)

**Success Criteria:**
- ✅ Better user experience
- ✅ Faster navigation
- ✅ More engaging

---

## 📊 SUCCESS METRICS

### Phase 1 (Week 1-2):
- [ ] 100% of bets execute on blockchain
- [ ] 0% mock data in responses
- [ ] Balance shows real USDC

### Phase 2 (Week 3):
- [ ] Sessions persist across restarts
- [ ] 0 crashes from bad input
- [ ] All errors logged

### Phase 3 (Week 4):
- [ ] Bot runs 24/7 without QR code
- [ ] 99% uptime
- [ ] Webhook latency < 1s

### Phase 4 (Week 5-6):
- [ ] Users receive notifications
- [ ] Withdrawals work
- [ ] Enhanced UX features live

---

## 🚨 CRITICAL PATH

**Must complete before launch:**
1. ✅ Phase 1 (Backend integration)
2. ✅ Phase 2 (Security & persistence)
3. ✅ Phase 3 (Production deployment)

**Can add after launch:**
- Phase 4 (Enhanced features)
- Referral system
- Advanced analytics

---

## 📅 TIMELINE SUMMARY

| Week | Phase | Focus | Deliverable |
|------|-------|-------|-------------|
| 1-2 | Phase 1 | Backend Integration | Real bets working |
| 3 | Phase 2 | Security | Safe for real money |
| 4 | Phase 3 | Deployment | Live on WhatsApp Business API |
| 5-6 | Phase 4 | Features | Notifications, withdrawals, UX |

**Total time to MVP:** 4 weeks  
**Total time to full features:** 6 weeks

---

## 💰 ESTIMATED COSTS

### Development (4-6 weeks):
- Developer time: $0 (you)
- Total: $0

### Monthly Infrastructure:
- Railway/Render: $5-20
- Redis: $0-10 (free tier)
- WhatsApp Business API: $0 (free for first 1000 conversations/month)
- **Total: $5-30/month**

### First Year Total: $60-360

---

## 🎯 NEXT IMMEDIATE STEPS (Start Today)

1. **Create database tables** (30 min)
   ```bash
   cd src/models
   # Add whatsapp_users and whatsapp_transactions tables
   ```

2. **Create custodial wallet service** (2 hours)
   ```bash
   cd src/services
   touch custodialWallet.ts encryption.ts
   ```

3. **Create WhatsApp user endpoint** (1 hour)
   ```bash
   cd src/controllers
   touch whatsappController.ts
   ```

4. **Test end-to-end** (1 hour)
   - Send "menu" via WhatsApp
   - Place a bet
   - Verify on blockchain

**Total time to first working bet: ~5 hours**

---

**Last Updated:** 2024  
**Version:** 2.0  
**Status:** Ready to implement
