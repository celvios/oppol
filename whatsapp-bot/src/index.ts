import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { sessionManager } from './session';
import { UserState } from './types';
import { API } from './api';
import { messages } from './messages';
import { formatMarketList, formatMarketDetails, validateAddress, validateAmount, escapeMarkdown } from './helpers';
import { createButtonMessage, createQuickReply, Button } from './buttons';
import { analytics } from './analytics';
import { alertManager } from './alerts';
import { isAdmin, getAdminCommands, getStatsMessage } from './admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Helper to send WhatsApp message
async function sendMessage(to: string, body: string) {
  try {
    await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body
    });
  } catch (error: any) {
    console.error('Failed to send message:', error.message);
  }
}

// Helper to send message with buttons
async function sendMessageWithButtons(to: string, body: string, buttons: Button[]) {
  try {
    // Note: Twilio's WhatsApp API doesn't support interactive buttons via SDK
    // We'll use text-based menu instead
    let message = body + '\n\n';
    buttons.forEach((btn, idx) => {
      message += `${idx + 1}. ${btn.title}\n`;
    });
    message += '\nReply with number or command name';
    
    await sendMessage(to, message);
  } catch (error: any) {
    console.error('Failed to send button message:', error.message);
  }
}

// Helper to send quick reply
async function sendQuickReply(to: string, body: string, options: string[]) {
  try {
    let message = body + '\n\n';
    options.forEach((opt, idx) => {
      message += `${idx + 1}. ${opt}\n`;
    });
    message += '\nReply with number or option name';
    
    await sendMessage(to, message);
  } catch (error: any) {
    console.error('Failed to send quick reply:', error.message);
  }
}

// Webhook endpoint for incoming WhatsApp messages
app.post('/webhook/whatsapp', async (req, res) => {
  const { From, Body } = req.body;
  const phoneNumber = From.replace('whatsapp:', '');
  const message = Body?.trim().toLowerCase();

  console.log(`📱 Message from ${phoneNumber}: ${message}`);

  // Send 200 OK immediately
  res.status(200).send();

  try {
    // Track message
    analytics.trackMessage(phoneNumber);

    // Get or create session
    const session = sessionManager.get(phoneNumber);

    // Admin commands
    if (isAdmin(phoneNumber)) {
      if (message === 'admin') {
        await sendMessage(phoneNumber, getAdminCommands());
        return;
      }
      if (message === 'stats') {
        await sendMessage(phoneNumber, getStatsMessage());
        return;
      }
    }

    // Handle cancel command
    if (message === 'cancel') {
      sessionManager.clear(phoneNumber);
      await sendMessage(phoneNumber, '❌ Cancelled\n\nReply *menu* to start over');
      return;
    }

    // Handle commands
    if (message === 'start' || message === 'menu' || message === 'hi' || message === 'hello' || !session) {
      await handleStart(phoneNumber);
      return;
    }

    if (message === 'markets' || message === 'm') {
      await handleMarkets(phoneNumber);
      return;
    }

    if (message === 'profile' || message === 'p') {
      await handleProfile(phoneNumber);
      return;
    }

    if (message === 'deposit' || message === 'd') {
      await handleDeposit(phoneNumber);
      return;
    }

    if (message === 'withdraw' || message === 'w') {
      await handleWithdraw(phoneNumber);
      return;
    }

    if (message === 'positions' || message === 'pos') {
      await handlePositions(phoneNumber);
      return;
    }

    if (message === 'help' || message === 'h' || message === '?') {
      await sendMessage(phoneNumber, messages.help);
      return;
    }

    if (message === 'search' || message === 's') {
      await handleSearch(phoneNumber);
      return;
    }

    if (message === 'alerts' || message === 'a') {
      await handleViewAlerts(phoneNumber);
      return;
    }

    if (message === 'setalert' || message === 'alert') {
      await handleSetAlert(phoneNumber);
      return;
    }

    if (message === 'clearalerts') {
      alertManager.clearAll(phoneNumber);
      await sendMessage(phoneNumber, '✅ All alerts cleared\n\nReply *menu* to continue');
      return;
    }

    if (message === 'categories' || message === 'cat') {
      await handleCategories(phoneNumber);
      return;
    }

    if (message === 'trending' || message === 'hot') {
      await handleTrending(phoneNumber);
      return;
    }

    if (message === 'ending' || message === 'soon') {
      await handleEndingSoon(phoneNumber);
      return;
    }

    // Handle state-based flows
    await handleStateFlow(phoneNumber, message, session);

  } catch (error: any) {
    console.error('Error handling message:', error);
    await sendMessage(phoneNumber, messages.error);
  }
});

async function handleStart(phoneNumber: string) {
  sessionManager.clear(phoneNumber);
  
  // Auto-create wallet
  try {
    const userData = await API.getOrCreateUser(phoneNumber);
    analytics.trackUser(phoneNumber, userData.isNew);
  } catch (error) {
    console.error('Failed to create user:', error);
  }

  // Send welcome with menu buttons
  const menuText = `🎰 *Welcome to OPOLL!*

The first prediction market on WhatsApp.

Bet on real-world events and earn money when you're right!

Choose an option below:`;

  await sendMessageWithButtons(phoneNumber, menuText, [
    { id: 'markets', title: '📊 Markets' },
    { id: 'profile', title: '👤 Profile' },
    { id: 'help', title: '❓ Help' }
  ]);
}

async function handleMarkets(phoneNumber: string) {
  try {
    const markets = await API.getActiveMarkets();
    
    if (markets.length === 0) {
      await sendMessage(phoneNumber, '📊 *No active markets*\n\nCheck back later!\n\nReply *menu* to go back');
      return;
    }

    sessionManager.update(phoneNumber, {
      state: UserState.BROWSING_MARKETS,
      data: { page: 0, allMarkets: markets }
    });

    const text = formatMarketList(markets, 0);
    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load markets: ${error.message}`);
  }
}

async function handleProfile(phoneNumber: string) {
  try {
    const [user, balance, positions] = await Promise.all([
      API.getOrCreateUser(phoneNumber),
      API.getUserBalance(phoneNumber),
      API.getUserPositions(phoneNumber)
    ]);

    // Calculate total value
    let totalValue = 0;
    let totalPnL = 0;

    const markets = await API.getActiveMarkets();
    positions.forEach(pos => {
      const market = markets.find(m => m.market_id === pos.marketId);
      if (pos.resolved) {
        const price = pos.winningOutcome === pos.outcome ? 100 : 0;
        const val = pos.shares * (price / 100);
        totalValue += val;
        totalPnL += val - pos.totalInvested;
      } else if (market?.prices) {
        const price = market.prices[pos.outcome] || 0;
        const val = pos.shares * (price / 100);
        totalValue += val;
        totalPnL += val - pos.totalInvested;
      }
    });

    const pnlSign = totalPnL >= 0 ? '+' : '';

    const text = `👤 *Your Profile*\n\n` +
      `Phone: ${phoneNumber}\n` +
      `Wallet: \`${user.user.wallet_address}\`\n` +
      `Balance: $${balance.toFixed(2)} USDC\n` +
      `Holdings: $${totalValue.toFixed(2)}\n` +
      `PnL: ${pnlSign}$${totalPnL.toFixed(2)}\n\n` +
      `Reply *positions* to view your bets`;

    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load profile: ${error.message}`);
  }
}

async function handleDeposit(phoneNumber: string) {
  try {
    const user = await API.getOrCreateUser(phoneNumber);
    const balance = await API.getUserBalance(phoneNumber);

    const text = `💰 *Deposit USDC*\n\n` +
      `Current Balance: $${balance.toFixed(2)} USDC\n\n` +
      `Send USDC (BSC Mainnet) to:\n\n` +
      `\`${user.user.wallet_address}\`\n\n` +
      `⚡ Funds arrive in ~3-10 seconds\n\n` +
      `Reply *profile* to check balance`;

    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load deposit info: ${error.message}`);
  }
}

async function handleWithdraw(phoneNumber: string) {
  sessionManager.update(phoneNumber, {
    state: UserState.ENTERING_WITHDRAW_ADDRESS,
    data: {}
  });

  await sendMessage(phoneNumber, '💸 *Withdraw USDC*\n\nEnter the wallet address to withdraw to:');
}

async function handlePositions(phoneNumber: string) {
  try {
    const [positions, markets] = await Promise.all([
      API.getUserPositions(phoneNumber),
      API.getActiveMarkets()
    ]);

    if (positions.length === 0) {
      await sendMessage(phoneNumber, '📉 *No active positions*\n\nReply *markets* to start trading!');
      return;
    }

    let text = '📋 *My Positions*\n\n';
    let totalPnL = 0;

    positions.forEach(pos => {
      const market = markets.find(m => m.market_id === pos.marketId);
      let currentValue = 0;
      let price = 0;

      if (pos.resolved) {
        price = pos.winningOutcome === pos.outcome ? 100 : 0;
        currentValue = pos.shares * (price / 100);
      } else if (market?.prices) {
        price = market.prices[pos.outcome] || 0;
        currentValue = pos.shares * (price / 100);
      }

      const pnl = currentValue - pos.totalInvested;
      totalPnL += pnl;

      const pnlIcon = pnl >= 0 ? '🟢' : '🔴';
      const sign = pnl >= 0 ? '+' : '';

      text += `*${escapeMarkdown(pos.question)}*\n`;
      text += `${pos.outcomeName} | ${pos.shares} shares\n`;
      text += `Invested: $${pos.totalInvested.toFixed(2)} | Value: $${currentValue.toFixed(2)}\n`;
      text += `PnL: ${pnlIcon} ${sign}$${pnl.toFixed(2)}\n\n`;
    });

    text += `💰 *Total PnL:* $${totalPnL.toFixed(2)}`;

    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load positions: ${error.message}`);
  }
}

async function handleStateFlow(phoneNumber: string, message: string, session: any) {
  if (!session) return;

  switch (session.state) {
    case UserState.BROWSING_MARKETS:
      await handleMarketSelection(phoneNumber, message, session);
      break;

    case UserState.VIEWING_MARKET:
      await handleOutcomeSelection(phoneNumber, message, session);
      break;

    case UserState.ENTERING_AMOUNT:
      await handleAmountInput(phoneNumber, message, session);
      break;

    case UserState.ENTERING_WITHDRAW_ADDRESS:
      await handleWithdrawAddress(phoneNumber, message);
      break;

    case UserState.ENTERING_WITHDRAW_AMOUNT:
      await handleWithdrawAmount(phoneNumber, message, session);
      break;

    case UserState.SEARCHING_MARKETS:
      await handleSearchQuery(phoneNumber, message);
      break;

    case UserState.SETTING_ALERT:
      await handleAlertMarketSelection(phoneNumber, message, session);
      break;

    case UserState.SETTING_ALERT_OUTCOME:
      await handleAlertOutcomeSelection(phoneNumber, message, session);
      break;

    case UserState.SETTING_ALERT_PRICE:
      await handleAlertPriceInput(phoneNumber, message, session);
      break;

    case UserState.SETTING_ALERT_DIRECTION:
      await handleAlertDirectionSelection(phoneNumber, message, session);
      break;

    default:
      await sendMessage(phoneNumber, messages.invalidInput);
  }
}

async function handleMarketSelection(phoneNumber: string, message: string, session: any) {
  // Handle category selection
  if (session.data.categorySelection) {
    const categories: { [key: string]: string } = {
      '1': 'sports', 'sports': 'sports',
      '2': 'crypto', 'crypto': 'crypto',
      '3': 'politics', 'politics': 'politics',
      '4': 'entertainment', 'entertainment': 'entertainment',
      '5': 'all', 'all': 'all'
    };
    
    const category = categories[message];
    if (category) {
      if (category === 'all') {
        await handleMarkets(phoneNumber);
      } else {
        try {
          const markets = await API.getMarketsByCategory(category);
          if (markets.length === 0) {
            await sendMessage(phoneNumber, `📊 No ${category} markets found\n\nReply *markets* to see all`);
            sessionManager.clear(phoneNumber);
            return;
          }
          sessionManager.update(phoneNumber, {
            state: UserState.BROWSING_MARKETS,
            data: { page: 0, allMarkets: markets, categorySelection: false }
          });
          const text = `📊 *${category.charAt(0).toUpperCase() + category.slice(1)} Markets*\n\n` + formatMarketList(markets, 0);
          await sendMessage(phoneNumber, text);
        } catch (error: any) {
          await sendMessage(phoneNumber, `❌ Failed to load: ${error.message}`);
        }
      }
      return;
    }
  }
  
  const markets = session.data.allMarkets || [];
  const page = session.data.page || 0;
  
  if (message === 'next') {
    const newPage = page + 1;
    sessionManager.update(phoneNumber, { data: { ...session.data, page: newPage } });
    const text = formatMarketList(markets, newPage);
    await sendMessage(phoneNumber, text);
    return;
  }

  const num = parseInt(message);
  if (isNaN(num) || num < 1 || num > markets.length) {
    await sendMessage(phoneNumber, '❌ Invalid number. Reply with a market number.');
    return;
  }

  const market = markets[num - 1];
  sessionManager.update(phoneNumber, {
    state: UserState.VIEWING_MARKET,
    data: { ...session.data, marketId: market.market_id }
  });

  const text = formatMarketDetails(market);
  await sendMessage(phoneNumber, text);
}

async function handleOutcomeSelection(phoneNumber: string, message: string, session: any) {
  const marketId = session.data.marketId;
  const market = await API.getMarket(marketId);

  if (!market) {
    await sendMessage(phoneNumber, '❌ Market not found');
    return;
  }

  // Check if message is a number (selecting from list)
  const num = parseInt(message);
  let outcomeIndex = -1;
  
  if (!isNaN(num) && num >= 1 && num <= market.outcomes.length) {
    outcomeIndex = num - 1;
  } else {
    outcomeIndex = market.outcomes.findIndex(o => o.toLowerCase() === message);
  }
  
  if (outcomeIndex === -1) {
    const outcomeList = market.outcomes.map((o, i) => `${i + 1}. ${o}`).join('\n');
    await sendMessage(phoneNumber, `❌ Invalid outcome. Choose:\n\n${outcomeList}\n\nReply with number or name`);
    return;
  }

  sessionManager.update(phoneNumber, {
    state: UserState.ENTERING_AMOUNT,
    data: { ...session.data, outcome: outcomeIndex }
  });

  const outcomeName = market.outcomes[outcomeIndex];
  await sendMessage(phoneNumber, `💰 *Betting on: ${outcomeName}*\n\nHow much USDC do you want to bet?\n\nType the amount (e.g., 10):\n\nReply *cancel* to abort`);
}

async function handleAmountInput(phoneNumber: string, message: string, session: any) {
  if (message === 'cancel') {
    sessionManager.clear(phoneNumber);
    await sendMessage(phoneNumber, '❌ Bet cancelled\n\nReply *menu* to start over');
    return;
  }

  // Check if confirming previous amount
  if (message === 'confirm' && session.data.amount) {
    await executeBet(phoneNumber, session);
    return;
  }

  const amount = validateAmount(message);
  
  if (!amount) {
    await sendMessage(phoneNumber, '❌ Invalid amount. Please enter a valid number (e.g., 10):\n\nReply *cancel* to abort');
    return;
  }

  const { marketId, outcome } = session.data;
  const market = await API.getMarket(marketId);
  const outcomeName = market?.outcomes[outcome] || 'Unknown';
  const price = market?.prices?.[outcome] || 50;
  const shares = (amount / (price / 100)).toFixed(2);

  const text = `✅ *Confirm Bet*\n\n` +
    `Market: ${escapeMarkdown(market?.question || '')}\n` +
    `Outcome: ${outcomeName} (${price}%)\n` +
    `Amount: $${amount} USDC\n` +
    `Shares: ~${shares}\n\n` +
    `Reply *confirm* to place bet or *cancel* to abort`;

  sessionManager.update(phoneNumber, {
    data: { ...session.data, amount }
  });

  await sendMessage(phoneNumber, text);
}

async function executeBet(phoneNumber: string, session: any) {
  const { marketId, outcome, amount } = session.data;
  const market = await API.getMarket(marketId);
  const outcomeName = market?.outcomes[outcome] || 'Unknown';

  await sendMessage(phoneNumber, '⏳ *Processing bet...*\n\nApproving USDC...');

  try {
    const result = await API.placeBet(phoneNumber, marketId, outcome, amount);

    if (result.success) {
      // Track bet
      analytics.trackBet(amount);

      const balance = await API.getUserBalance(phoneNumber);
      const shares = result.shares || 0;
      const text = `✅ *Bet Placed Successfully!*\n\n` +
        `Market: ${escapeMarkdown(market?.question || '')}\n` +
        `Outcome: ${outcomeName}\n` +
        `Amount: $${amount} USDC\n` +
        `Shares: ${shares}\n` +
        `New Balance: $${balance.toFixed(2)} USDC\n\n` +
        `TX: \`${result.transactionHash}\`\n\n` +
        `Reply *positions* to view all bets\nReply *menu* for main menu`;

      await sendMessage(phoneNumber, text);
      sessionManager.clear(phoneNumber);
    } else {
      throw new Error(result.message || 'Bet failed');
    }
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Bet failed: ${error.message}\n\nReply *menu* to try again`);
    sessionManager.clear(phoneNumber);
  }
}

async function handleWithdrawAddress(phoneNumber: string, message: string) {
  if (!validateAddress(message)) {
    await sendMessage(phoneNumber, '❌ Invalid address. Please enter a valid Ethereum address:');
    return;
  }

  sessionManager.update(phoneNumber, {
    state: UserState.ENTERING_WITHDRAW_AMOUNT,
    data: { withdrawAddress: message }
  });

  await sendMessage(phoneNumber, '💸 *Enter Withdrawal Amount*\n\nHow much USDC do you want to withdraw?\n\nType the amount:');
}

async function handleWithdrawAmount(phoneNumber: string, message: string, session: any) {
  if (message === 'cancel') {
    sessionManager.clear(phoneNumber);
    await sendMessage(phoneNumber, '❌ Withdrawal cancelled\n\nReply *menu* to start over');
    return;
  }

  // Check if confirming
  if (message === 'confirm' && session.data.withdrawAmount) {
    await executeWithdraw(phoneNumber, session);
    return;
  }

  const amount = validateAmount(message);
  
  if (!amount) {
    await sendMessage(phoneNumber, '❌ Invalid amount. Please enter a valid number:\n\nReply *cancel* to abort');
    return;
  }

  const { withdrawAddress } = session.data;
  const balance = await API.getUserBalance(phoneNumber);

  if (amount > balance) {
    await sendMessage(phoneNumber, `❌ Insufficient balance\n\nYou have: $${balance.toFixed(2)} USDC\nYou want: $${amount} USDC\n\nReply with lower amount or *cancel*`);
    return;
  }

  const text = `✅ *Confirm Withdrawal*\n\n` +
    `To: \`${withdrawAddress.slice(0, 10)}...${withdrawAddress.slice(-8)}\`\n` +
    `Amount: $${amount} USDC\n` +
    `New Balance: $${(balance - amount).toFixed(2)} USDC\n\n` +
    `Reply *confirm* to withdraw or *cancel* to abort`;

  sessionManager.update(phoneNumber, {
    data: { ...session.data, withdrawAmount: amount }
  });

  await sendMessage(phoneNumber, text);
}

async function executeWithdraw(phoneNumber: string, session: any) {
  const { withdrawAddress, withdrawAmount } = session.data;

  await sendMessage(phoneNumber, '⏳ *Processing withdrawal...*\n\nSending USDC...');

  try {
    const result = await API.withdraw(phoneNumber, withdrawAddress, withdrawAmount);

    if (result.success) {
      const balance = await API.getUserBalance(phoneNumber);
      const text = `✅ *Withdrawal Successful!*\n\n` +
        `To: \`${withdrawAddress}\`\n` +
        `Amount: $${withdrawAmount} USDC\n` +
        `New Balance: $${balance.toFixed(2)} USDC\n\n` +
        `TX: \`${result.transactionHash}\`\n\n` +
        `Reply *menu* to continue`;

      await sendMessage(phoneNumber, text);
      sessionManager.clear(phoneNumber);
    } else {
      throw new Error(result.message || 'Withdrawal failed');
    }
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Withdrawal failed: ${error.message}\n\nReply *menu* to try again`);
    sessionManager.clear(phoneNumber);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'OPOLL WhatsApp Bot' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Bot running on port ${PORT}`);
  console.log(`📡 Webhook URL: ${process.env.WEBHOOK_BASE_URL}/webhook/whatsapp`);
  sessionManager.startCleanup();
  
  // Start alert checking
  alertManager.startChecking(async (phoneNumber, message) => {
    await sendMessage(phoneNumber, message);
  });
});

// Search handler
async function handleSearch(phoneNumber: string) {
  sessionManager.update(phoneNumber, {
    state: UserState.SEARCHING_MARKETS,
    data: {}
  });
  await sendMessage(phoneNumber, '🔍 *Search Markets*\n\nType keywords to search (e.g., "bitcoin", "trump"):\n\nReply *cancel* to abort');
}

// Handle search query
async function handleSearchQuery(phoneNumber: string, query: string) {
  try {
    const markets = await API.getActiveMarkets();
    const filtered = markets.filter(m => 
      m.question.toLowerCase().includes(query.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) {
      await sendMessage(phoneNumber, `🔍 No markets found for "${query}"\n\nTry different keywords or reply *markets* to see all`);
      sessionManager.clear(phoneNumber);
      return;
    }

    sessionManager.update(phoneNumber, {
      state: UserState.BROWSING_MARKETS,
      data: { page: 0, allMarkets: filtered, searchQuery: query }
    });

    const text = `🔍 *Search Results for "${query}"*\n\nFound ${filtered.length} market(s)\n\n` + 
      formatMarketList(filtered, 0);
    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Search failed: ${error.message}`);
    sessionManager.clear(phoneNumber);
  }
}

// View alerts
async function handleViewAlerts(phoneNumber: string) {
  const alerts = alertManager.getAlerts(phoneNumber);
  
  if (alerts.length === 0) {
    await sendMessage(phoneNumber, '🔔 *No Active Alerts*\n\nSet alerts to get notified when prices change!\n\nReply *setalert* to create one\nReply *markets* to browse');
    return;
  }

  let text = '🔔 *Your Price Alerts*\n\n';
  alerts.forEach((alert, idx) => {
    text += `${idx + 1}. Market #${alert.marketId}\n`;
    text += `   Outcome ${alert.outcome}: ${alert.direction} ${alert.targetPrice}%\n\n`;
  });
  text += 'Reply *clearalerts* to remove all\nReply *menu* to go back';
  
  await sendMessage(phoneNumber, text);
}

// Set alert
async function handleSetAlert(phoneNumber: string) {
  try {
    const markets = await API.getActiveMarkets();
    
    if (markets.length === 0) {
      await sendMessage(phoneNumber, '📊 *No active markets*\n\nCheck back later!');
      return;
    }

    sessionManager.update(phoneNumber, {
      state: UserState.SETTING_ALERT,
      data: { page: 0, allMarkets: markets }
    });

    const text = '🔔 *Set Price Alert*\n\nSelect a market:\n\n' + formatMarketList(markets, 0);
    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load markets: ${error.message}`);
  }
}

async function handleAlertMarketSelection(phoneNumber: string, message: string, session: any) {
  const markets = session.data.allMarkets || [];
  const num = parseInt(message);
  
  if (isNaN(num) || num < 1 || num > markets.length) {
    await sendMessage(phoneNumber, '❌ Invalid number. Reply with a market number or *cancel*');
    return;
  }

  const market = markets[num - 1];
  sessionManager.update(phoneNumber, {
    state: UserState.SETTING_ALERT_OUTCOME,
    data: { ...session.data, alertMarketId: market.market_id }
  });

  let text = `🔔 *Alert for:*\n${escapeMarkdown(market.question)}\n\nSelect outcome:\n\n`;
  market.outcomes.forEach((o: string, i: number) => {
    text += `${i + 1}. ${o} (${market.prices[i]}%)\n`;
  });
  text += '\nReply with number or *cancel*';
  
  await sendMessage(phoneNumber, text);
}

async function handleAlertOutcomeSelection(phoneNumber: string, message: string, session: any) {
  const marketId = session.data.alertMarketId;
  const market = await API.getMarket(marketId);

  if (!market) {
    await sendMessage(phoneNumber, '❌ Market not found');
    sessionManager.clear(phoneNumber);
    return;
  }

  const num = parseInt(message);
  if (isNaN(num) || num < 1 || num > market.outcomes.length) {
    await sendMessage(phoneNumber, '❌ Invalid outcome. Reply with number or *cancel*');
    return;
  }

  const outcomeIndex = num - 1;
  sessionManager.update(phoneNumber, {
    state: UserState.SETTING_ALERT_PRICE,
    data: { ...session.data, alertOutcome: outcomeIndex }
  });

  const outcomeName = market.outcomes[outcomeIndex];
  const currentPrice = market.prices[outcomeIndex];
  
  await sendMessage(phoneNumber, `🔔 *Alert for: ${outcomeName}*\n\nCurrent price: ${currentPrice}%\n\nEnter target price (1-99):\n\nReply *cancel* to abort`);
}

async function handleAlertPriceInput(phoneNumber: string, message: string, session: any) {
  const price = parseInt(message);
  
  if (isNaN(price) || price < 1 || price > 99) {
    await sendMessage(phoneNumber, '❌ Invalid price. Enter a number between 1-99 or *cancel*');
    return;
  }

  sessionManager.update(phoneNumber, {
    state: UserState.SETTING_ALERT_DIRECTION,
    data: { ...session.data, alertPrice: price }
  });

  await sendMessage(phoneNumber, `🔔 *Target: ${price}%*\n\nNotify me when price goes:\n\n1. Above ${price}%\n2. Below ${price}%\n\nReply with 1 or 2`);
}

async function handleAlertDirectionSelection(phoneNumber: string, message: string, session: any) {
  const direction = message === '1' ? 'above' : message === '2' ? 'below' : null;
  
  if (!direction) {
    await sendMessage(phoneNumber, '❌ Invalid choice. Reply with 1 (above) or 2 (below)');
    return;
  }

  const { alertMarketId, alertOutcome, alertPrice } = session.data;
  const market = await API.getMarket(alertMarketId);

  if (!market) {
    await sendMessage(phoneNumber, '❌ Market not found');
    sessionManager.clear(phoneNumber);
    return;
  }

  alertManager.add({
    phoneNumber,
    marketId: alertMarketId,
    outcome: alertOutcome,
    targetPrice: alertPrice,
    direction,
    createdAt: Date.now()
  });

  const outcomeName = market.outcomes[alertOutcome];
  const text = `✅ *Alert Created!*\n\n` +
    `Market: ${escapeMarkdown(market.question)}\n` +
    `Outcome: ${outcomeName}\n` +
    `Target: ${direction} ${alertPrice}%\n\n` +
    `You'll be notified when triggered\n\n` +
    `Reply *alerts* to view all alerts\nReply *menu* for main menu`;

  await sendMessage(phoneNumber, text);
  sessionManager.clear(phoneNumber);
}

// Categories
async function handleCategories(phoneNumber: string) {
  const text = `📊 *Browse by Category*\n\n` +
    `1. 🏈 Sports\n` +
    `2. 💰 Crypto\n` +
    `3. 🗳️ Politics\n` +
    `4. 🎬 Entertainment\n` +
    `5. 📊 All Markets\n\n` +
    `Reply with number or name`;
  
  sessionManager.update(phoneNumber, {
    state: UserState.BROWSING_MARKETS,
    data: { categorySelection: true }
  });
  
  await sendMessage(phoneNumber, text);
}

async function handleTrending(phoneNumber: string) {
  try {
    const markets = await API.getTrendingMarkets();
    
    if (markets.length === 0) {
      await sendMessage(phoneNumber, '🔥 *No trending markets*\n\nReply *markets* to see all');
      return;
    }

    sessionManager.update(phoneNumber, {
      state: UserState.BROWSING_MARKETS,
      data: { page: 0, allMarkets: markets }
    });

    const text = '🔥 *Trending Markets*\n\nMost active right now:\n\n' + formatMarketList(markets, 0);
    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load trending: ${error.message}`);
  }
}

async function handleEndingSoon(phoneNumber: string) {
  try {
    const markets = await API.getEndingSoonMarkets();
    
    if (markets.length === 0) {
      await sendMessage(phoneNumber, '⏰ *No markets ending soon*\n\nReply *markets* to see all');
      return;
    }

    sessionManager.update(phoneNumber, {
      state: UserState.BROWSING_MARKETS,
      data: { page: 0, allMarkets: markets }
    });

    const text = '⏰ *Ending Soon*\n\nLast chance to bet:\n\n' + formatMarketList(markets, 0);
    await sendMessage(phoneNumber, text);
  } catch (error: any) {
    await sendMessage(phoneNumber, `❌ Failed to load markets: ${error.message}`);
  }
}

