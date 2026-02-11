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

/**
 * @route POST /api/auth/google
 * @desc Login or Register with Google
 * @access Public
 */
import { loginWithGoogle } from '../controllers/authController';
router.post('/google', loginWithGoogle);

export default router;
