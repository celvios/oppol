import express from 'express';
import { generateMagicLink, verifyMagicToken } from '../controllers/authController';

const router = express.Router();

/**
 * @route POST /api/auth/magic-link
 * @desc Generate magic link for phone number
 * @access Public
 */
router.post('/magic-link', generateMagicLink);

/**
 * @route POST /api/auth/verify
 * @desc Verify magic link token
 * @access Public
 */
router.post('/verify', verifyMagicToken);

export default router;
