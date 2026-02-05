# Quick Testing Guide - WhatsApp Bot

## Step 1: Join Twilio Sandbox (2 minutes)

1. **Get your sandbox number:**
   - Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
   - You'll see a number like: `+1 415 523 8886`
   - You'll see a join code like: `join abc-def`

2. **Join from your phone:**
   - Open WhatsApp on your phone
   - Send a message to: `+1 415 523 8886` (or your sandbox number)
   - Message: `join abc-def` (use your actual code)
   - You'll get a confirmation message

✅ **You're now connected to the sandbox!**

---

## Step 2: Configure Webhook (1 minute)

Your bot needs to know where to send messages.

1. **Get your webhook URL:**
   - If deployed on Render: `https://your-app.onrender.com/webhook/whatsapp`
   - Check Render dashboard for your URL

2. **Set webhook in Twilio:**
   - Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - Find "When a message comes in"
   - Paste your webhook URL
   - Method: POST
   - Click Save

✅ **Webhook configured!**

---

## Step 3: Test Basic Commands (5 minutes)

Send these messages to your sandbox number:

### Test 1: Start
```
You: start
Bot: 🎰 Welcome to OPOLL! [shows menu]
```

### Test 2: Browse Markets
```
You: markets
Bot: 📊 Active Markets [shows list]
```

### Test 3: Profile
```
You: profile
Bot: 👤 Your Profile [shows wallet, balance]
```

### Test 4: Search
```
You: search
Bot: 🔍 Search Markets
You: bitcoin
Bot: [shows bitcoin markets]
```

### Test 5: Categories
```
You: categories
Bot: 📊 Browse by Category [shows list]
You: 2
Bot: 💰 Crypto Markets [shows crypto markets]
```

### Test 6: Trending
```
You: trending
Bot: 🔥 Trending Markets [shows top markets]
```

### Test 7: Alerts
```
You: setalert
Bot: 🔔 Set Price Alert [shows markets]
You: 1
Bot: [shows outcomes]
You: 1
Bot: Enter target price
You: 75
Bot: Above or below?
You: 1
Bot: ✅ Alert Created!
```

### Test 8: View Alerts
```
You: alerts
Bot: 🔔 Your Price Alerts [shows your alerts]
```

### Test 9: Help
```
You: help
Bot: ❓ How OPOLL Works [shows guide]
```

### Test 10: Cancel
```
You: setalert
Bot: [starts flow]
You: cancel
Bot: ❌ Cancelled
```

---

## Step 4: Test Betting Flow (Optional)

**⚠️ Only if you have USDC in your wallet!**

```
You: markets
Bot: [shows markets]
You: 1
Bot: [shows market details]
You: 1
Bot: [asks for amount]
You: 5
Bot: [shows confirmation]
You: confirm
Bot: ✅ Bet Placed Successfully!
```

---

## Step 5: Check Logs (Debugging)

If something doesn't work:

### Render Logs
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. Look for errors

### Twilio Logs
1. Go to: https://console.twilio.com/us1/monitor/logs/sms
2. Filter by WhatsApp
3. Check for webhook errors

---

## Common Issues & Fixes

### Bot doesn't respond
**Check:**
- [ ] Webhook URL is correct
- [ ] Webhook is saved in Twilio
- [ ] Bot is deployed and running
- [ ] Check Render logs for errors

**Fix:**
```bash
# Test health endpoint
curl https://your-app.onrender.com/health
# Should return: {"status":"OK","service":"OPOLL WhatsApp Bot"}
```

### Bot responds but shows errors
**Check:**
- [ ] API_BASE_URL is correct
- [ ] Backend API is running
- [ ] Environment variables are set

**Fix:**
- Check Render environment variables
- Test API manually: `curl https://your-api.com/api/markets`

### Webhook errors in Twilio
**Check:**
- [ ] Webhook URL ends with `/webhook/whatsapp`
- [ ] Method is POST
- [ ] Bot is deployed

**Fix:**
- Redeploy bot
- Update webhook URL
- Check Render logs

---

## Quick Test Script

Copy and paste these commands one by one:

```
start
markets
profile
search
bitcoin
categories
2
trending
help
menu
```

Expected: Bot responds to all commands without errors.

---

## Environment Variables Checklist

Make sure these are set in Render:

```
✅ TWILIO_ACCOUNT_SID=ACxxxxx...
✅ TWILIO_AUTH_TOKEN=xxxxx...
✅ TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
✅ API_BASE_URL=https://your-api.com
✅ ADMIN_PHONES=+1234567890
✅ PORT=3002
✅ NODE_ENV=production
```

---

## Testing Checklist

- [ ] Joined Twilio sandbox
- [ ] Configured webhook
- [ ] Bot responds to "start"
- [ ] Can browse markets
- [ ] Can search markets
- [ ] Can view categories
- [ ] Can view trending
- [ ] Can create alerts
- [ ] Can view profile
- [ ] Help command works
- [ ] Cancel command works

---

## Next Steps After Testing

1. ✅ **If all works:** Share with team, start using!
2. ❌ **If issues:** Check logs, fix errors, redeploy
3. 📊 **Monitor:** Watch Render logs for errors
4. 🚀 **Scale:** Add more features (Phase 6, 7, etc.)

---

## Quick Links

- **Twilio Console:** https://console.twilio.com
- **Twilio Sandbox:** https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
- **Twilio Logs:** https://console.twilio.com/us1/monitor/logs/sms
- **Render Dashboard:** https://dashboard.render.com

---

## Support

**Bot not working?**
1. Check Render logs
2. Check Twilio logs
3. Test health endpoint
4. Verify environment variables

**Need help?**
- Twilio Docs: https://www.twilio.com/docs/whatsapp
- Render Docs: https://render.com/docs

Ready to test! 📱
