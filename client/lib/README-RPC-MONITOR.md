# RPC Usage Monitor

## What This Does

The RPC monitor intercepts all RPC calls to the blockchain and tracks:
- **Total calls** since page load
- **Calls per minute** (current rate)
- **Top methods** being called (e.g., `eth_call`, `eth_getBalance`)
- **Source locations** (which files/functions are making the calls)

## How to Use

### 1. Start Your Dev Server

```bash
npm run dev
```

### 2. Open Browser Console

Navigate to your app and open DevTools console (F12).

### 3. Check Reports

The monitor automatically prints a report every 30 seconds:

```
📊 RPC Usage Report
⏱️  Running for: 120s
📞 Total RPC calls: 842
⚡ Calls/minute: 127
📈 Rate: 421.00 calls/min

🔝 Top Methods:
  1. eth_call: 650 calls
     Last from: at Web3MultiService.getMarket
  2. eth_getBalance: 120 calls
     Last from: at useWallet.checkBalance
```

### 4. Manual Commands

Type these in the console:

```javascript
// Get detailed stats object
window.getRPCStats()

// Force print a report now
window.printRPCReport()

// Reset all counters
window.resetRPCMonitor()
```

## What to Look For

### 🚨 Critical Issues (>100 calls/min)
- Tight polling loops (interval < 10s)
- Multiple components fetching the same data
- Missing caching layer

### ⚠️ Warnings (>50 calls/min)
- Aggressive refresh intervals
- Unnecessary re-fetches on render

### ✅ Good (< 30 calls/min)
- Proper caching in place
- Reasonable polling intervals (60s+)
- Efficient data fetching

## Common Culprits

1. **`interval` loops** - Check all `setInterval` calls
2. **`useEffect` without deps** - Re-runs on every render
3. **Multiple instances** - Same component mounted multiple times
4. **No caching** - Fetching same data repeatedly
5. **Wagmi watch** - Real-time blockchain watching

## Example Output

```
🔥 HIGH FREQUENCY RPC: eth_call called 45 times in 5s
Called from:
  at Web3MultiService.getMarket (web3-multi.ts:299)
  at fetchData (MobileTerminal.tsx:278)
```

This tells you exactly what to fix!

## Next Steps After Investigation

1. **Identify the top caller** from the report
2. **Find the source file** in the stack trace
3. **Increase polling interval** or **add caching**
4. **Re-test** and watch the numbers drop

## Notes

- Monitor only tracks **RPC calls**, not API calls to your backend
- Runs in development AND production (remove import to disable)
- Zero performance impact when not actively monitoring
- Resets on page refresh
