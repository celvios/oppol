# 🚀 Quick Deployment Checklist

## Pre-Deployment

- [ ] Test bot locally with `npm run dev`
- [ ] Verify all commands work
- [ ] Check `.env.example` is up to date
- [ ] Ensure `package.json` has all dependencies
- [ ] Run `npm run build` successfully
- [ ] Test `/health` endpoint

## Twilio Setup

- [ ] Create Twilio account
- [ ] Get Account SID and Auth Token
- [ ] Set up WhatsApp sandbox (development)
- [ ] Request WhatsApp Business API (production)
- [ ] Note your WhatsApp number

## Choose Hosting (Pick One)

### Option A: Render (Easiest)
- [ ] Push code to GitHub
- [ ] Create Render account
- [ ] Connect GitHub repo
- [ ] Add environment variables
- [ ] Deploy
- [ ] Copy webhook URL

### Option B: Railway
- [ ] Install Railway CLI: `npm i -g @railway/cli`
- [ ] Run `railway login`
- [ ] Run `railway init`
- [ ] Run `railway up`
- [ ] Set environment variables
- [ ] Get domain with `railway domain`

### Option C: VPS
- [ ] SSH into server
- [ ] Install Node.js and PM2
- [ ] Clone repository
- [ ] Create `.env` file
- [ ] Run `npm install && npm run build`
- [ ] Start with `pm2 start dist/index.js`
- [ ] Setup Nginx + SSL

## Configure Twilio Webhook

- [ ] Go to Twilio Console → Messaging
- [ ] Find your WhatsApp sender
- [ ] Set webhook URL: `https://your-domain.com/webhook/whatsapp`
- [ ] Set method to POST
- [ ] Save

## Environment Variables

Required variables:
```
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
API_BASE_URL=https://your-api.com
ADMIN_PHONES=+1234567890
PORT=3002
NODE_ENV=production
```

## Testing

- [ ] Join WhatsApp sandbox (send join code)
- [ ] Send "start" to bot
- [ ] Test: Browse markets
- [ ] Test: View profile
- [ ] Test: Place bet (small amount)
- [ ] Test: Search markets
- [ ] Test: View positions
- [ ] Test: Admin commands (if admin)
- [ ] Test: Error handling (invalid inputs)

## Monitoring

- [ ] Check server logs
- [ ] Monitor Twilio logs
- [ ] Test `/health` endpoint
- [ ] Set up uptime monitoring (optional)

## Post-Deployment

- [ ] Share bot number with team
- [ ] Gather initial feedback
- [ ] Monitor for errors
- [ ] Plan Phase 4 features

---

## Quick Commands

### Local Testing
```bash
cd whatsapp-bot
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Deploy to Render
```bash
git add .
git commit -m "Deploy WhatsApp bot"
git push origin main
# Then deploy via Render dashboard
```

### Deploy to Railway
```bash
railway up
```

### Deploy to VPS
```bash
git pull
npm install
npm run build
pm2 restart whatsapp-bot
```

---

## Troubleshooting

**Bot not responding?**
1. Check Twilio webhook logs
2. Check server logs
3. Verify webhook URL
4. Test `/health` endpoint

**Build fails?**
1. Run `npm install`
2. Check TypeScript errors: `npm run build`
3. Verify all imports

**API errors?**
1. Check `API_BASE_URL` is correct
2. Test API manually
3. Check CORS settings

---

## Support Links

- Twilio Console: https://console.twilio.com
- Render Dashboard: https://dashboard.render.com
- Railway Dashboard: https://railway.app/dashboard

---

## Estimated Costs

- **Hosting:** $5-10/month
- **Twilio (sandbox):** Free
- **Twilio (production):** ~$0.005/message
- **Total:** $5-25/month (depending on usage)

---

## Next Steps

1. ✅ Deploy to production
2. 🧪 Test with real users
3. 📊 Monitor analytics
4. 🚀 Start Phase 4 (Alert Management)

Ready to deploy! 🎉
