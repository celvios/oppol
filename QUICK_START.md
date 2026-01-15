# Phase 1 - Quick Start Guide

## 🚀 Start Testing in 5 Minutes

### Prerequisites
- Node.js installed
- WhatsApp on your phone
- Terminal access

---

## Step 1: Start Backend (Terminal 1)

```bash
cd c:\Users\toluk\Documents\predict
npm install
npm run dev
```

**Wait for**: `✅ Database Initialization Complete`

---

## Step 2: Run Migration (Terminal 2)

```bash
curl -X POST http://localhost:3000/api/admin/migrate -H "Content-Type: application/json"
```

**Expected**: `{"success": true}`

---

## Step 3: Start WhatsApp Bot (Terminal 3)

```bash
cd c:\Users\toluk\Documents\predict\whatsapp-bot
npm install
npm run dev
```

**Wait for**: QR code appears

---

## Step 4: Link WhatsApp

1. Open WhatsApp on phone
2. Settings → Linked Devices
3. Link a Device
4. Scan QR code

**Wait for**: `✅ Bot is ONLINE`

---

## Step 5: Test Basic Flow

Send these messages to the bot:

```
1. "menu"           → Should show main menu
2. "2"              → Should show profile with $0.00 balance
3. "0"              → Back to menu
4. "3"              → Should show YOUR unique deposit address
5. "0"              → Back to menu
6. "1"              → Should show real markets from blockchain
```

---

## ✅ Success Indicators

You'll know Phase 1 works if:

1. ✅ Balance shows `$0.00` (not `$1000.00`)
2. ✅ Deposit address is unique (not `0x71C7...`)
3. ✅ Markets list shows real data
4. ✅ Profile shows 0 positions (not mock data)
5. ✅ No errors in console

---

## 🎯 Quick Test: Place a Bet

### Fund Your Wallet First:

```bash
# Get your deposit address from Step 5 above, then:
curl -X POST http://localhost:3000/api/faucet ^
  -H "Content-Type: application/json" ^
  -d "{\"address\": \"YOUR_DEPOSIT_ADDRESS\"}"
```

### Place Bet:

```
1. "menu"
2. "1"              → Markets
3. "1"              → Select first market
4. "1"              → Buy YES
5. "10"             → Bet $10
6. "1"              → Confirm
```

**Expected**: Real transaction hash (not random)

---

## 🐛 Troubleshooting

### Bot doesn't respond?
- Check Terminal 3 for errors
- Restart bot: Ctrl+C, then `npm run dev`

### Balance shows $0.00?
- Normal for new users
- Use faucet to add funds (see above)

### "User wallet not found"?
- Send "menu" first to create wallet
- Check Terminal 1 for wallet creation log

### Markets list empty?
- Check Terminal 1 is running
- Test: `curl http://localhost:3000/api/markets`

---

## 📊 What Changed?

| Feature | Before | After |
|---------|--------|-------|
| Balance | Mock $1000 | Real $0.00 |
| Deposit | Hardcoded | Unique per user |
| Positions | Empty | Real from blockchain |
| Bets | Fake TX | Real blockchain TX |

---

## 📝 Next Steps

After testing:
1. Read `PHASE_1_TESTING.md` for detailed tests
2. Read `PHASE_1_SUMMARY.md` for technical details
3. Report any bugs found
4. Move to Phase 2 (Redis, Rate Limiting, OTP)

---

## 🆘 Need Help?

Check logs:
- Backend: Terminal 1
- Bot: Terminal 3
- Blockchain: https://testnet.bscscan.com

Test endpoints:
```bash
# Health check
curl http://localhost:3000

# Markets
curl http://localhost:3000/api/markets

# Your wallet
curl "http://localhost:3000/api/whatsapp/user?phone=YOUR_PHONE"
```

---

**Time to Complete**: 5 minutes
**Difficulty**: Easy
**Status**: Ready to test
