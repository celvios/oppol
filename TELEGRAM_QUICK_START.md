# Telegram Bot Quick Start

## ✅ Migration Complete!

Your bot is now using Telegram instead of WhatsApp.

---

## Setup (5 minutes)

### 1. Get Your Bot Token

1. Open Telegram
2. Search for: `@BotFather`
3. Send: `/newbot`
4. Choose name: `OPOLL Prediction Bot`
5. Choose username: `opoll_predict_bot` (must end in 'bot')
6. Copy the token (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Add Token to .env

Edit `whatsapp-bot/.env`:
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Install Dependencies

```bash
cd whatsapp-bot
npm install
```

### 4. Start Bot

```bash
npm run dev
```

### 5. Test

1. Open Telegram
2. Search for your bot: `@opoll_predict_bot`
3. Send: `/start` or `menu`
4. Bot should respond!

---

## What Changed

### ✅ Benefits:
- **FREE forever** (no Twilio costs)
- **No QR code** needed
- **Better UX** - Can add inline buttons
- **Instant setup** - No approval needed
- **Crypto-friendly** - Your users are here

### 📝 Code Changes:
- Replaced `whatsapp-web.js` with `node-telegram-bot-api`
- Updated `index.ts` to use Telegram
- Updated `.env` with bot token
- Everything else stays the same!

---

## Commands

Users can send:
- `/start` or `menu` - Main menu
- `/help` - Help
- Numbers to navigate (1, 2, 3, etc.)

---

## Future Enhancements

Telegram supports:
- ✅ Inline keyboards (buttons)
- ✅ Rich formatting (bold, italic, links)
- ✅ Images and charts
- ✅ Groups and channels
- ✅ Payments API

We can add these later!

---

## Troubleshooting

### "TELEGRAM_BOT_TOKEN not found"
- Check `.env` file has the token
- Make sure no spaces around `=`
- Restart bot after changing .env

### "Bot not responding"
- Check bot is running (`npm run dev`)
- Check token is correct
- Try `/start` command

### "Polling error"
- Token might be invalid
- Check internet connection
- Try creating new bot with @BotFather

---

## Cost Comparison

| | WhatsApp (Twilio) | Telegram |
|---|---|---|
| Setup | 30 min | **5 min** |
| Cost/month | $25-50 | **$0** |
| Cost/year | $300-600 | **$0** |
| Approval | Required | **None** |

**Savings: $300-600/year!**

---

## Next Steps

1. ✅ Get bot token from @BotFather
2. ✅ Add to .env
3. ✅ Run `npm install`
4. ✅ Run `npm run dev`
5. ✅ Test with `/start`
6. 🚀 Launch!

---

**Need help?** Check the logs in `whatsapp-bot/logs/`
