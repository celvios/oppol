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

### User Commands
- `start` / `menu` - Main menu
- `markets` / `m` - Browse active markets
- `search` / `s` - Search markets by keyword
- `profile` / `p` - View your profile
- `deposit` / `d` - Get deposit address
- `withdraw` / `w` - Withdraw funds
- `positions` / `pos` - View your bets
- `alerts` / `a` - View price alerts
- `help` / `h` / `?` - How it works
- `cancel` - Cancel current action

### Admin Commands (requires ADMIN_PHONES)
- `admin` - View admin commands
- `stats` - View bot statistics
- `users` - View user count

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

## Production Deployment

**Status:** ✅ Ready for production!

See detailed guides:
- 📋 [Quick Deployment Checklist](./DEPLOY_CHECKLIST.md)
- 🚀 [Full Production Deployment Guide](./PRODUCTION_DEPLOY.md)
- 🗺️ [Feature Roadmap (Phases 4-12)](./ROADMAP.md)

### Quick Deploy to Render
1. Push to GitHub
2. Connect to Render
3. Add environment variables
4. Deploy!

See [PRODUCTION_DEPLOY.md](./PRODUCTION_DEPLOY.md) for step-by-step instructions.

## Next Features (Roadmap)

- **Phase 4:** Alert Management & Notifications (2-3h)
- **Phase 5:** Categories & Filters (2-3h)
- **Phase 6:** Transaction History (2h)
- **Phase 7:** Enhanced UX (3-4h)
- **Phase 8:** Complete Admin Panel (3-4h)
- **Phase 9:** Testing & Reliability (4-5h)
- **Phase 10:** Performance & Scaling (5-6h)
- **Phase 11:** Advanced Features (8-10h)
- **Phase 12:** Business Features (10-12h)

See [ROADMAP.md](./ROADMAP.md) for detailed feature breakdown.
