/**
 * WhatsApp Notification Service
 * Sends notifications to users via WhatsApp when deposits are credited
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3002';

/**
 * Send deposit confirmation to user via WhatsApp
 */
export async function sendDepositNotification(
    phoneNumber: string,
    amount: string,
    txHash: string
): Promise<void> {
    const message = `🎉 *Deposit Confirmed!*

💰 *$${amount} USDC* has been credited to your account.

🔗 TX: ${txHash.substring(0, 16)}...

Your new balance is ready to trade!

Type */markets* to start trading.`;

    try {
        // In production, send via WhatsApp Business API or whatsapp-web.js
        console.log(`📱 Sending WhatsApp notification to ${phoneNumber}:`);
        console.log(message);

        // If you have a WhatsApp notification endpoint:
        // await axios.post(`${WHATSAPP_API_URL}/notify`, {
        //     phoneNumber,
        //     message
        // });
    } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
    }
}

/**
 * Send withdrawal confirmation to user via WhatsApp
 */
export async function sendWithdrawNotification(
    phoneNumber: string,
    amount: string,
    toAddress: string,
    txHash: string
): Promise<void> {
    const message = `✅ *Withdrawal Sent!*

💸 *$${amount} USDC* is on its way.

📭 To: ${toAddress.substring(0, 10)}...${toAddress.substring(38)}
🔗 TX: ${txHash.substring(0, 16)}...

Funds will arrive in ~1-5 minutes.`;

    try {
        console.log(`📱 Sending WhatsApp notification to ${phoneNumber}:`);
        console.log(message);
    } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
    }
}

/**
 * Send bet confirmation to user via WhatsApp
 */
export async function sendBetNotification(
    phoneNumber: string,
    marketQuestion: string,
    side: 'YES' | 'NO',
    shares: number,
    cost: string
): Promise<void> {
    const message = `🎰 *Bet Placed!*

📊 ${marketQuestion}
${side === 'YES' ? '✅' : '❌'} *${shares} ${side}* shares
💵 Cost: $${cost}

Good luck! 🍀

Type */portfolio* to view your positions.`;

    try {
        console.log(`📱 Sending WhatsApp notification to ${phoneNumber}:`);
        console.log(message);
    } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
    }
}
