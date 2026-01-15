import TelegramBot from 'node-telegram-bot-api';
import { commandHandler } from './commands';
import { logger } from './logger';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
}

console.log(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃          🎰 OPOLL Telegram Bot           ┃
┃         Prediction Markets on Chat       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`);

// Initialize Telegram bot
const bot = new TelegramBot(token, { polling: true });

logger.info('Bot starting...');

// Ready
bot.on('polling_error', (error) => {
    logger.error('Polling error', { error: error.message });
});

bot.on('error', (error) => {
    logger.error('Bot error', { error: error.message });
});

// Message handler
bot.on('message', async (msg) => {
    // Ignore non-text messages
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userId = msg.from?.id.toString() || chatId.toString();
    
    logger.info('Message received', { userId, text: text.substring(0, 50) });
    
    try {
        // Create mock message object for compatibility
        const mockMessage = {
            body: text,
            from: `${userId}@c.us`,
            reply: async (response: string) => {
                await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            }
        };
        
        const response = await commandHandler.handleMessage(mockMessage as any);
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        
        logger.info('Reply sent', { userId });
    } catch (error: any) {
        logger.error('Message handling error', { userId, error: error.message });
        await bot.sendMessage(chatId, '❌ Something went wrong. Reply /menu to start over.');
    }
});

// Callback query handler (for inline buttons - future use)
bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    const data = query.data;
    
    if (!chatId || !data) return;
    
    logger.info('Callback query', { chatId, data });
    
    // Answer callback to remove loading state
    await bot.answerCallbackQuery(query.id);
    
    // Handle button clicks here (future enhancement)
});

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

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down...');
    await bot.stopPolling();
    process.exit(0);
});
