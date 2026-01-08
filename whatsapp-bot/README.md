# OPOLL WhatsApp Bot

WhatsApp bot for the OPOLL prediction market platform.

## Features

- 📊 View active markets and odds
- 💰 Check portfolio and balance
- 🎯 Place bets directly from WhatsApp
- 🌐 Generate Magic Links to web terminal
- 💵 Get deposit addresses

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API URLs
```

3. Start the bot:
```bash
npm run dev
```

4. Scan QR code with WhatsApp

## Commands

- `/help` - Show all commands
- `/markets` - View active markets
- `/price <market>` - Get current odds
- `/bet <market> <YES|NO> <amount>` - Place a bet
- `/portfolio` - View your positions
- `/deposit` - Get deposit address
- `/terminal` - Access web dashboard

## Architecture

```
whatsapp-bot/
├── src/
│   ├── index.ts      # Main bot entry point
│   ├── commands.ts   # Command handlers
│   └── api.ts        # Backend API client
├── package.json
└── tsconfig.json
```

## Production Deployment

For production, use WhatsApp Business API instead of whatsapp-web.js:
- Sign up at https://business.whatsapp.com/
- Get Phone Number ID and Access Token
- Update API client to use official API

## Notes

- Uses `whatsapp-web.js` for development (requires QR scan)
- Session persists with `LocalAuth`
- Commands must start with `/`
- Magic Links expire in 10 minutes
