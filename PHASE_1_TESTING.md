# Phase 1 Testing Guide

## ✅ Changes Completed

### Backend Changes:
1. ✅ Added `whatsapp_users` table to database schema
2. ✅ Added mock database support for WhatsApp users
3. ✅ Created `/api/whatsapp/user` endpoint for user-wallet mapping

### WhatsApp Bot Changes:
1. ✅ Added `getUserByPhone()` method to API client
2. ✅ Updated `getBalance()` to fetch real on-chain balance
3. ✅ Updated `getDepositAddress()` to return user's custodial wallet
4. ✅ Updated `placeBet()` to use real wallet and throw errors
5. ✅ Updated `getPositions()` to fetch real positions with PnL
6. ✅ Updated `buildProfileMessage()` to show real positions
7. ✅ Updated `buildDepositMessage()` to show real address
8. ✅ Updated `getBalance()` helper to use API
9. ✅ Updated `handleBetConfirm()` to show specific errors

---

## 🚀 How to Test

### Step 1: Start Backend
```bash
cd c:\Users\toluk\Documents\predict
npm run dev
```

Expected output:
```
Server running on port 3000
✅ Database Initialization Complete
```

### Step 2: Run Database Migration
Open new terminal:
```bash
curl -X POST http://localhost:3000/api/admin/migrate ^
  -H "Content-Type: application/json"
```

Expected: `{"success": true, "message": "Database migration completed successfully"}`

### Step 3: Start WhatsApp Bot
Open new terminal:
```bash
cd c:\Users\toluk\Documents\predict\whatsapp-bot
npm run dev
```

Expected output:
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃          🎰 OPOLL WhatsApp Bot           ┃
┃         Prediction Markets on Chat       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

📱 Scan this QR code with WhatsApp:
```

### Step 4: Scan QR Code
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices
3. Tap "Link a Device"
4. Scan the QR code

Expected: `✅ Bot is ONLINE`

---

## 📱 Test Scenarios

### Test 1: New User Registration
**Goal**: Verify wallet creation for new users

1. Send: `menu`
2. Check backend logs for: `✅ Created wallet 0x... for phone +1234567890`
3. Verify: User gets main menu

**Expected Backend Log**:
```
📝 [MOCK DB] Query: select wallet_address from whatsapp_users
✅ Created wallet 0xABC123... for phone 1234567890
```

---

### Test 2: Check Balance (Empty Wallet)
**Goal**: Verify real balance fetching

1. Send: `menu`
2. Send: `2` (Profile)
3. Expected: Balance shows `$0.00` (not `$1000.00`)

**What Changed**: 
- ❌ OLD: Always showed mock `$1000.00`
- ✅ NEW: Shows real on-chain balance from contract

---

### Test 3: Get Deposit Address
**Goal**: Verify unique address per user

1. Send: `menu`
2. Send: `3` (Deposit)
3. Expected: Shows unique wallet address (not hardcoded `0x71C7...`)
4. Copy the address
5. Send `menu` and `3` again
6. Expected: Same address (persistent)

**What Changed**:
- ❌ OLD: Always showed `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`
- ✅ NEW: Shows user's unique custodial wallet

---

### Test 4: Fund Wallet (Preparation for Betting)
**Goal**: Add funds to test betting

```bash
# Get your wallet address from Step 3, then:
curl -X POST http://localhost:3000/api/faucet ^
  -H "Content-Type: application/json" ^
  -d "{\"address\": \"YOUR_WALLET_ADDRESS\"}"
```

Expected: `{"success": true, "transaction": {"hash": "0x...", "amount": "10000"}}`

Now deposit to contract:
```bash
# This requires the wallet to approve and deposit USDC to the market contract
# For now, we'll test with the faucet funds
```

---

### Test 5: Check Balance (After Funding)
**Goal**: Verify balance updates

1. Send: `menu`
2. Send: `2` (Profile)
3. Expected: Balance shows deposited amount

**What Changed**:
- ✅ Balance now reflects actual on-chain deposited balance in contract

---

### Test 6: Place Bet (Insufficient Balance)
**Goal**: Verify error handling

1. Send: `menu`
2. Send: `1` (Markets)
3. Send: `1` (Select first market)
4. Send: `1` (Buy YES)
5. Send: `999999` (huge amount)
6. Expected: `❌ Insufficient balance. Have: $X, Need: $999999`

**What Changed**:
- ❌ OLD: Would show mock success
- ✅ NEW: Shows real error from backend

---

### Test 7: Place Real Bet
**Goal**: Verify real transaction

**Prerequisites**: Wallet must have deposited USDC in contract

1. Send: `menu`
2. Send: `1` (Markets)
3. Send: `1` (Select market)
4. Send: `1` (Buy YES)
5. Send: `10` (bet $10)
6. Expected: Confirmation with estimated shares
7. Send: `1` (Confirm)
8. Expected: 
   - Processing message
   - Real transaction hash (not random)
   - Success message with actual shares

**What Changed**:
- ❌ OLD: Returned fake TX hash like `0x7a3f2b...` (random)
- ✅ NEW: Returns real TX hash from blockchain
- ❌ OLD: Always succeeded
- ✅ NEW: Can fail with specific error message

---

### Test 8: Check Profile (After Bet)
**Goal**: Verify position tracking

1. Send: `menu`
2. Send: `2` (Profile)
3. Expected:
   - Balance decreased by bet amount
   - Shows 1 position
   - Shows market name
   - Shows shares owned
   - Shows PnL (likely negative due to fees)

**What Changed**:
- ❌ OLD: Always showed 0 positions
- ✅ NEW: Shows real positions from blockchain
- ✅ NEW: Calculates PnL based on current price

---

## 🔍 Verification Checklist

After all tests, verify:

- [ ] No console errors in backend
- [ ] No console errors in WhatsApp bot
- [ ] Balance is NOT `$1000.00` (mock value)
- [ ] Deposit address is unique per user
- [ ] Bet creates real blockchain transaction
- [ ] Transaction hash is real (can verify on BSCScan)
- [ ] Profile shows actual positions
- [ ] PnL calculation is accurate
- [ ] Error messages are specific (not generic)

---

## 🐛 Common Issues & Solutions

### Issue 1: "Balance always shows $0.00"
**Cause**: Wallet has no deposited USDC in contract

**Solution**:
```bash
# 1. Mint USDC to wallet
curl -X POST http://localhost:3000/api/faucet -H "Content-Type: application/json" -d "{\"address\": \"YOUR_WALLET\"}"

# 2. Approve contract (need to implement)
# 3. Deposit to contract (need to implement)
```

**Temporary Workaround**: Use web interface to deposit

---

### Issue 2: "Bet fails with 'User wallet not found'"
**Cause**: User not created in database

**Solution**: Send `menu` command first to trigger user creation

---

### Issue 3: "Bet fails with 'Insufficient balance'"
**Cause**: User has USDC in wallet but not deposited in contract

**Solution**: 
- USDC balance ≠ Deposited balance
- User must deposit USDC to contract first
- Check: `GET /api/balance/:walletAddress` shows both balances

---

### Issue 4: "Transaction pending forever"
**Cause**: BSC testnet congestion

**Solution**:
- Check https://testnet.bscscan.com
- Wait 1-2 minutes
- Increase gas price if needed

---

### Issue 5: "Position not showing after bet"
**Cause**: Database not tracking trades

**Solution**: Check if trade was recorded:
```bash
curl http://localhost:3000/api/portfolio/YOUR_WALLET_ADDRESS
```

---

## 📊 Success Criteria

Phase 1 is complete when:

✅ All 8 test scenarios pass
✅ No mock data in responses
✅ Real blockchain transactions
✅ Balance updates correctly
✅ Positions tracked accurately
✅ Error messages are helpful
✅ Response time < 5 seconds
✅ No crashes for 30 minutes of testing

---

## 🎯 What's Still Mock/TODO

These will be fixed in later phases:

1. **Withdrawal** - Still returns fake TX hash
2. **Magic Link** - Returns null
3. **Notifications** - Only console.log
4. **Phone Verification** - No OTP
5. **Rate Limiting** - Not implemented
6. **Session Persistence** - In-memory (lost on restart)

---

## 📝 Next Steps

After Phase 1 testing passes:

1. Document any bugs found
2. Fix critical issues
3. Move to Phase 2: Security & Persistence
   - Implement Redis sessions
   - Add rate limiting
   - Add phone verification (OTP)

---

## 🆘 Need Help?

If tests fail:

1. Check backend logs: Look for errors in terminal
2. Check bot logs: Look for errors in WhatsApp bot terminal
3. Check blockchain: Visit https://testnet.bscscan.com
4. Check database: Verify tables exist
5. Check API: Test endpoints with curl

**Debug Commands**:
```bash
# Check if backend is running
curl http://localhost:3000

# Check markets endpoint
curl http://localhost:3000/api/markets

# Check user wallet
curl "http://localhost:3000/api/whatsapp/user?phone=1234567890"

# Check balance
curl http://localhost:3000/api/wallet/balance/YOUR_WALLET_ADDRESS
```

---

**Phase 1 Status**: ✅ Implementation Complete - Ready for Testing
**Next**: Run all test scenarios and document results
