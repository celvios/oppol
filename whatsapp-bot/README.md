# OPOLL WhatsApp Bot

WhatsApp bot for OPOLL prediction markets using Twilio.

## Setup

### 1. Install Dependencies
```bash
cd whatsapp-bot
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Twilio credentials:
- Get credentials from: https://console.twilio.com
- Get WhatsApp sandbox number from: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

### 3. Setup Twilio Webhook

#### Development (using ngrok):
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3002
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and:
1. Go to Twilio Console → Messaging → Try it Out → Send a WhatsApp message
2. Set webhook URL: `https://abc123.ngrok.io/webhook/whatsapp`

#### Production:
Set webhook URL to: `https://your-domain.com/webhook/whatsapp`

### 4. Run Bot

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Testing

1. Join WhatsApp sandbox: Send "join <code>" to your Twilio WhatsApp number
2. Send "start" to begin
3. Try commands:
   - `markets` - Browse markets
   - `profile` - View profile
   - `deposit` - Get deposit address
   - `help` - Show help

## Commands

- `start` / `menu` - Main menu
- `markets` - Browse active markets
- `profile` - View your profile
- `deposit` - Get deposit address
- `withdraw` - Withdraw funds
- `positions` - View your bets
- `help` - How it works

## Architecture

```
whatsapp-bot/
├── src/
│   ├── index.ts       - Main bot & webhook
│   ├── api.ts         - Backend API client
│   ├── session.ts     - Session management
│   ├── messages.ts    - Message templates
│   ├── helpers.ts     - Utility functions
│   └── types.ts       - TypeScript types
```

## Deployment

### Render / Railway / Heroku:
1. Push to GitHub
2. Connect repository
3. Set environment variables
4. Deploy
5. Update Twilio webhook URL

### PM2 (VPS):
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name whatsapp-bot
pm2 save
```
