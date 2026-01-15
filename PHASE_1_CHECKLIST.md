# WhatsApp Bot - Phase 1 Quick Start Checklist

## 🚀 START HERE - Week 1 Tasks

### Day 1-2: Fix Balance & Wallet Integration

#### Task 1.1: Real Balance Fetching
**File**: `whatsapp-bot/src/commands.ts`

```typescript
// BEFORE (Line ~380):
private async getBalance(phoneNumber: string): Promise<string> {
    // TODO: Fetch from backend
    return '1000.00';
}

// AFTER:
private async getBalance(phoneNumber: string): Promise<string> {
    try {
        const user = await apiClient.getUserByPhone(phoneNumber);
        if (!user?.walletAddress) {
            return '0.00';
        }
        return await apiClient.getBalance(user.walletAddress);
    } catch (error) {
        console.error('Balance fetch error:', error);
        return '0.00';
    }
}
```

#### Task 1.2: Create User-Wallet Mapping
**File**: `src/app.ts` - Add new endpoint

```typescript
// Add after line 100
app.post('/api/whatsapp/user', async (req, res) => {
    const { phoneNumber } = req.body;
    
    // Check if user exists
    let user = await query(
        'SELECT wallet_address FROM whatsapp_users WHERE phone_number = $1',
        [phoneNumber]
    );
    
    if (user.rows.length === 0) {
        // Create custodial wallet
        const { address, privateKey } = createRandomWallet();
        const encryptedKey = encrypt(privateKey);
        
        await query(
            'INSERT INTO whatsapp_users (phone_number, wallet_address, encrypted_private_key) VALUES ($1, $2, $3)',
            [phoneNumber, address, encryptedKey]
        );
        
        return res.json({ success: true, walletAddress: address });
    }
    
    return res.json({ success: true, walletAddress: user.rows[0].wallet_address });
});
```

#### Task 1.3: Update API Client
**File**: `whatsapp-bot/src/api.ts`

```typescript
// Add after line 30
async getUserByPhone(phoneNumber: string): Promise<{ walletAddress: string } | null> {
    try {
        const response = await axios.get(`${API_URL}/whatsapp/user`, {
            params: { phone: phoneNumber }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

// Update getBalance (line ~70)
async getBalance(walletAddress: string): Promise<string> {
    try {
        const response = await axios.get(`${API_URL}/wallet/balance/${walletAddress}`);
        return response.data.balanceFormatted || '0.00';
    } catch (error) {
        console.error('Error fetching balance:', error);
        return '0.00';
    }
}
```

---

### Day 3-4: Fix Position Tracking

#### Task 2.1: Fetch Real Positions
**File**: `whatsapp-bot/src/commands.ts`

```typescript
// Update buildProfileMessage (line ~360)
private async buildProfileMessage(phoneNumber: string): Promise<string> {
    try {
        const user = await apiClient.getUserByPhone(phoneNumber);
        if (!user?.walletAddress) {
            return messages.error;
        }
        
        const balance = await apiClient.getBalance(user.walletAddress);
        const positions = await apiClient.getPositions(user.walletAddress);
        
        // Calculate total PnL
        let totalPnL = 0;
        const formattedPositions = positions.map(p => {
            const pnl = (p.currentValue - p.costBasis).toFixed(2);
            totalPnL += parseFloat(pnl);
            return {
                market: p.marketQuestion,
                side: p.side,
                shares: p.shares,
                pnl
            };
        });
        
        return messages.profile(
            balance,
            positions.length,
            totalPnL.toFixed(2),
            formattedPositions
        );
    } catch (error) {
        console.error('Error building profile:', error);
        return messages.error;
    }
}
```

#### Task 2.2: Update API Client Positions
**File**: `whatsapp-bot/src/api.ts`

```typescript
// Update getPositions (line ~150)
async getPositions(walletAddress: string): Promise<any[]> {
    try {
        const response = await axios.get(`${API_URL}/portfolio/${walletAddress}`);
        if (!response.data.success) return [];
        
        // Fetch current prices for each position
        const positions = await Promise.all(
            response.data.positions.map(async (p: any) => {
                const market = await this.getMarket(p.marketId);
                const currentPrice = p.side === 'YES' ? market.yesOdds / 100 : (100 - market.yesOdds) / 100;
                const currentValue = p.shares * currentPrice;
                
                return {
                    marketId: p.marketId,
                    marketQuestion: market.question,
                    side: p.side,
                    shares: p.shares,
                    costBasis: p.totalCost,
                    currentValue,
                    avgPrice: p.avgPrice
                };
            })
        );
        
        return positions;
    } catch (error) {
        console.error('Error fetching positions:', error);
        return [];
    }
}
```

---

### Day 5: Fix Bet Placement

#### Task 3.1: Real Transaction Handling
**File**: `whatsapp-bot/src/commands.ts`

```typescript
// Update handleBetConfirm (line ~220)
private async handleBetConfirm(phoneNumber: string, input: string): Promise<string> {
    const session = getSession(phoneNumber);

    if (input === '0' || input === 'cancel' || input === 'back') {
        updateSession(phoneNumber, { state: BotState.BET_AMOUNT });
        const market = await apiClient.getMarket(session.selectedMarketId!);
        const user = await apiClient.getUserByPhone(phoneNumber);
        const balance = await apiClient.getBalance(user!.walletAddress);
        return messages.betAmount(session.betSide!, market.question, balance);
    }

    if (input === '1' || input === 'confirm' || input === 'yes') {
        try {
            const user = await apiClient.getUserByPhone(phoneNumber);
            if (!user) {
                return messages.error;
            }
            
            // Show processing message
            await message.reply('⏳ Processing your bet...');
            
            const result = await apiClient.placeBet(
                user.walletAddress,
                session.selectedMarketId!,
                session.betSide === 'YES',
                session.betAmount!
            );
            
            if (!result.success) {
                return `❌ Bet failed: ${result.error}\n\nReply *menu* to try again.`;
            }
            
            // Wait for transaction confirmation (30 seconds max)
            let confirmed = false;
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Check transaction status
                const status = await apiClient.getTransactionStatus(result.transaction.hash);
                if (status === 'confirmed') {
                    confirmed = true;
                    break;
                }
            }
            
            if (!confirmed) {
                return `⏳ Bet submitted but not yet confirmed.\n\nTX: ${result.transaction.hash.substring(0, 16)}...\n\nCheck your profile in a few minutes.`;
            }

            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.betSuccess(
                session.betSide!,
                result.transaction.shares,
                session.betAmount!,
                result.transaction.newPrice || 50
            );
        } catch (error: any) {
            console.error('Error placing bet:', error);
            return `❌ ${error.message || 'Failed to place bet'}\n\nReply *menu* to try again.`;
        }
    }

    return messages.invalidInput;
}
```

---

### Day 6-7: Database Schema & Testing

#### Task 4.1: Run Database Migration
**Command**:
```bash
curl -X POST http://localhost:3000/api/admin/migrate \
  -H "x-admin-secret: your-secret" \
  -H "Content-Type: application/json"
```

#### Task 4.2: Add WhatsApp Users Table
**File**: `src/models/index.ts` - Add to createTablesQuery

```sql
-- Add after line 20
CREATE TABLE IF NOT EXISTS whatsapp_users (
  phone_number VARCHAR(20) PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_wallet ON whatsapp_users(wallet_address);
```

#### Task 4.3: Test Everything
```bash
# Start backend
cd predict
npm run dev

# Start WhatsApp bot (separate terminal)
cd whatsapp-bot
npm run dev

# Test flow:
# 1. Send "menu" to bot
# 2. Select "1" (Markets)
# 3. Select a market
# 4. Place a bet
# 5. Check profile
# 6. Verify balance updated
```

---

## 🔍 Verification Checklist

After completing Phase 1, verify:

- [ ] Bot responds to "menu" command
- [ ] Markets list shows real data from blockchain
- [ ] Balance shows real on-chain balance (not 1000.00)
- [ ] Placing bet creates real blockchain transaction
- [ ] Transaction hash is real (not random)
- [ ] Profile shows actual positions
- [ ] PnL calculation is accurate
- [ ] Deposit address is unique per user
- [ ] No "TODO" comments in critical paths
- [ ] All API calls have error handling
- [ ] Console shows real transaction hashes

---

## 🚨 Common Issues & Solutions

### Issue 1: "Balance always shows 0.00"
**Solution**: Check if wallet has deposited USDC in contract
```bash
# Deposit USDC to contract
curl -X POST http://localhost:3000/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "YOUR_WALLET_ADDRESS"}'
```

### Issue 2: "Bet fails with insufficient balance"
**Solution**: User needs to deposit USDC to contract first
- Send USDC to wallet
- Approve contract
- Call deposit function

### Issue 3: "API returns 404"
**Solution**: Check backend is running on correct port
```bash
# Check backend
curl http://localhost:3000/api/markets

# Check environment
cat .env | grep API_URL
```

### Issue 4: "Transaction pending forever"
**Solution**: Check BSC testnet status
- Visit https://testnet.bscscan.com
- Check if network is congested
- Increase gas price if needed

---

## 📝 Testing Script

Create `whatsapp-bot/test-flow.md`:

```markdown
# Manual Test Flow

## Test 1: New User Flow
1. Send: "menu"
2. Expected: Welcome message + main menu
3. Send: "1"
4. Expected: Markets list with real data
5. Send: "1" (select first market)
6. Expected: Market details with odds
7. Send: "1" (buy YES)
8. Expected: Bet amount prompt with balance
9. Send: "10"
10. Expected: Confirmation with shares estimate
11. Send: "1" (confirm)
12. Expected: Success message with TX hash

## Test 2: Profile Check
1. Send: "menu"
2. Send: "2"
3. Expected: Profile with balance and positions
4. Verify: Balance decreased by bet amount
5. Verify: Position shows in list

## Test 3: Error Handling
1. Send: "menu"
2. Send: "1"
3. Send: "999" (invalid market)
4. Expected: Error message + markets list
5. Send: "0" (back)
6. Expected: Main menu

## Test 4: Insufficient Balance
1. Send: "menu"
2. Send: "1"
3. Select market
4. Send: "999999" (huge amount)
5. Expected: Insufficient balance error
```

---

## 🎯 Success Criteria for Phase 1

Phase 1 is complete when:

✅ All 4 tests above pass
✅ No mock data in responses
✅ Real blockchain transactions
✅ Balance updates correctly
✅ Positions tracked accurately
✅ Error messages are helpful
✅ Response time < 3 seconds
✅ No crashes for 1 hour of testing

---

## 📞 Need Help?

If stuck on any task:
1. Check logs: `tail -f whatsapp-bot/logs/app.log`
2. Check backend: `curl http://localhost:3000/api/markets`
3. Check blockchain: Visit BSCScan testnet
4. Review error messages in console
5. Test API endpoints with Postman

---

**Next**: After Phase 1, move to `PHASE_2_SECURITY.md`
