# Mainnet Deployment Checklist

## Pre-Deployment

- [ ] **Fund deployment wallet with BNB** (for gas fees)
- [ ] **Set PRIVATE_KEY in contracts/.env** (mainnet wallet)
- [ ] **Verify contract code** is production-ready
- [ ] **Test on BSC testnet** first

## Contract Deployment

```bash
cd contracts
npm run compile
npx hardhat run scripts/deploy-mainnet.ts --network bsc
```

## Environment Configuration

1. **Backend (.env)**
   ```bash
   cp .env.mainnet .env
   # Update with deployed contract addresses
   ```

2. **Client (.env.production)**
   ```bash
   # Update with deployed addresses
   NEXT_PUBLIC_MARKET_ADDRESS=deployed_contract_address
   NEXT_PUBLIC_USDC_CONTRACT=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
   ```

## Verification Steps

- [ ] **Verify contracts on BSCScan**
- [ ] **Test basic functionality** (create market, place bet)
- [ ] **Check USDC integration** works
- [ ] **Verify admin functions** work
- [ ] **Test frontend connection**

## Production Deployment

- [ ] **Deploy backend** to production server
- [ ] **Deploy frontend** to Vercel/Netlify
- [ ] **Update DNS** records
- [ ] **Enable SSL** certificates
- [ ] **Monitor logs** for errors

## Security Checklist

- [ ] **Rotate all secrets** from testnet
- [ ] **Use dedicated hot wallet** with minimal funds
- [ ] **Enable monitoring** and alerts
- [ ] **Backup private keys** securely
- [ ] **Test emergency procedures**

## Post-Deployment

- [ ] **Create initial markets**
- [ ] **Fund contract** with initial liquidity
- [ ] **Test user flows** end-to-end
- [ ] **Monitor gas usage** and optimize
- [ ] **Set up analytics** and monitoring