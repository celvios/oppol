import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import { messages } from './messages';
import { SessionManager } from './session';
import { UserState } from './types';
import { API } from './api';
import { paginateMarkets, buildMarketListText } from './helpers';

dotenv.config();

console.log('🚀 Starting OPOLL WhatsApp Bot...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 Scan this QR code to login:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Client is ready!');
});

client.on('message', async (msg) => {
    try {
        await handleMessage(msg);
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

client.initialize();

async function handleMessage(msg: Message) {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const sender = contact.number; // e.g. "1234567890" WITHOUT + usually

    // Normalize body
    const text = msg.body.trim().toLowerCase();

    // Create User if needed (Lazy check)
    // We don't block the flow if it fails, but good to ensure they exist
    if (text === '!start' || text === 'hi' || text === 'hello') {
        try {
            await API.getOrCreateUser(sender, contact.pushname || contact.name);
        } catch (e) { console.error('Create user fail', e); }
    }

    // Get Session
    let session = await SessionManager.get(sender);

    // --- GLOBAL COMMANDS ---
    if (text === '!start' || text === 'hi' || text === 'menu' || text === 'm') {
        await SessionManager.clear(sender);
        await chat.sendMessage(messages.welcome);
        return;
    }

    if (text === 'help') {
        await chat.sendMessage(messages.help);
        return;
    }

    // --- MAIN MENU HANDLER ---
    if (!session || session.state === UserState.IDLE) {
        switch (text) {
            case '1': // Markets
            case 'markets':
                try {
                    const markets = await API.getActiveMarkets();
                    if (markets.length === 0) {
                        await chat.sendMessage('📊 *No active markets*\n\nCheck back later!');
                        return;
                    }
                    const { pageMarkets, hasNext, hasPrev } = paginateMarkets(markets, 0);
                    await SessionManager.update(sender, {
                        state: UserState.BROWSING_MARKETS,
                        data: { page: 0, allMarkets: markets }
                    });
                    await chat.sendMessage(buildMarketListText(pageMarkets, 0, hasNext, hasPrev));
                } catch (e: any) {
                    await chat.sendMessage(`❌ Error loading markets: ${e.message}`);
                }
                break;

            case '2': // Profile
            case 'profile':
                try {
                    const [balance, positions] = await Promise.all([
                        API.getUserBalance(sender),
                        API.getUserPositions(sender)
                    ]);

                    let pnlText = `💰 *Balance:* $${balance.toFixed(2)} USDC\n\n`;
                    if (positions.length > 0) {
                        pnlText += `📋 *Positions:*\n`;
                        positions.forEach(p => {
                            pnlText += `- ${p.question}\n  ${p.outcomeName}: ${p.shares} shares ($${p.totalInvested})\n`;
                        });
                    } else {
                        pnlText += `_No active positions_`;
                    }

                    await chat.sendMessage(`👤 *Profile*\n\n${pnlText}\n\nreply "menu" to go back.`);
                } catch (e: any) {
                    await chat.sendMessage(`❌ Error loading profile: ${e.message}`);
                }
                break;

            case '3': // Deposit
                const user = await API.getOrCreateUser(sender);
                await chat.sendMessage(`💰 *Deposit USDC*\n\nSend BSC USDC to:\n*${user.walletAddress}*\n\nFunds arrive in seconds.`);
                break;

            case '4': // Withdraw
                await SessionManager.update(sender, { state: UserState.ENTERING_WITHDRAW_ADDRESS });
                await chat.sendMessage('💸 *Withdraw USDC*\n\nEnter the wallet address to withdraw to:');
                break;

            case '5':
                await chat.sendMessage(messages.help);
                break;

            default:
                // Don't spam if unknown input in IDLE, or maybe remind them?
                // await chat.sendMessage('❓ Unknown command. Reply "menu" for options.');
                break;
        }
        return;
    }

    // --- STATE HANDLERS ---

    // 1. BROWSING MARKETS
    if (session.state === UserState.BROWSING_MARKETS) {
        const { allMarkets, page } = session.data;

        // Navigation
        if (text === 'n' || text === 'next') {
            const newPage = page + 1;
            const { pageMarkets, hasNext, hasPrev } = paginateMarkets(allMarkets, newPage);
            if (pageMarkets.length === 0) {
                await chat.sendMessage('No more pages.');
                return;
            }
            await SessionManager.update(sender, { data: { page: newPage } });
            await chat.sendMessage(buildMarketListText(pageMarkets, newPage, hasNext, hasPrev));
            return;
        }

        if (text === 'p' || text === 'back' || text === 'prev') {
            const newPage = Math.max(0, page - 1);
            const { pageMarkets, hasNext, hasPrev } = paginateMarkets(allMarkets, newPage);
            await SessionManager.update(sender, { data: { page: newPage } });
            await chat.sendMessage(buildMarketListText(pageMarkets, newPage, hasNext, hasPrev));
            return;
        }

        // Selection
        const selection = parseInt(text);
        if (!isNaN(selection) && selection >= 1 && selection <= 5) {
            const { pageMarkets } = paginateMarkets(allMarkets, page);
            const market = pageMarkets[selection - 1]; // 0-indexed

            if (!market) {
                await chat.sendMessage('❌ Invalid selection.');
                return;
            }

            // Show Market Details
            // Fetch fresh prices
            const freshMarket = await API.getMarket(market.market_id);
            const m = freshMarket || market;

            let msg = `📊 *${m.question}*\n\n`;
            if (m.outcomes && m.prices) {
                m.outcomes.forEach((out, idx) => {
                    msg += `${idx + 1}. ${out} (${Math.round(m.prices![idx] || 0)}%)\n`;
                });
            }
            msg += `\nReply with option number (e.g. "1") to BET.`;

            await SessionManager.update(sender, {
                state: UserState.VIEWING_MARKET,
                data: { marketId: m.market_id, outcomes: m.outcomes }
            });

            await chat.sendMessage(msg);
            return;
        }
    }

    // 2. VIEWING MARKET (Selecting Outcome)
    if (session.state === UserState.VIEWING_MARKET) {
        const { outcomes, marketId } = session.data;
        const selection = parseInt(text);

        if (!isNaN(selection) && selection >= 1 && selection <= outcomes.length) {
            const outcomeIndex = selection - 1;
            const outcomeName = outcomes[outcomeIndex];

            await SessionManager.update(sender, {
                state: UserState.ENTERING_AMOUNT,
                data: { outcome: outcomeIndex, outcomeName }
            });

            await chat.sendMessage(`💰 Betting on *${outcomeName}*.\n\nHow much USDC? (Reply with number, e.g. "10")`);
            return;
        }
    }

    // 3. ENTERING AMOUNT (Placing Bet)
    if (session.state === UserState.ENTERING_AMOUNT) {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            await chat.sendMessage('❌ Invalid amount. Please reply with a valid number.');
            return;
        }

        const { marketId, outcome, outcomeName } = session.data;

        await chat.sendMessage(`⏳ Placing bet: $${amount} on ${outcomeName}...`);

        try {
            const res = await API.placeBet(sender, marketId, outcome, amount);
            if (res.success) {
                await chat.sendMessage(`✅ *Bet Confirmed!*\n\nTX: ${res.transactionHash?.substring(0, 10)}...\n\nReply "menu" for more options.`);
                await SessionManager.clear(sender);
            } else {
                await chat.sendMessage(`❌ Bet Failed: ${res.message || 'Unknown error'}`);
                await SessionManager.clear(sender); // Reset on error? Or let retry? Let's reset for safety.
            }
        } catch (e: any) {
            await chat.sendMessage(`❌ Bet Error: ${e.message}`);
            await SessionManager.clear(sender);
        }
        return;
    }

    // 4. WITHDRAW FLOW
    if (session.state === UserState.ENTERING_WITHDRAW_ADDRESS) {
        if (!text.startsWith('0x') || text.length !== 42) {
            await chat.sendMessage('❌ Invalid address format. Must start with 0x...');
            return;
        }

        await SessionManager.update(sender, {
            state: UserState.ENTERING_WITHDRAW_AMOUNT,
            data: { withdrawAddress: text }
        });

        await chat.sendMessage('💸 Enter amount to withdraw:');
        return;
    }

    if (session.state === UserState.ENTERING_WITHDRAW_AMOUNT) {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            await chat.sendMessage('❌ Invalid amount.');
            return;
        }
        const { withdrawAddress } = session.data;

        await chat.sendMessage(`⏳ Withdrawing $${amount} to ${withdrawAddress}...`);

        try {
            const res = await API.withdraw(sender, withdrawAddress, amount);
            await chat.sendMessage(`✅ *Withdrawal Sent!*\nTX: ${res.transactionHash}`);
            await SessionManager.clear(sender);
        } catch (e: any) {
            await chat.sendMessage(`❌ Withdraw Error: ${e.message}`);
            await SessionManager.clear(sender);
        }
        return;
    }
}
