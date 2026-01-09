import { Request, Response } from 'express';
import { query } from '../config/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createWalletInternal } from './walletController';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Step 1: User (via Bot) requests a login link
// Magic Link generation removed
export const generateMagicLink = async (req: Request, res: Response) => {
    res.status(410).json({ error: 'Magic Link login is deprecated. Please use Wallet Connect.' });
};

// Step 2: User clicks link on Frontend -> Frontend calls this API
// Magic Link verification removed
export const verifyMagicToken = async (req: Request, res: Response) => {
    res.status(410).json({ error: 'Magic Link login is deprecated. Please use Wallet Connect.' });
};
