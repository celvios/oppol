# Twilio WhatsApp Setup Guide (Meta Alternative)

## Why Twilio?
- Works globally (even where Meta is blocked)
- 5-minute setup
- Free sandbox for testing
- Production-ready API

---

## Step 1: Create Twilio Account

1. Go to: https://www.twilio.com/try-twilio
2. Sign up with email
3. Verify phone number
4. Skip the "What are you building?" questions

**You get $15 free credit!**

---

## Step 2: Enable WhatsApp Sandbox

### 2.1 Navigate to WhatsApp
1. In Twilio Console, go to: **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Or direct link: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

### 2.2 Join Sandbox
1. You'll see a WhatsApp number (e.g., +1 415 523 8886)
2. You'll see a code (e.g., "join abc-def")
3. **On your phone:**
   - Open WhatsApp
   - Message that number
   - Send: `join abc-def`
4. You'll get confirmation message

**Sandbox is now active!**

---

## Step 3: Get API Credentials

### 3.1 Get Account SID and Auth Token
1. Go to: https://console.twilio.com/
2. On dashboard, you'll see:
   - **Account SID**: (e.g., ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
   - **Auth Token**: Click "Show" to reveal
3. Copy both

### 3.2 Get WhatsApp Number
- **Sandbox number**: +1 415 523 8886 (or similar)
- **Format**: whatsapp:+14155238886

---

## Step 4: Install Twilio SDK

```bash
cd whatsapp-bot
npm install twilio
```

---

## Step 5: Update Your Code

### 5.1 Create Twilio Client

Create `whatsapp-bot/src/twilioClient.ts`:

```typescript
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER; // whatsapp:+14155238886

const client = twilio(accountSid, authToken);

export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
    try {
        // Format: whatsapp:+1234567890
        const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
        
        await client.messages.create({
            from: twilioNumber,
            to: formattedTo,
            body: message
        });
        
        console.log(`✅ Message sent to ${to}`);
    } catch (error) {
        console.error('❌ Twilio send error:', error);
        throw error;
    }
}

export async function setupWebhook(webhookUrl: string): Promise<void> {
    console.log(`📞 Webhook URL: ${webhookUrl}/webhook/whatsapp`);
    console.log('⚠️  Configure this in Twilio Console manually');
}
```

### 5.2 Create Webhook Handler

Create `whatsapp-bot/src/webhookHandler.ts`:

```typescript
import { Request, Response } from 'express';
import { commandHandler } from './commands';
import { sendWhatsAppMessage } from './twilioClient';
import { logger } from './logger';

export async function handleTwilioWebhook(req: Request, res: Response): Promise<void> {
    try {
        const { From, Body } = req.body;
        
        // Remove 'whatsapp:' prefix
        const phoneNumber = From.replace('whatsapp:', '').replace('+', '');
        const message = Body?.trim();
        
        if (!message) {
            res.status(200).send('OK');
            return;
        }
        
        logger.info('Webhook received', { from: phoneNumber, message });
        
        // Create mock message object for compatibility
        const mockMessage = {
            body: message,
            from: `${phoneNumber}@c.us`,
            reply: async (text: string) => {
                await sendWhatsAppMessage(From, text);
            }
        };
        
        // Process message
        const response = await commandHandler.handleMessage(mockMessage as any);
        
        // Send response
        await sendWhatsAppMessage(From, response);
        
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook error', { error });
        res.status(500).send('Error');
    }
}
```

### 5.3 Update Main Bot

Update `whatsapp-bot/src/index.ts`:

```typescript
import express from 'express';
import dotenv from 'dotenv';
import { handleTwilioWebhook } from './webhookHandler';
import { logger } from './logger';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Webhook endpoint
app.post('/webhook/whatsapp', handleTwilioWebhook);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
    logger.info(`🚀 Twilio WhatsApp Bot running on port ${PORT}`);
    logger.info(`📞 Webhook: http://localhost:${PORT}/webhook/whatsapp`);
});
```

---

## Step 6: Update Environment Variables

Update `whatsapp-bot/.env`:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# API Configuration
API_URL=http://localhost:3000/api
FRONTEND_URL=http://localhost:3001

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3002
```

---

## Step 7: Configure Webhook in Twilio

### 7.1 Expose Your Bot (for testing)

**Option A: ngrok**
```bash
# Start bot
npm run dev

# In another terminal
ngrok http 3002

# Copy HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Deploy to Railway/Render**
(See deployment guide)

### 7.2 Set Webhook in Twilio
1. Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
2. Under "When a message comes in":
   - Enter: `https://your-domain.com/webhook/whatsapp`
   - Method: POST
3. Click "Save"

---

## Step 8: Test

1. Message the Twilio sandbox number from your phone
2. Send: "menu"
3. Bot should respond!

---

## Step 9: Go to Production

### 9.1 Request Production Access
1. In Twilio Console, go to **WhatsApp** → **Senders**
2. Click "Request to enable your Twilio numbers for WhatsApp"
3. Fill out form (takes 1-3 days)

### 9.2 Get Your Own Number
Once approved:
1. Buy a Twilio phone number
2. Enable WhatsApp on it
3. Update TWILIO_WHATSAPP_NUMBER in .env

---

## Pricing

### Sandbox (Testing):
- **FREE** (uses your $15 credit)
- Limited to numbers that joined sandbox

### Production:
- **Inbound messages:** $0.005 per message
- **Outbound messages:** $0.005 per message
- **Example:** 1,000 users, 5 messages each = $25/month

---

## Comparison: Twilio vs whatsapp-web.js

| Feature | whatsapp-web.js | Twilio |
|---------|-----------------|--------|
| Setup | QR code | 5 minutes |
| Reliability | Medium | High |
| Scalability | Low | High |
| Cost | Free | ~$25-50/month |
| Production-ready | No | Yes |
| Works globally | Depends | Yes |

---

## Migration Checklist

- [ ] Create Twilio account
- [ ] Join WhatsApp sandbox
- [ ] Get Account SID and Auth Token
- [ ] Install twilio package
- [ ] Create twilioClient.ts
- [ ] Create webhookHandler.ts
- [ ] Update index.ts
- [ ] Update .env
- [ ] Expose bot with ngrok
- [ ] Configure webhook in Twilio
- [ ] Test by sending message
- [ ] Deploy to production
- [ ] Request production access

---

## Troubleshooting

### "Message not received"
- Check webhook URL is correct
- Verify ngrok is running
- Check Twilio logs: https://console.twilio.com/us1/monitor/logs/debugger

### "Authentication failed"
- Verify Account SID and Auth Token
- Check .env file is loaded

### "Cannot send to this number"
- In sandbox, recipient must join first
- Send "join abc-def" to sandbox number

---

## Next Steps

Once Twilio is working:
1. Deploy to Railway/Render
2. Request production access
3. Get your own WhatsApp number
4. Launch!

---

**Estimated Time:**
- Setup: 30 minutes
- Testing: 30 minutes
- Production approval: 1-3 days
- **Total: 1-3 days**

**Cost:**
- Testing: FREE ($15 credit)
- Production: ~$25-50/month for 1,000 users
