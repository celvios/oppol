# Required Environment Variables for Production Deployment

## Critical Backend Environment Variables (Render/Railway)

These environment variables **MUST** be set correctly on your production backend deployment:

### Network Configuration
```bash
# BNB Chain (BSC Mainnet) RPC URL - REQUIRED
BNB_RPC_URL=https://bsc-dataseed.binance.org
# Alternative: https://bsc-dataseed1.binance.org
# Or use QuickNode/Alchemy for better reliability

# Chain ID for BNB Smart Chain
CHAIN_ID=56

# Server wallet private key (for relayer transactions)
PRIVATE_KEY=0x...your_private_key_here
```

### Contract Addresses (BNB Chain)
```bash
# V3 Multi-Outcome Market Contract
NEXT_PUBLIC_MARKET_ADDRESS=0xe3Eb84D7e271A5C44B27578547f69C80c497355B
MARKET_CONTRACT=0xe3Eb84D7e271A5C44B27578547f69C80c497355B
MULTI_MARKET_ADDRESS=0xe3Eb84D7e271A5C44B27578547f69C80c497355B

# USDC/USDT Contract (BNB Chain)
NEXT_PUBLIC_USDC_CONTRACT=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
USDC_CONTRACT=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
```

## Common Issues

### Issue: Transactions sent to wrong network (e.g., Base Sepolia instead of BNB Chain)
**Cause**: `BNB_RPC_URL` or `CHAIN_ID` environment variables are not set correctly in production.

**Solution**:
1. Go to your Render/Railway dashboard
2. Navigate to Environment Variables
3. Ensure `BNB_RPC_URL` is set to a BNB Chain RPC endpoint
4. Ensure `CHAIN_ID` is set to `56`
5. Redeploy the backend service

### Issue: "RPC URL not configured" error
**Cause**: Missing `BNB_RPC_URL` environment variable.

**Solution**: Add `BNB_RPC_URL` to your production environment variables.

### Issue: "Network mismatch" error
**Cause**: The RPC URL points to a different chain than specified by `CHAIN_ID`.

**Solution**: Verify that your RPC URL is for BNB Chain (chain ID 56), not Base, Ethereum, or other networks.

## Verification

After setting environment variables, check your backend logs for:
```
✅ Contract Configuration Loaded:
   - Market: 0xe3Eb84D7e271A5C44B27578547f69C80c497355B
   - USDC: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
   - RPC: https://bsc-dataseed.binance.org
   - Chain ID: 56
```

And when placing a bet:
```
🔍 [MULTI-BET DEBUG] RPC URL: https://bsc-dataseed.binance.org
🔍 [MULTI-BET DEBUG] Expected Chain ID: 56
🔍 [MULTI-BET DEBUG] Connected to Chain ID: 56
```
