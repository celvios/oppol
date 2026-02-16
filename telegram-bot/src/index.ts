import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { messages } from './messages';
import { SessionManager } from './session';
import { UserState } from './types';
import { API, Market } from './api';
import { paginateMarkets, buildMarketButtons, escapeMarkdown } from './helpers';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });

console.log('🚀 OPOLL Telegram Bot Starting...\n');

const INSTANCE_ID = Math.floor(Math.random() * 10000);
console.log(`🆔 Instance ID: ${INSTANCE_ID}`);

bot.on('polling_error', (error: any) => {
    if (error?.code === 'ETELEGRAM' && error?.message?.includes('409 Conflict')) {
        console.warn(`⚠️ [Instance ${INSTANCE_ID}] Conflict detected! Another bot instance is active.`);
    } else {
        console.error(`❌ [Instance ${INSTANCE_ID}] Polling error:`, error.message);
    }
});

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await SessionManager.clear(chatId);

    // Auto-create wallet for user
    try {
        await API.getOrCreateUser(chatId, msg.from?.username);
    } catch (error) {
        console.error('Failed to create user:', error);
    }

    bot.sendMessage(chatId, messages.welcome, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Markets', callback_data: 'markets' }],
                [{ text: '👤 Profile', callback_data: 'profile' }],
                [{ text: '💰 Deposit', callback_data: 'deposit' }],
                [{ text: '💸 Withdraw', callback_data: 'withdraw' }],
                [{ text: '❓ Help', callback_data: 'help' }]
            ]
        }
    });
});

// Handle menu command
bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    await SessionManager.clear(chatId);
    bot.sendMessage(chatId, 'Main Menu:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Markets', callback_data: 'markets' }],
                [{ text: '👤 Profile', callback_data: 'profile' }],
                [{ text: '💰 Deposit', callback_data: 'deposit' }],
                [{ text: '💸 Withdraw', callback_data: 'withdraw' }],
                [{ text: '❓ Help', callback_data: 'help' }]
            ]
        }
    });
});

// Handle button callbacks
bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const data = query.data;

    await bot.answerCallbackQuery(query.id);

    switch (data) {
        case 'markets':
            try {
                const markets = await API.getActiveMarkets();
                if (markets.length === 0) {
                    bot.sendMessage(chatId, '📊 *No active markets*\n\nCheck back later!', {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                        }
                    });
                } else {
                    const { pageMarkets, hasNext, hasPrev } = paginateMarkets(markets, 0);
                    await SessionManager.update(chatId, {
                        state: UserState.BROWSING_MARKETS,
                        data: { page: 0, allMarkets: markets }
                    });
                    const buttons = buildMarketButtons(pageMarkets, 0, hasNext, hasPrev);
                    bot.sendMessage(chatId, '📊 *Active Markets* (Page 1)\n\nSelect a market:', {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: buttons }
                    });
                }
            } catch (error: any) {
                console.error('Markets error:', error);
                bot.sendMessage(chatId, `❌ Failed to load markets: ${error.message}`, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                    }
                });
            }
            break;

        case 'positions':
            try {
                const [positions, activeMarkets] = await Promise.all([
                    API.getUserPositions(chatId),
                    API.getActiveMarkets()
                ]);

                if (positions.length === 0) {
                    bot.sendMessage(chatId, '📉 *No active positions*\n\nStart trading to see them here!', {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[{ text: '📊 Go to Markets', callback_data: 'markets' }], [{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                        }
                    });
                } else {
                    let text = '📋 *My Positions*\n\n';
                    let totalPnL = 0;

                    for (const pos of positions) {
                        const market = activeMarkets.find(m => m.market_id === pos.marketId);
                        let currentValue = 0;
                        let price = 0;

                        if (pos.resolved) {
                            // Market is resolved: Winner gets 100% ($1), Loser 0
                            price = (pos.winningOutcome === pos.outcome) ? 100 : 0;
                            currentValue = pos.shares * (price / 100);
                        } else if (market && market.prices && market.prices[pos.outcome]) {
                            price = market.prices[pos.outcome];
                            currentValue = pos.shares * (price / 100);
                        } else {
                            // Valid fallback if market still loading
                            price = 0;
                            currentValue = 0;
                        }

                        const pnl = currentValue - pos.totalInvested;
                        totalPnL += pnl;

                        const pnlIcon = pnl >= 0 ? '🟢' : '🔴';
                        const sign = pnl >= 0 ? '+' : '';

                        text += `*${escapeMarkdown(pos.question)}*\n`;
                        text += `Outcome: ${pos.outcomeName} | Shares: ${pos.shares}\n`;
                        text += `Invested: $${pos.totalInvested.toFixed(2)} | Value: $${currentValue.toFixed(2)}\n`;
                        text += `PnL: ${pnlIcon} ${sign}$${pnl.toFixed(2)} (${price}%)\n\n`;
                    }

                    text += `💰 *Total PnL:* $${totalPnL.toFixed(2)}`;

                    bot.sendMessage(chatId, text, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                        }
                    });
                }
            } catch (error: any) {
                console.error('Positions error:', error);
                bot.sendMessage(chatId, `❌ Failed to load positions: ${error.message}`);
            }
            break;

        case 'search':
            await SessionManager.update(chatId, { state: UserState.SEARCHING_MARKETS });
            bot.sendMessage(chatId, '🔍 *Search Markets*\n\nType a keyword to search:', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Markets', callback_data: 'markets' }]]
                }
            });
            break;

        case 'profile':
            try {
                const [userRaw, balance, positions, activeMarkets] = await Promise.all([
                    API.getOrCreateUser(chatId, query.from?.username),
                    API.getUserBalance(chatId),
                    API.getUserPositions(chatId),
                    API.getActiveMarkets()
                ]);

                // Calculate PnL
                let totalPnL = 0;
                let totalValue = 0;

                positions.forEach(pos => {
                    const market = activeMarkets.find(m => m.market_id === pos.marketId);
                    if (pos.resolved) {
                        const price = (pos.winningOutcome === pos.outcome) ? 100 : 0;
                        const val = pos.shares * (price / 100);
                        totalValue += val;
                        totalPnL += (val - pos.totalInvested);
                    } else if (market && market.prices) {
                        const price = market.prices[pos.outcome] || 0;
                        const val = pos.shares * (price / 100);
                        totalValue += val;
                        totalPnL += (val - pos.totalInvested);
                    }
                });

                const userResult = userRaw; // Re-use
                const hasUsername = !!query.from?.username;
                const displayLabel = hasUsername ? 'Username' : 'Name';
                const displayValue = hasUsername ? `@${query.from.username}` : (query.from?.first_name || 'User');
                const pnlSign = totalPnL >= 0 ? '+' : '';

                bot.sendMessage(chatId,
                    `👤 *Your Profile*\n\n` +
                    `Telegram ID: ${chatId}\n` +
                    `${displayLabel}: ${escapeMarkdown(displayValue)}\n` +
                    `Wallet: \`${userResult.user?.wallet_address || 'N/A'}\`\n` +
                    `Balance: $${balance.toFixed(2)} USDC\n` +
                    `Est. Holdings Value: $${totalValue.toFixed(2)}\n` +
                    `Unrealized PnL: ${pnlSign}$${totalPnL.toFixed(2)}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 My Positions', callback_data: 'positions' }],
                                [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
                            ]
                        }
                    }
                );
            } catch (error: any) {
                bot.sendMessage(chatId, `❌ Failed to load profile: ${error.message}`, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                    }
                });
            }
            break;

        case 'deposit':
            try {
                await API.getOrCreateUser(chatId, query.from?.username);
                const userResult = await API.getOrCreateUser(chatId, query.from?.username);
                const walletAddress = userResult.user?.wallet_address;
                const balance = await API.getUserBalance(chatId);

                bot.sendMessage(chatId,
                    `💰 *Deposit USDC*\n\n` +
                    `Current Balance: ${balance} USDC\n\n` +
                    `Send USDC (BSC Mainnet) to:\n\n` +
                    `\`${walletAddress}\`\n\n` +
                    `⚡ Funds arrive in ~3-10 seconds`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Refresh Balance', callback_data: 'profile' }],
                                [{ text: '🔙 Back to Menu', callback_data: 'menu' }]
                            ]
                        }
                    }
                );
            } catch (error: any) {
                bot.sendMessage(chatId, `❌ Failed to load deposit info: ${error.message}`, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                    }
                });
            }
            break;

        case 'withdraw':
            await SessionManager.update(chatId, { state: UserState.ENTERING_WITHDRAW_ADDRESS });
            bot.sendMessage(chatId, '💸 *Withdraw USDC*\n\nEnter the wallet address to withdraw to:', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]]
                }
            });
            break;

        case 'help':
            bot.sendMessage(chatId, messages.help, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]]
                }
            });
            break;

        case 'menu':
            await SessionManager.clear(chatId);
            bot.sendMessage(chatId, 'Main Menu:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📊 Markets', callback_data: 'markets' }],
                        [{ text: '📋 My Positions', callback_data: 'positions' }],
                        [{ text: '👤 Profile', callback_data: 'profile' }],
                        [{ text: '💰 Deposit', callback_data: 'deposit' }],
                        [{ text: '💸 Withdraw', callback_data: 'withdraw' }],
                        [{ text: '❓ Help', callback_data: 'help' }]
                    ]
                }
            });
            break;

        default:
            if (data?.startsWith('page_')) {
                const page = parseInt(data.split('_')[1]);
                const session = await SessionManager.get(chatId);
                const markets = session?.data.allMarkets || [];
                const { pageMarkets, hasNext, hasPrev } = paginateMarkets(markets, page);
                await SessionManager.update(chatId, { data: { ...session?.data, page } });
                const buttons = buildMarketButtons(pageMarkets, page, hasNext, hasPrev);
                bot.sendMessage(chatId, `📊 *Active Markets* (Page ${page + 1})\n\nSelect a market:`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: buttons }
                });
            } else if (data?.startsWith('market_')) {
                const marketId = parseInt(data.split('_')[1]);
                try {
                    // Always fetch fresh market data
                    const market = await API.getMarket(marketId);
                    if (!market) {
                        bot.sendMessage(chatId, '❌ Market not found', {
                            reply_markup: {
                                inline_keyboard: [[{ text: '🔙 Back to Markets', callback_data: 'markets' }]]
                            }
                        });
                        return;
                    }

                    await SessionManager.update(chatId, {
                        state: UserState.VIEWING_MARKET,
                        data: { marketId }
                    });

                    // Format end time
                    const endDate = market.endTime ? new Date(market.endTime * 1000).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    }) : 'TBD';

                    // Build market details text
                    let text = `📊 *${escapeMarkdown(market.question)}*\n\n`;

                    if (market.description) {
                        text += `${escapeMarkdown(market.description)}\n\n`;
                    }

                    // Show outcome probabilities with fresh data
                    if (market.outcomes && market.prices) {
                        text += `📈 *Current Odds:*\n`;
                        market.outcomes.forEach((outcome, i) => {
                            const price = (market.prices![i] || 50).toFixed(1);
                            const emoji = i === 0 ? '🟢' : i === 1 ? '🔴' : '🔵';
                            text += `${emoji} ${outcome}: *${price}%*\n`;
                        });
                        text += `\n`;
                    }

                    // Show VOLUME and end time (Liquidity replaced by Volume)
                    const vol = market.totalVolume ? `$${market.totalVolume}` : 'N/A';
                    text += `📊 *Volume:* ${vol}\n`;
                    text += `⏰ *Ends:* ${endDate}\n`;
                    text += `🕐 *Updated:* ${new Date().toLocaleTimeString()}\n\n`;

                    text += `*Select an outcome to bet on:*`;

                    // Build buttons for each outcome with current prices
                    const outcomeButtons = (market.outcomes || ['Yes', 'No']).map((outcome, i) => {
                        const price = (market.prices?.[i] || 50).toFixed(1);
                        return [{ text: `${outcome} (${price}%)`, callback_data: `bet_${marketId}_${i}` }];
                    });

                    const buttons = [
                        ...outcomeButtons,
                        [{ text: '🔄 Refresh Odds', callback_data: `market_${marketId}` }],
                        [{ text: '🔙 Back to Markets', callback_data: 'markets' }]
                    ];

                    bot.sendMessage(chatId, text, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: buttons }
                    });
                } catch (error: any) {
                    console.error('Market details error:', error);
                    bot.sendMessage(chatId, `❌ Failed to load market: ${error.message}`, {
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Back to Markets', callback_data: 'markets' }]]
                        }
                    });
                }
            } else if (data?.startsWith('bet_')) {
                const [, marketId, outcome] = data.split('_');
                await SessionManager.update(chatId, {
                    state: UserState.ENTERING_AMOUNT,
                    data: { marketId: parseInt(marketId), outcome: parseInt(outcome) }
                });
                bot.sendMessage(chatId, `💰 *Enter Bet Amount*\n\nHow much USDC do you want to bet?\n\nType the amount (e.g., 10):`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '❌ Cancel', callback_data: `market_${marketId}` }]]
                    }
                });
            } else if (data?.startsWith('confirm_')) {
                const [, marketId, outcome, amount] = data.split('_');
                const processingMsg = await bot.sendMessage(chatId, '⏳ *Processing bet...*\n\nApproving USDC...', { parse_mode: 'Markdown' });

                try {
                    const result = await API.placeBet(chatId, parseInt(marketId), parseInt(outcome), parseFloat(amount));

                    await bot.deleteMessage(chatId, processingMsg.message_id);
                    await SessionManager.clear(chatId);

                    if (result.success) {
                        const balance = await API.getUserBalance(chatId);
                        bot.sendMessage(chatId,
                            `✅ *Bet Placed Successfully!*\n\n` +
                            `Market ID: ${marketId}\n` +
                            `Outcome: ${outcome === '1' ? 'YES' : 'NO'}\n` + // Warning: simple binary assumption here, but multi-outcome works by index
                            `Amount: ${amount} USDC\n` +
                            `New Balance: ${balance} USDC\n\n` +
                            `Tx: \`${result.transactionHash}\``,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '📋 My Positions', callback_data: 'positions' }],
                                        [{ text: '📊 View Markets', callback_data: 'markets' }],
                                        [{ text: '🔙 Main Menu', callback_data: 'menu' }]
                                    ]
                                }
                            }
                        );
                    } else {
                        throw new Error(result.message || 'Bet placement failed');
                    }
                } catch (error: any) {
                    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => { });
                    const cleanError = error.message.replace(/[_*[\]()~>#+=|{}.!-]/g, '\\$&'); // Escape all Markdown chars
                    bot.sendMessage(chatId, `❌ Bet failed: ${cleanError}`, {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Back to Markets', callback_data: 'markets' }]]
                        }
                    });
                }
            } else if (data?.startsWith('withdraw_confirm_')) {
                const amount = parseFloat(data.split('_')[2]);
                const session = await SessionManager.get(chatId);
                const withdrawAddress = session?.data.withdrawAddress;

                const processingMsg = await bot.sendMessage(chatId, '⏳ *Processing withdrawal...*\n\nSending USDC...', { parse_mode: 'Markdown' });

                try {
                    const result = await API.withdraw(chatId, withdrawAddress!, amount);

                    await bot.deleteMessage(chatId, processingMsg.message_id);
                    await SessionManager.clear(chatId);

                    if (result.success) {
                        const balance = await API.getUserBalance(chatId);
                        bot.sendMessage(chatId,
                            `✅ *Withdrawal Successful!*\n\n` +
                            `To: \`${withdrawAddress}\`\n` +
                            `Amount: ${amount} USDC\n` +
                            `New Balance: ${balance} USDC\n\n` +
                            `Tx: \`${result.transactionHash}\``,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                                }
                            }
                        );
                    } else {
                        throw new Error(result.message || 'Withdrawal failed');
                    }
                } catch (error: any) {
                    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => { });
                    bot.sendMessage(chatId, `❌ Withdrawal failed: ${error.message}`, {
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'menu' }]]
                        }
                    });
                }
            }
            break;
    }
});

console.log('✅ Bot is running!');
console.log('📱 Open Telegram and search for your bot');
console.log('💬 Send /start to begin\n');

// Handle text messages (search and bet amount)
bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const session = await SessionManager.get(chatId);

    if (!session || !text) return;

    // Handle search query
    if (session.state === UserState.SEARCHING_MARKETS) {
        try {
            const markets = await API.getActiveMarkets();
            const filtered = markets.filter(m =>
                m.question.toLowerCase().includes(text.toLowerCase()) ||
                m.description.toLowerCase().includes(text.toLowerCase())
            );

            if (filtered.length === 0) {
                bot.sendMessage(chatId, `🔍 No markets found for "${text}"`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Search Again', callback_data: 'search' }],
                            [{ text: '🔙 Back to Markets', callback_data: 'markets' }]
                        ]
                    }
                });
            } else {
                const { pageMarkets, hasNext, hasPrev } = paginateMarkets(filtered, 0);
                await SessionManager.update(chatId, {
                    state: UserState.BROWSING_MARKETS,
                    data: { page: 0, allMarkets: filtered, searchQuery: text }
                });
                const buttons = buildMarketButtons(pageMarkets, 0, hasNext, hasPrev);
                bot.sendMessage(chatId, `🔍 *Search Results for "${text}"* (${filtered.length} found)\n\nSelect a market:`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: buttons }
                });
            }
        } catch (error: any) {
            bot.sendMessage(chatId, `❌ Search failed: ${error.message}`);
        }
    }

    // Handle bet amount
    else if (session.state === UserState.ENTERING_AMOUNT) {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, '❌ Invalid amount. Please enter a valid number (e.g., 10):', {
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: `market_${session.data.marketId}` }]]
                }
            });
            return;
        }

        const { marketId, outcome } = session.data;
        const outcomeName = outcome === 1 ? 'YES' : 'NO';

        bot.sendMessage(chatId,
            `✅ *Confirm Bet*\n\n` +
            `Market ID: ${marketId}\n` +
            `Outcome: ${outcomeName}\n` +
            `Amount: ${amount} USDC\n\n` +
            `Confirm to place bet?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Confirm', callback_data: `confirm_${marketId}_${outcome}_${amount}` }],
                        [{ text: '❌ Cancel', callback_data: `market_${marketId}` }]
                    ]
                }
            }
        );
    }

    // Handle withdraw address
    else if (session.state === UserState.ENTERING_WITHDRAW_ADDRESS) {
        if (!text.match(/^0x[a-fA-F0-9]{40}$/)) {
            bot.sendMessage(chatId, '❌ Invalid address. Please enter a valid Ethereum address:', {
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]]
                }
            });
            return;
        }

        await SessionManager.update(chatId, {
            state: UserState.ENTERING_WITHDRAW_AMOUNT,
            data: { ...session.data, withdrawAddress: text }
        });

        bot.sendMessage(chatId, '💸 *Enter Withdrawal Amount*\n\nHow much USDC do you want to withdraw?\n\nType the amount:', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]]
            }
        });
    }

    // Handle withdraw amount
    else if (session.state === UserState.ENTERING_WITHDRAW_AMOUNT) {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, '❌ Invalid amount. Please enter a valid number:', {
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]]
                }
            });
            return;
        }

        const { withdrawAddress } = session.data;

        bot.sendMessage(chatId,
            `✅ *Confirm Withdrawal*\n\n` +
            `To: ${withdrawAddress?.substring(0, 10)}...\n` +
            `Amount: ${amount} USDC\n\n` +
            `Confirm to withdraw?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Confirm', callback_data: `withdraw_confirm_${amount}` }],
                        [{ text: '❌ Cancel', callback_data: 'menu' }]
                    ]
                }
            }
        );
    }
});
