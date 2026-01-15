import { Request, Response } from 'express';
import { CustodialWalletService } from '../services/custodialWallet';
import { query } from '../config/database';

export class WhatsAppController {
    /**
     * Get or create WhatsApp user
     * POST /api/whatsapp/user
     */
    static async getOrCreateUser(req: Request, res: Response) {
        try {
            const { phone } = req.body;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            // Clean phone number (remove spaces, dashes, etc)
            const cleanPhone = phone.replace(/[^\d+]/g, '');

            // Get or create wallet
            const walletAddress = await CustodialWalletService.getOrCreateWallet(cleanPhone);

            // Check if this is a new user
            const result = await query(
                'SELECT created_at FROM whatsapp_users WHERE phone_number = $1',
                [cleanPhone]
            );

            const isNew = result.rows[0] && 
                         (Date.now() - new Date(result.rows[0].created_at).getTime()) < 60000; // Created in last minute

            res.json({
                success: true,
                walletAddress,
                isNew,
                phone: cleanPhone
            });
        } catch (error: any) {
            console.error('Error in getOrCreateUser:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get user by phone number
     * GET /api/whatsapp/user?phone=xxx
     */
    static async getUserByPhone(req: Request, res: Response) {
        try {
            const { phone } = req.query;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            const cleanPhone = (phone as string).replace(/[^\d+]/g, '');
            const walletAddress = await CustodialWalletService.getWalletAddress(cleanPhone);

            if (!walletAddress) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            res.json({
                success: true,
                walletAddress,
                phone: cleanPhone
            });
        } catch (error: any) {
            console.error('Error in getUserByPhone:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}
