import { Request, Response, NextFunction } from 'express';

/**
 * Auth middleware for sensitive backend routes.
 * 
 * Accepts either:
 *   1. Authorization: Bearer <JWT_SECRET>  (for frontend API calls)
 *   2. x-admin-secret: <ADMIN_SECRET>      (for admin operations)
 *
 * Set JWT_SECRET and ADMIN_SECRET in your environment variables.
 */
export const verifyAuth = (req: Request, res: Response, next: NextFunction): void => {
    // Allow admin secret (server-to-server or admin dashboard calls)
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
        return next();
    }

    // Allow Bearer token (frontend calls after login)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const validToken = process.env.JWT_SECRET;

        // Simple shared-secret check (if using JWTs, use jsonwebtoken.verify instead)
        if (token && validToken && token === validToken) {
            return next();
        }

        // JWT verification approach (for Privy/NextAuth JWTs)
        try {
            const jwt = require('jsonwebtoken');
            jwt.verify(token, process.env.JWT_SECRET);
            return next();
        } catch {
            // Token invalid or expired
        }
    }

    res.status(401).json({ success: false, error: 'Unauthorized. Valid Bearer token or admin secret required.' });
};
