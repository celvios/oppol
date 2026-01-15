import { Message } from 'whatsapp-web.js';
import { apiClient } from './api';
import { BotState, getSession, updateSession, resetSession } from './session';
import { messages } from './messages';
import { logger } from './logger';
import { Validators } from './validators';
import { handleError, ErrorMessages } from './errors';
import { RateLimiter } from './rateLimit';

export class CommandHandler {
    /**
     * Main message handler - routes based on user state
     */
    async handleMessage(message: Message): Promise<string> {
        const text = message.body.trim().toLowerCase();
        const phoneNumber = message.from.replace('@c.us', '');
        
        // Rate limiting
        const allowed = await RateLimiter.checkLimit(phoneNumber, 'message');
        if (!allowed) {
            logger.warn('Rate limit exceeded', { phone: phoneNumber });
            return ErrorMessages.RATE_LIMITED;
        }
        
        const session = await getSession(phoneNumber);
        logger.info('Message received', { phone: phoneNumber, state: session.state, input: text });

        // Global commands (work from any state)
        if (text === 'menu' || text === 'start' || text === '/menu' || text === '/start') {
            await resetSession(phoneNumber);
            return messages.mainMenu;
        }

        if (text === 'help' || text === '/help') {
            return messages.mainMenu;
        }

        // State-based routing
        try {
            switch (session.state) {
                case BotState.IDLE:
                    return await this.handleIdle(phoneNumber);

                case BotState.MAIN_MENU:
                    return await this.handleMainMenu(phoneNumber, text);

                case BotState.MARKETS_LIST:
                    return await this.handleMarketsList(phoneNumber, text);

                case BotState.MARKET_DETAIL:
                    return await this.handleMarketDetail(phoneNumber, text);

                case BotState.BET_AMOUNT:
                    return await this.handleBetAmount(phoneNumber, text);

                case BotState.BET_CONFIRM:
                    return await this.handleBetConfirm(phoneNumber, text);

                case BotState.PROFILE:
                    return await this.handleProfile(phoneNumber, text);

                case BotState.DEPOSIT:
                    return await this.handleDeposit(phoneNumber, text);

                case BotState.WITHDRAW_AMOUNT:
                    return await this.handleWithdrawAmount(phoneNumber, text);

                case BotState.WITHDRAW_ADDRESS:
                    return await this.handleWithdrawAddress(phoneNumber, text);

                case BotState.WITHDRAW_CONFIRM:
                    return await this.handleWithdrawConfirm(phoneNumber, text);

                default:
                    return await this.handleIdle(phoneNumber);
            }
        } catch (error) {
            logger.error('Error handling message', { phone: phoneNumber, error });
            return handleError(error);
        }
    }

    // ============ STATE HANDLERS ============

    private async handleIdle(phoneNumber: string): Promise<string> {
        await updateSession(phoneNumber, { state: BotState.MAIN_MENU });
        return messages.welcome + '\n\n' + messages.mainMenu;
    }

    private async handleMainMenu(phoneNumber: string, input: string): Promise<string> {
        switch (input) {
            case '1':
            case 'markets':
                updateSession(phoneNumber, { state: BotState.MARKETS_LIST });
                return await this.buildMarketsMessage();

            case '2':
            case 'profile':
                updateSession(phoneNumber, { state: BotState.PROFILE });
                return await this.buildProfileMessage(phoneNumber);

            case '3':
            case 'deposit':
                updateSession(phoneNumber, { state: BotState.DEPOSIT });
                return await this.buildDepositMessage(phoneNumber);

            case '4':
            case 'withdraw':
                updateSession(phoneNumber, { state: BotState.WITHDRAW_AMOUNT });
                const balance = await this.getBalance(phoneNumber);
                return messages.withdrawAmount(balance);

            case '5':
            case 'web':
            case 'login':
                const link = await apiClient.generateMagicLink(phoneNumber);
                updateSession(phoneNumber, { state: BotState.MAIN_MENU });
                return messages.webLogin(link);

            default:
                return messages.invalidInput + '\n\n' + messages.mainMenu;
        }
    }

    private async handleMarketsList(phoneNumber: string, input: string): Promise<string> {
        if (input === '0' || input === 'back') {
            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.mainMenu;
        }

        const marketId = parseInt(input) - 1; // User sees 1-based, we use 0-based
        if (isNaN(marketId) || marketId < 0) {
            return messages.invalidInput + '\n\n' + await this.buildMarketsMessage();
        }

        try {
            const market = await apiClient.getMarket(marketId);
            if (!market) {
                return messages.invalidInput + '\n\n' + await this.buildMarketsMessage();
            }

            updateSession(phoneNumber, {
                state: BotState.MARKET_DETAIL,
                selectedMarketId: marketId
            });

            return messages.marketDetail(
                market.question,
                market.yesOdds,
                100 - market.yesOdds,
                market.volume,
                new Date(market.endTime * 1000).toLocaleDateString(),
                0, 0 // TODO: Get user positions
            );
        } catch (error) {
            console.error('Error fetching market:', error);
            return messages.error;
        }
    }

    private async handleMarketDetail(phoneNumber: string, input: string): Promise<string> {
        const session = getSession(phoneNumber);

        if (input === '0' || input === 'back') {
            updateSession(phoneNumber, { state: BotState.MARKETS_LIST });
            return await this.buildMarketsMessage();
        }

        if (input === '1' || input === 'yes') {
            updateSession(phoneNumber, {
                state: BotState.BET_AMOUNT,
                betSide: 'YES'
            });
            const market = await apiClient.getMarket(session.selectedMarketId!);
            const balance = await this.getBalance(phoneNumber);
            return messages.betAmount('YES', market.question, balance);
        }

        if (input === '2' || input === 'no') {
            updateSession(phoneNumber, {
                state: BotState.BET_AMOUNT,
                betSide: 'NO'
            });
            const market = await apiClient.getMarket(session.selectedMarketId!);
            const balance = await this.getBalance(phoneNumber);
            return messages.betAmount('NO', market.question, balance);
        }

        return messages.invalidInput;
    }

    private async handleBetAmount(phoneNumber: string, input: string): Promise<string> {
        const session = await getSession(phoneNumber);

        if (input === '0' || input === 'cancel' || input === 'back') {
            await updateSession(phoneNumber, { state: BotState.MARKET_DETAIL });
            const market = await apiClient.getMarket(session.selectedMarketId!);
            return messages.marketDetail(
                market.question,
                market.yesOdds,
                100 - market.yesOdds,
                market.volume,
                new Date(market.endTime * 1000).toLocaleDateString(),
                0, 0
            );
        }

        // Validate amount
        const amount = Validators.validateAmount(input);

        // Check balance
        const balance = await this.getBalance(phoneNumber);
        if (amount > parseFloat(balance)) {
            return messages.insufficientBalance(amount, balance);
        }

        // Calculate shares
        const market = await apiClient.getMarket(session.selectedMarketId!);
        const price = session.betSide === 'YES' ? market.yesOdds / 100 : (100 - market.yesOdds) / 100;
        const estimatedShares = Math.floor(amount / price);

        await updateSession(phoneNumber, {
            state: BotState.BET_CONFIRM,
            betAmount: amount
        });

        return messages.betConfirm(
            market.question,
            session.betSide!,
            amount,
            estimatedShares,
            price
        );
    }

    private async handleBetConfirm(phoneNumber: string, input: string): Promise<string> {
        const session = await getSession(phoneNumber);

        if (input === '0' || input === 'cancel' || input === 'back') {
            await updateSession(phoneNumber, { state: BotState.BET_AMOUNT });
            const market = await apiClient.getMarket(session.selectedMarketId!);
            const balance = await this.getBalance(phoneNumber);
            return messages.betAmount(session.betSide!, market.question, balance);
        }

        if (input === '1' || input === 'confirm' || input === 'yes') {
            // Rate limit bets
            const allowed = await RateLimiter.checkLimit(phoneNumber, 'bet');
            if (!allowed) {
                logger.warn('Bet rate limit exceeded', { phone: phoneNumber });
                return ErrorMessages.RATE_LIMITED + '\n\nYou can place up to 5 bets per minute.';
            }
            
            try {
                logger.info('Placing bet', { 
                    phone: phoneNumber, 
                    marketId: session.selectedMarketId, 
                    side: session.betSide, 
                    amount: session.betAmount 
                });
                
                const result = await apiClient.placeBet(
                    phoneNumber,
                    session.selectedMarketId!,
                    session.betSide === 'YES',
                    session.betAmount!
                );

                logger.info('Bet placed successfully', { 
                    phone: phoneNumber, 
                    txHash: result.hash 
                });
                
                await updateSession(phoneNumber, { state: BotState.MAIN_MENU });
                return messages.betSuccess(
                    session.betSide!,
                    result.shares,
                    session.betAmount!,
                    result.newPrice || 50
                );
            } catch (error: any) {
                logger.error('Bet failed', { phone: phoneNumber, error: error.message });
                await updateSession(phoneNumber, { state: BotState.MAIN_MENU });
                return handleError(error);
            }
        }

        return messages.invalidInput;
    }

    private async handleProfile(phoneNumber: string, input: string): Promise<string> {
        switch (input) {
            case '0':
            case 'back':
            case 'menu':
                updateSession(phoneNumber, { state: BotState.MAIN_MENU });
                return messages.mainMenu;

            case '1':
            case 'markets':
                updateSession(phoneNumber, { state: BotState.MARKETS_LIST });
                return await this.buildMarketsMessage();

            case '2':
            case 'deposit':
                updateSession(phoneNumber, { state: BotState.DEPOSIT });
                return await this.buildDepositMessage(phoneNumber);

            case '3':
            case 'withdraw':
                updateSession(phoneNumber, { state: BotState.WITHDRAW_AMOUNT });
                const balance = await this.getBalance(phoneNumber);
                return messages.withdrawAmount(balance);

            default:
                return messages.invalidInput + '\n\n' + await this.buildProfileMessage(phoneNumber);
        }
    }

    private handleDeposit(phoneNumber: string, input: string): string {
        if (input === '0' || input === 'back' || input === 'menu') {
            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.mainMenu;
        }
        updateSession(phoneNumber, { state: BotState.MAIN_MENU });
        return messages.mainMenu;
    }

    private async handleWithdrawAmount(phoneNumber: string, input: string): Promise<string> {
        if (input === '0' || input === 'cancel' || input === 'back') {
            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.mainMenu;
        }

        const amount = parseFloat(input.replace('$', '').replace(',', ''));
        if (isNaN(amount) || amount <= 0) {
            const balance = await this.getBalance(phoneNumber);
            return messages.invalidInput + '\n\n' + messages.withdrawAmount(balance);
        }

        const balance = await this.getBalance(phoneNumber);
        if (amount > parseFloat(balance)) {
            return messages.insufficientBalance(amount, balance);
        }

        updateSession(phoneNumber, {
            state: BotState.WITHDRAW_ADDRESS,
            withdrawAmount: amount
        });

        return messages.withdrawAddress(amount);
    }

    private handleWithdrawAddress(phoneNumber: string, input: string): string {
        const session = getSession(phoneNumber);

        if (input === '0' || input === 'cancel' || input === 'back') {
            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.mainMenu;
        }

        // Validate address (basic check)
        if (!input.startsWith('0x') || input.length !== 42) {
            return messages.invalidInput + '\n\n' + messages.withdrawAddress(session.withdrawAmount!);
        }

        updateSession(phoneNumber, {
            state: BotState.WITHDRAW_CONFIRM,
            withdrawAddress: input
        });

        return messages.withdrawConfirm(session.withdrawAmount!, input);
    }

    private async handleWithdrawConfirm(phoneNumber: string, input: string): Promise<string> {
        const session = getSession(phoneNumber);

        if (input === '0' || input === 'cancel' || input === 'back') {
            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.mainMenu;
        }

        if (input === '1' || input === 'confirm' || input === 'yes') {
            // TODO: Implement actual withdrawal via backend
            const fakeTxHash = '0x' + Math.random().toString(16).substring(2, 66);

            updateSession(phoneNumber, { state: BotState.MAIN_MENU });
            return messages.withdrawSuccess(session.withdrawAmount!, fakeTxHash);
        }

        return messages.invalidInput;
    }

    // ============ HELPER METHODS ============

    private async buildMarketsMessage(): Promise<string> {
        try {
            const markets = await apiClient.getMarkets();

            let message = messages.marketsHeader;
            markets.forEach((m: any, index: number) => {
                message += messages.marketItem(
                    index + 1,
                    m.question.length > 35 ? m.question.substring(0, 35) + '...' : m.question,
                    Math.round(m.yesOdds),
                    m.volume || '0'
                );
            });
            message += messages.marketsFooter;

            return message;
        } catch (error) {
            console.error('Error building markets message:', error);
            return messages.error;
        }
    }

    private async buildProfileMessage(phoneNumber: string): Promise<string> {
        try {
            const balance = await this.getBalance(phoneNumber);
            const positions = await apiClient.getPositions(phoneNumber);

            // Calculate total PnL
            let totalPnL = 0;
            const formattedPositions = positions.slice(0, 5).map(p => {
                const pnl = (p.currentValue - p.costBasis);
                totalPnL += pnl;
                return {
                    market: p.marketQuestion,
                    side: p.side,
                    shares: p.shares,
                    pnl: pnl.toFixed(2)
                };
            });

            return messages.profile(
                balance,
                positions.length,
                totalPnL.toFixed(2),
                formattedPositions
            );
        } catch (error) {
            console.error('Error building profile:', error);
            return messages.error;
        }
    }

    private async buildDepositMessage(phoneNumber: string): Promise<string> {
        try {
            const address = await apiClient.getDepositAddress(phoneNumber);
            return messages.deposit(address);
        } catch (error) {
            console.error('Error building deposit message:', error);
            return messages.error;
        }
    }

    private async getBalance(phoneNumber: string): Promise<string> {
        try {
            return await apiClient.getBalance(phoneNumber);
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0.00';
        }
    }
}

export const commandHandler = new CommandHandler();
