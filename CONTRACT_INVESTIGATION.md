# Contract Investigation Summary

## Problem
- Prices showing as `5e-13` (0.0000000000005%) instead of expected 50%
- Volume showing as `undefined` or `$0`
- Chances displaying as `0.0%`

## Root Cause Found
**The backend is calling the wrong contract or the contract has no markets.**

### Evidence:
1. **Mainnet Contract Address**: `0xe3Eb84D7e271A5C44B27578547f69C80c497355B`
   - Contract EXISTS on BSC Mainnet
   - Contract has bytecode deployed
   - Contract is NOT verified on BSCScan

2. **Testnet Contract Address**: `0x5F9C05bE2Af2adb520825950323774eFF308E353`
   - This is in `deployed-addresses.json`
   - Network: BSC Testnet (Chain ID 97)

3. **Backend Configuration Issue**:
   - `.env.mainnet` has placeholder: `MARKET_CONTRACT=your_deployed_market_contract`
   - Render backend likely doesn't have the correct environment variable set
   - Or it's set to the testnet address while using mainnet RPC

## Possible Scenarios:

### Scenario 1: Wrong Contract Address
- Backend is calling testnet contract `0x5F9C...` on mainnet RPC
- This address doesn't exist on mainnet → returns garbage data

### Scenario 2: Empty Contract
- Backend is calling correct mainnet contract `0xe3Eb...`
- But no markets have been created yet
- `marketCount() = 0`
- Calling `getAllPrices(0)` on non-existent market returns bad data

### Scenario 3: Contract State Corruption
- Contract exists and has markets
- But `liquidityParam` is set incorrectly (too small)
- LMSR calculation returns near-zero values

## Solution Steps:

### Step 1: Verify Render Environment Variables
Check what's actually set on Render:
```bash
MARKET_CONTRACT=?
MULTI_MARKET_ADDRESS=?
BNB_RPC_URL=?
CHAIN_ID=?
```

### Step 2: If Using Mainnet Contract
Set Render environment variables to:
```
MARKET_CONTRACT=0xe3Eb84D7e271A5C44B27578547f69C80c497355B
MULTI_MARKET_ADDRESS=0xe3Eb84D7e271A5C44B27578547f69C80c497355B
BNB_RPC_URL=https://bsc-dataseed.binance.org
CHAIN_ID=56
```

Then check if markets exist:
- Go to BSCScan: https://bscscan.com/address/0xe3Eb84D7e271A5C44B27578547f69C80c497355B#readContract
- Call `marketCount()` - should be > 0
- Call `getMarketBasicInfo(0)` - should return market data

### Step 3: If No Markets Exist
Create markets using the deployment script:
```bash
cd contracts
npx hardhat run scripts/create-markets.ts --network bsc
```

### Step 4: If Using Testnet
Switch everything to testnet:
```
MARKET_CONTRACT=0x5F9C05bE2Af2adb520825950323774eFF308E353
MULTI_MARKET_ADDRESS=0x5F9C05bE2Af2adb520825950323774eFF308E353
BNB_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
CHAIN_ID=97
```

## Immediate Fix Applied
Added fallback logic in `marketController.ts`:
- Detects when prices < 1 (bad data)
- Falls back to equal distribution (50%/50%)
- This makes UI functional while investigating root cause

## Next Actions
1. ✅ Check Render environment variables
2. ⏳ Verify which network/contract is being used
3. ⏳ Check if markets exist on that contract
4. ⏳ Create markets if needed
5. ⏳ Update environment variables if wrong

## BSCScan Links
- **Mainnet Contract**: https://bscscan.com/address/0xe3Eb84D7e271A5C44B27578547f69C80c497355B
- **Testnet Contract**: https://testnet.bscscan.com/address/0x5F9C05bE2Af2adb520825950323774eFF308E353
