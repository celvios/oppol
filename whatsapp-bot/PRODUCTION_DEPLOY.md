# Production Deployment Guide

## Prerequisites

1. **Twilio Account** (Production)
   - Sign up: https://www.twilio.com/try-twilio
   - Upgrade to paid account (required for production WhatsApp)
   - Request WhatsApp Business API access

2. **Hosting Platform** (Choose one)
   - Render (Recommended - easiest)
   - Railway
   - Heroku
   - VPS with PM2

3. **Backend API**
   - Ensure your OPOLL API is deployed and accessible
   - Get the production API URL

---

## Option A: Deploy to Render (Recommended)

### Step 1: Prepare Repository
```bash
cd whatsapp-bot
git init
git add .
git commit -m "Initial WhatsApp bot"
git remote add origin <your-github-repo>
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml`
5. Add environment variables:
   - `TWILIO_ACCOUNT_SID` - From Twilio Console
   - `TWILIO_AUTH_TOKEN` - From Twilio Console
   - `TWILIO_WHATSAPP_NUMBER` - Your WhatsApp number (format: whatsapp:+14155238886)
   - `API_BASE_URL` - Your backend API URL
   - `ADMIN_PHONES` - Admin phone numbers (comma-separated)
6. Click "Create Web Service"

### Step 3: Get Webhook URL
After deployment, Render will give you a URL like:
```
https://opoll-whatsapp-bot.onrender.com
```

Your webhook URL will be:
```
https://opoll-whatsapp-bot.onrender.com/webhook/whatsapp
```

### Step 4: Configure Twilio Webhook
1. Go to Twilio Console → Messaging → Settings
2. Find your WhatsApp sender
3. Set "When a message comes in" to your webhook URL
4. Save

### Step 5: Test
Send "start" to your Twilio WhatsApp number

---

## Option B: Deploy to Railway

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### Step 2: Deploy
```bash
cd whatsapp-bot
railway init
railway up
```

### Step 3: Set Environment Variables
```bash
railway variables set TWILIO_ACCOUNT_SID=<value>
railway variables set TWILIO_AUTH_TOKEN=<value>
railway variables set TWILIO_WHATSAPP_NUMBER=<value>
railway variables set API_BASE_URL=<value>
railway variables set ADMIN_PHONES=<value>
```

### Step 4: Get Domain
```bash
railway domain
```

Use the domain to configure Twilio webhook (Step 4 from Option A)

---

## Option C: Deploy to VPS with PM2

### Step 1: Setup VPS
```bash
# SSH into your VPS
ssh user@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### Step 2: Deploy Code
```bash
# Clone repository
git clone <your-repo>
cd whatsapp-bot

# Install dependencies
npm install

# Create .env file
nano .env
# Add all environment variables

# Build
npm run build
```

### Step 3: Start with PM2
```bash
pm2 start dist/index.js --name whatsapp-bot
pm2 save
pm2 startup
```

### Step 4: Setup Nginx (for HTTPS)
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/whatsapp-bot
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

Your webhook URL: `https://your-domain.com/webhook/whatsapp`

---

## Twilio WhatsApp Setup

### Development (Sandbox)
1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Join sandbox by sending code to Twilio number
3. Use sandbox number for testing

### Production (Business API)
1. Request access: https://www.twilio.com/whatsapp/request-access
2. Wait for approval (1-2 weeks)
3. Complete Facebook Business verification
4. Submit message templates for approval
5. Get production WhatsApp number

**Note:** Production WhatsApp requires:
- Verified business
- Approved message templates
- Higher costs (~$0.005-0.01 per message)

---

## Environment Variables

Create `.env` file:
```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# API
API_BASE_URL=https://your-api.com

# Admin
ADMIN_PHONES=+1234567890,+0987654321

# Server
PORT=3002
NODE_ENV=production
```

---

## Monitoring & Logs

### Render
- View logs in Render dashboard
- Set up log drains for external monitoring

### Railway
```bash
railway logs
```

### PM2
```bash
pm2 logs whatsapp-bot
pm2 monit
```

---

## Cost Estimates

### Hosting
- **Render Starter:** $7/month
- **Railway:** ~$5-10/month
- **VPS (DigitalOcean):** $6/month

### Twilio
- **Sandbox:** Free (testing only)
- **Production WhatsApp:** 
  - Business-initiated: $0.005-0.01/message
  - User-initiated (24h window): Free
  - Monthly phone number: ~$1-2

**Estimated monthly cost:** $15-25 for small scale

---

## Testing Checklist

- [ ] Bot responds to "start"
- [ ] Can browse markets
- [ ] Can view profile
- [ ] Can place bets
- [ ] Can withdraw funds
- [ ] Search works
- [ ] Alerts work
- [ ] Admin commands work (if admin)
- [ ] Error handling works
- [ ] Session management works

---

## Troubleshooting

### Bot not responding
1. Check Twilio webhook logs
2. Check server logs
3. Verify webhook URL is correct
4. Test `/health` endpoint

### Deployment fails
1. Check build logs
2. Verify all dependencies in package.json
3. Ensure TypeScript compiles: `npm run build`

### API errors
1. Verify API_BASE_URL is correct
2. Check API is accessible from server
3. Test API endpoints manually

---

## Next Steps After Deployment

1. Monitor logs for errors
2. Track user adoption
3. Gather feedback
4. Implement Phase 2 features
5. Scale as needed

---

## Support

- Twilio Docs: https://www.twilio.com/docs/whatsapp
- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app

Ready to deploy! 🚀
