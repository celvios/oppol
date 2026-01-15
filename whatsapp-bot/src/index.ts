import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { commandHandler } from './commands';
import { logger } from './logger';
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
    logger.info('Bot is ONLINE');
    logger.info(`API: ${process.env.API_URL || 'http://localhost:3000/api'}`);
    logger.info(`Web: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
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

    logger.info('Message received', { from: message.from.split('@')[0], text: text.substring(0, 50) });

    try {
        const response = await commandHandler.handleMessage(message);
        await message.reply(response);
        logger.info('Reply sent', { from: message.from.split('@')[0] });
    } catch (error) {
        logger.error('Message handling error', { from: message.from.split('@')[0], error });
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
