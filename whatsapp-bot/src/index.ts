import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { commandHandler } from './commands';
import dotenv from 'dotenv';

dotenv.config();

console.log(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃          🎰 OPOLL WhatsApp Bot           ┃
┃         Prediction Markets on Chat       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`);

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// QR Code for linking
client.on('qr', (qr) => {
    console.log('📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n💡 WhatsApp > Settings > Linked Devices > Link a Device\n');
});

// Ready
client.on('ready', () => {
    console.log(`
✅ Bot is ONLINE

📊 API: ${process.env.API_URL || 'http://localhost:3000/api'}
🌐 Web: ${process.env.FRONTEND_URL || 'http://localhost:3001'}

💬 Waiting for messages...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

// Message handler
client.on('message', async (message) => {
    // Ignore messages from groups and status updates
    if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
        return;
    }

    const text = message.body.trim();

    // Ignore empty messages
    if (!text) return;

    console.log(`📨 ${message.from.split('@')[0]}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    try {
        const response = await commandHandler.handleMessage(message);
        await message.reply(response);
        console.log(`✅ Replied\n`);
    } catch (error) {
        console.error('❌ Error:', error);
        await message.reply('❌ Something went wrong. Reply *menu* to start over.');
    }
});

// Auth failure
client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('⚠️  Disconnected:', reason);
});

// Initialize
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down...');
    await client.destroy();
    process.exit(0);
});
