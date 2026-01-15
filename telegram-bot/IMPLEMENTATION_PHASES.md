# Telegram Bot Implementation - Phased Approach

## Overview
Building OPOLL Telegram bot from scratch with clear phases.

---

## PHASE 1: Basic Bot Setup (15 minutes)
**Goal:** Get bot running and responding to messages

### What We'll Build:
- ✅ Basic bot connection
- ✅ Message handler
- ✅ Simple menu system
- ✅ Test with /start command

### Files:
- `package.json` - Dependencies
- `.env` - Bot token
- `src/index.ts` - Main bot file
- `src/messages.ts` - Message templates

### Test:
- Send `/start` → Get menu
- Send `1` → Get response

---

## PHASE 2: State Management (20 minutes)
**Goal:** Add Redis sessions and navigation

### What We'll Build:
- ✅ Redis session storage
- ✅ State machine (IDLE, MENU, MARKETS, etc.)
- ✅ Navigation between states

### Files:
- `src/session.ts` - Redis sessions
- `src/commands.ts` - Command router

### Test:
- Navigate through menus
- Restart bot → Session persists

---

## PHASE 3: Market Integration (30 minutes)
**Goal:** Connect to backend API and show markets

### What We'll Build:
- ✅ API client
- ✅ Fetch markets from backend
- ✅ Display market list
- ✅ Show market details

### Files:
- `src/api.ts` - API client
- Update `src/commands.ts` - Market handlers

### Test:
- View markets
- Select a market
- See market details

---

## PHASE 4: Betting System (30 minutes)
**Goal:** Place real bets on blockchain

### What We'll Build:
- ✅ Bet amount input
- ✅ Bet confirmation
- ✅ Execute bet via API
- ✅ Show success message

### Files:
- Update `src/commands.ts` - Bet handlers
- Update `src/api.ts` - Bet endpoint

### Test:
- Select market
- Choose YES/NO
- Enter amount
- Confirm bet
- ✅ Bet executes on blockchain

---

## PHASE 5: User Features (20 minutes)
**Goal:** Profile, balance, deposits

### What We'll Build:
- ✅ Check balance
- ✅ View positions
- ✅ Deposit address
- ✅ Profile summary

### Files:
- Update `src/commands.ts` - Profile handlers
- Update `src/api.ts` - Balance/positions

### Test:
- Check balance
- View positions
- Get deposit address

---

## PHASE 6: Polish (15 minutes)
**Goal:** Error handling, logging, validation

### What We'll Build:
- ✅ Input validation
- ✅ Error messages
- ✅ Logging
- ✅ Rate limiting

### Files:
- `src/validators.ts` - Input validation
- `src/errors.ts` - Error handling
- `src/logger.ts` - Winston logger
- `src/rateLimit.ts` - Rate limiter

### Test:
- Try invalid inputs
- Check logs
- Test rate limiting

---

## Total Time: ~2 hours

## Current Phase: PHASE 1
**Next:** Basic bot setup

---

## Quick Start

### Prerequisites:
- ✅ Bot token from @BotFather: `8430885756:AAHnbOZSBdV6M6M7QzhXVJX0iFzkiArB1KU`
- ✅ Redis running
- ✅ Backend API running

### Commands:
```bash
cd telegram-bot
npm install
npm run dev
```

---

## Success Criteria

### Phase 1: ✅
- Bot responds to /start
- Shows menu

### Phase 2: ✅
- Can navigate menus
- Sessions persist

### Phase 3: ✅
- Shows real markets
- Can select market

### Phase 4: ✅
- Can place bet
- Bet executes on blockchain

### Phase 5: ✅
- Shows balance
- Shows positions

### Phase 6: ✅
- Handles errors gracefully
- Logs all actions
