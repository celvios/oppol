# Telegram Bot Error - Root Cause Analysis & Fix

## Problem Summary

The Telegram bot was failing with a 500 Internal Server Error whenever users tried to access markets, profiles, or deposit information.

## Root Cause

**The backend API was calling a non-existent smart contract function.**

### Technical Details:

1. **Contract Mismatch**: Your deployed contract `PredictionMarketMulti.sol` at address `0xB6a211822649a61163b94cf46e6fCE46119D3E1b` uses a complex struct for storing market data:
   ```solidity
   struct Market {
       string question;
       string[] outcomes;
       uint256[] shares;
       // ... more fields
   }
   mapping(uint256 => Market) public markets;
   ```

2. **The Problem**: Solidity cannot auto-generate a simple getter function for mappings that contain structs with dynamic arrays. The backend was trying to call:
   ```javascript
   const m = await marketContract.markets(i);  // ❌ This function doesn't exist!
   ```

3. **The Error**: This resulted in:
   ```
   execution reverted (no data present; likely require(false) occurred
   code=CALL_EXCEPTION
   ```

4. **Cascade Effect**: 
   - `/api/markets` endpoint failed → 500 error
   - Telegram bot couldn't load markets
   - User creation failed (depends on backend)
   - All bot operations failed

## The Fix

Updated the backend to use the **correct contract functions** that actually exist:

### Before (Broken):
```javascript
const marketABI = [
  'function markets(uint256) view returns (...)'  // ❌ Doesn't exist
];
const m = await marketContract.markets(i);
```

### After (Fixed):
```javascript
const marketABI = [
  'function marketCount() view returns (uint256)',
  'function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
];
const m = await marketContract.getMarketBasicInfo(i);  // ✅ Correct function
```

## Files Modified

1. **`src/app.ts`** (Line ~1050)
   - Updated `/api/markets` endpoint
   - Changed from `markets(uint256)` to `getMarketBasicInfo(uint256)`
   - Added error handling for individual market fetches

2. **`src/controllers/marketController.ts`**
   - Fixed `getMarketMetadata` to return properly formatted data
   - Ensured consistent field naming (image vs image_url, category vs category_id)

3. **`src/config/database.ts`**
   - Updated mock database to use correct table name `markets` instead of `market_metadata`
   - Fixed field names to match actual queries

## Testing Steps

1. **Restart the backend server**:
   ```bash
   cd c:\Users\toluk\Documents\predict
   npm run dev
   ```

2. **Restart the Telegram bot**:
   ```bash
   cd c:\Users\toluk\Documents\predict\telegram-bot
   npm run dev
   ```

3. **Test in Telegram**:
   - Send `/start` to your bot
   - Click "📊 Markets" - should now load successfully
   - Click "👤 Profile" - should show your wallet and balance
   - Click "💰 Deposit" - should show deposit address

## Expected Behavior Now

- ✅ Markets load successfully (even if empty)
- ✅ User creation works
- ✅ Profile shows wallet address and balance
- ✅ Deposit shows custodial wallet address
- ✅ No more 500 errors

## Additional Notes

### If Markets Are Empty:

If you see "No active markets", you need to create markets on the blockchain:

```bash
cd contracts
npx hardhat run scripts/create-multi-markets.ts --network bscTestnet
```

Then add metadata to the database:

```bash
cd ..
node scripts/seed_markets.ts
```

### Contract Functions Available:

Your `PredictionMarketMulti` contract has these view functions:
- `marketCount()` - Get total number of markets
- `getMarketBasicInfo(uint256)` - Get market details
- `getMarketOutcomes(uint256)` - Get outcome names
- `getMarketShares(uint256)` - Get share counts
- `getAllPrices(uint256)` - Get all outcome prices
- `getPrice(uint256, uint256)` - Get specific outcome price
- `getUserPosition(uint256, address)` - Get user's position

### Why This Happened:

This is a common issue when:
1. Contract is upgraded/changed but backend ABI isn't updated
2. Using a different contract version than expected
3. Struct definitions change between contract versions

## Prevention

To avoid this in the future:
1. Always verify contract functions exist before calling them
2. Use TypeChain to generate type-safe contract interfaces
3. Test backend API calls against actual deployed contracts
4. Keep contract ABIs in sync with deployed versions
