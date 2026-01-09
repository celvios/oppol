/**
 * Message templates for WhatsApp bot
 * Clean, minimal, emoji-enhanced
 */

export const messages = {
    // ============ WELCOME ============
    welcome: `🎰 *Welcome to OPOLL*

Predict. Trade. Win.

The prediction market in your pocket.

Reply *menu* to get started.`,

    // ============ MAIN MENU ============
    mainMenu: `📱 *OPOLL*

What would you like to do?

*1.* 📊 Markets
*2.* 💼 Profile  
*3.* 💰 Deposit
*4.* 💸 Withdraw

_Reply with a number_`,

    // ============ MARKETS ============
    marketsHeader: `📊 *Active Markets*

`,

    marketItem: (id: number, question: string, yesOdds: number, volume: string) =>
        `*${id}.* ${question}
   └ ${yesOdds}% YES · Vol: $${volume}
`,

    marketsFooter: `
_Reply with market number to trade_
*0.* ← Back to Menu`,

    // ============ MARKET DETAIL ============
    marketDetail: (
        question: string,
        yesOdds: number,
        noOdds: number,
        volume: string,
        endDate: string,
        userYesShares: number,
        userNoShares: number
    ) => `📊 *${question}*

┌─────────────────────
│ ✅ YES: *${yesOdds}%*  │  ❌ NO: *${noOdds}%*
└─────────────────────

📈 Volume: $${volume}
⏰ Ends: ${endDate}
${userYesShares > 0 || userNoShares > 0 ? `
🎫 Your Position:
   ${userYesShares > 0 ? `✅ ${userYesShares} YES shares` : ''}
   ${userNoShares > 0 ? `❌ ${userNoShares} NO shares` : ''}` : ''}

*1.* ✅ Buy YES
*2.* ❌ Buy NO
*0.* ← Back to Markets`,

    // ============ BET AMOUNT ============
    betAmount: (side: 'YES' | 'NO', question: string, balance: string) =>
        `💰 *Buy ${side}*

${question}

Your balance: *$${balance}*

_How much would you like to bet?_
Reply with amount (e.g. 100)

*0.* ← Cancel`,

    // ============ BET CONFIRM ============
    betConfirm: (
        question: string,
        side: 'YES' | 'NO',
        amount: number,
        shares: number,
        price: number
    ) => `⚠️ *Confirm Your Bet*

📊 ${question}
💡 Side: ${side === 'YES' ? '✅ YES' : '❌ NO'}
💵 Amount: $${amount.toFixed(2)}
🎫 Shares: ~${shares} @ $${price.toFixed(2)}

*1.* ✅ Confirm
*0.* ← Cancel`,

    // ============ BET SUCCESS ============
    betSuccess: (side: 'YES' | 'NO', shares: number, cost: number, newPrice: number) =>
        `🎉 *Bet Placed!*

${side === 'YES' ? '✅' : '❌'} ${shares} ${side} shares purchased
💵 Cost: $${cost.toFixed(2)} USDC
📊 New Price: ${newPrice}%

*1.* 📊 More Markets
*2.* 💼 View Profile
*0.* ← Main Menu`,

    // ============ PROFILE ============
    profile: (
        balance: string,
        positionCount: number,
        totalPnL: string,
        positions: Array<{ market: string; side: string; shares: number; pnl: string }>
    ) => {
        let positionsList = '';
        if (positions.length > 0) {
            positions.slice(0, 5).forEach(p => {
                const icon = p.side === 'YES' ? '✅' : '❌';
                const pnlColor = parseFloat(p.pnl) >= 0 ? '+' : '';
                positionsList += `\n   ${icon} ${p.market.substring(0, 25)}...
      ${p.shares} shares · ${pnlColor}$${p.pnl}`;
            });
        } else {
            positionsList = '\n   _No active positions_';
        }

        return `💼 *Your Profile*

💰 Balance: *$${balance}*
📊 Positions: ${positionCount}
📈 Total PnL: *${parseFloat(totalPnL) >= 0 ? '+' : ''}$${totalPnL}*

*Active Positions:*${positionsList}

*1.* 📊 Markets
*2.* 💰 Deposit
*3.* 💸 Withdraw
*0.* ← Main Menu`;
    },

    // ============ DEPOSIT ============
    deposit: (address: string) => `💰 *Deposit USDC*

Send USDC (BNB Chain) to:

\`${address}\`

⚠️ *Important:*
• Only USDC on BNB Chain (BSC)
• Min: $10 · Max: $100,000  
• Funds credited after 12 confirmations

*0.* ← Main Menu`,

    // ============ WITHDRAW ============
    withdrawAmount: (balance: string) => `💸 *Withdraw Funds*

Your balance: *$${balance}*

_Enter amount to withdraw:_
(e.g. 100)

*0.* ← Cancel`,

    withdrawAddress: (amount: number) => `💸 *Withdraw $${amount.toFixed(2)}*

_Enter your BNB Chain wallet address:_

*0.* ← Cancel`,

    withdrawConfirm: (amount: number, address: string) => `⚠️ *Confirm Withdrawal*

💵 Amount: $${amount.toFixed(2)} USDC
📭 To: ${address.substring(0, 10)}...${address.substring(38)}
🌐 Network: BNB Chain

*1.* ✅ Confirm
*0.* ← Cancel`,

    withdrawSuccess: (amount: number, txHash: string) => `✅ *Withdrawal Initiated*

💵 Amount: $${amount.toFixed(2)} USDC
🔗 TX: ${txHash.substring(0, 16)}...

Funds will arrive in ~5 minutes.

*0.* ← Main Menu`,

    // ============ WEB LOGIN ============
    webLogin: () => `🌐 *Web Dashboard*

Visit our website to connect your wallet and trade on the professional terminal:

🔗 https://opoll.app

*0.* ← Main Menu`,

    // ============ ERRORS ============
    invalidInput: `❌ Invalid input. Please try again.`,

    error: `❌ Something went wrong. Please try again.

Reply *menu* to start over.`,

    insufficientBalance: (required: number, available: string) =>
        `❌ *Insufficient Balance*

Required: $${required.toFixed(2)}
Available: $${available}

*1.* 💰 Deposit
*0.* ← Back`,
};
