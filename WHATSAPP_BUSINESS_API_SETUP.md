# WhatsApp Business API Setup Guide

## Overview

WhatsApp Business API is the official, production-ready way to run a WhatsApp bot. Unlike `whatsapp-web.js` (which requires QR code scanning), the Business API:
- ✅ No QR code needed
- ✅ Webhook-based (instant message delivery)
- ✅ Official and supported by Meta
- ✅ Can handle thousands of users
- ✅ Free for first 1,000 conversations/month

---

## Step 1: Create Meta Business Account

### 1.1 Go to Meta Business Suite
Visit: https://business.facebook.com/

### 1.2 Create Business Account
1. Click "Create Account"
2. Enter your business name (e.g., "OPOLL Prediction Markets")
3. Enter your name and business email
4. Click "Submit"

### 1.3 Verify Your Business
- You'll need to verify your business (can take 1-3 days)
- For testing, you can skip this initially

---

## Step 2: Create Meta App

### 2.1 Go to Meta for Developers
Visit: https://developers.facebook.com/

### 2.2 Create New App
1. Click "My Apps" → "Create App"
2. Select "Business" as app type
3. Fill in details:
   - **App Name**: OPOLL Bot
   - **App Contact Email**: your@email.com
   - **Business Account**: Select your business
4. Click "Create App"

### 2.3 Add WhatsApp Product
1. In your app dashboard, find "WhatsApp"
2. Click "Set Up"
3. You'll be taken to WhatsApp setup page

---

## Step 3: Get Test Phone Number

### 3.1 Use Meta's Test Number (Easiest)
Meta provides a test phone number for free:

1. In WhatsApp setup, you'll see a test number
2. Click "Send Message" to test
3. Add your personal WhatsApp number as a recipient
4. Send a test message

**Limitations:**
- Can only message 5 numbers
- Test number expires after 90 days
- Good for development only

### 3.2 Add Your Own Phone Number (Recommended)

**Requirements:**
- A phone number you own
- Can receive SMS/voice calls
- Not already on WhatsApp

**Steps:**
1. Click "Add Phone Number"
2. Select country code
3. Enter phone number
4. Verify via SMS or voice call
5. Enter verification code

**Important:** This number will be your bot's WhatsApp number. Users will message this number.

---

## Step 4: Get API Credentials

### 4.1 Get Phone Number ID
1. In WhatsApp setup, go to "API Setup"
2. Copy the **Phone Number ID** (looks like: `123456789012345`)
3. Save this - you'll need it in your code

### 4.2 Get Access Token
1. In the same page, find "Temporary Access Token"
2. Click "Copy"
3. Save this token (valid for 24 hours)

**For Production:**
You'll need a permanent token (see Step 6)

### 4.3 Get WhatsApp Business Account ID
1. In API Setup, find "WhatsApp Business Account ID"
2. Copy and save it

---

## Step 5: Configure Webhook

### 5.1 Deploy Your Bot First
You need a public URL for the webhook. Options:

**Option A: Use ngrok (for testing)**
```bash
# Install ngrok
npm install -g ngrok

# Start your bot
cd whatsapp-bot
npm run dev

# In another terminal, expose it
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Deploy to Railway/Render (recommended)**
See DEPLOYMENT_GUIDE.md

### 5.2 Set Up Webhook in Meta
1. In WhatsApp setup, go to "Configuration"
2. Click "Edit" next to Webhook
3. Enter:
   - **Callback URL**: `https://your-domain.com/webhook/whatsapp`
   - **Verify Token**: Create a random string (e.g., `my_secret_token_123`)
4. Click "Verify and Save"

### 5.3 Subscribe to Webhook Events
1. Click "Manage" next to Webhook Fields
2. Subscribe to:
   - ✅ messages
   - ✅ message_status (optional)
3. Click "Save"

---

## Step 6: Get Permanent Access Token

The temporary token expires in 24 hours. For production:

### 6.1 Create System User
1. Go to Business Settings: https://business.facebook.com/settings
2. Click "Users" → "System Users"
3. Click "Add"
4. Name: "OPOLL Bot"
5. Role: "Admin"
6. Click "Create System User"

### 6.2 Generate Token
1. Click on your system user
2. Click "Generate New Token"
3. Select your app
4. Select permissions:
   - ✅ whatsapp_business_messaging
   - ✅ whatsapp_business_management
5. Click "Generate Token"
6. **SAVE THIS TOKEN** - You won't see it again!

---

## Step 7: Update Your Code

### 7.1 Add Environment Variables

Update `whatsapp-bot/.env`:
```env
# WhatsApp Business API
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=your_permanent_token_here
WHATSAPP_VERIFY_TOKEN=my_secret_token_123
WHATSAPP_BUSINESS_ACCOUNT_ID=your_account_id

# Webhook URL (your public URL)
WEBHOOK_URL=https://your-domain.com
```

### 7.2 Code Changes Needed

You'll need to:
1. Create webhook endpoint (receives messages)
2. Replace `whatsapp-web.js` with API calls
3. Handle message sending via Graph API

See `WHATSAPP_BUSINESS_API_MIGRATION.md` for code examples.

---

## Step 8: Test Your Setup

### 8.1 Send Test Message
1. Message your bot's WhatsApp number from your phone
2. Check your webhook logs
3. Bot should respond

### 8.2 Verify Webhook
```bash
# Check webhook is receiving messages
curl -X GET "https://your-domain.com/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=my_secret_token_123&hub.challenge=test"

# Should return: test
```

---

## Pricing

### Free Tier (First 1,000 Conversations/Month)
- **Conversations**: A 24-hour window with a user
- **Cost**: $0 for first 1,000
- **After 1,000**: ~$0.005 - $0.09 per conversation (varies by country)

### Example Costs:
- **1,000 users/month**: $0
- **5,000 users/month**: ~$20-40
- **10,000 users/month**: ~$45-90

**Note:** Much cheaper than SMS!

---

## Common Issues

### "Webhook verification failed"
- Check verify token matches in code and Meta dashboard
- Ensure webhook URL is HTTPS (not HTTP)
- Check webhook endpoint returns the challenge

### "Phone number not verified"
- Complete phone verification in Meta dashboard
- Check you received SMS/call
- Try a different phone number

### "Access token expired"
- Use permanent token (Step 6)
- Don't use temporary token in production

### "Cannot send message to this number"
- For test numbers, add recipient in Meta dashboard
- For production, any number can message you first

---

## Quick Start Checklist

- [ ] Create Meta Business Account
- [ ] Create Meta App
- [ ] Add WhatsApp product
- [ ] Get test phone number OR add your own
- [ ] Copy Phone Number ID
- [ ] Copy Access Token
- [ ] Deploy bot to get public URL
- [ ] Configure webhook in Meta
- [ ] Subscribe to message events
- [ ] Get permanent access token
- [ ] Update .env with credentials
- [ ] Test by sending message

---

## Next Steps

Once you have API access:
1. Follow `WHATSAPP_BUSINESS_API_MIGRATION.md` to update code
2. Deploy to production (Railway/Render)
3. Start accepting users!

---

## Useful Links

- **Meta Business Suite**: https://business.facebook.com/
- **Meta for Developers**: https://developers.facebook.com/
- **WhatsApp Business API Docs**: https://developers.facebook.com/docs/whatsapp
- **Pricing**: https://developers.facebook.com/docs/whatsapp/pricing
- **Support**: https://developers.facebook.com/support/

---

## Alternative: Use a BSP (Business Solution Provider)

If Meta's process is too complex, you can use a BSP:

### Recommended BSPs:
1. **Twilio** - https://www.twilio.com/whatsapp
   - Easier setup
   - Pay-as-you-go
   - Good documentation

2. **MessageBird** - https://messagebird.com/whatsapp
   - Simple API
   - Good for startups

3. **360Dialog** - https://www.360dialog.com/
   - WhatsApp-focused
   - Good pricing

**Note:** BSPs charge more than direct Meta API, but setup is easier.

---

**Estimated Time:**
- Meta approval: 1-3 days
- Setup: 1-2 hours
- Code migration: 3-4 hours
- **Total**: 2-4 days

**Difficulty:** Medium (but worth it for production!)
