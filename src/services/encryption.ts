import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// ENCRYPTION_KEY must be a 64-char hex string (32 bytes) set in environment variables.
// NEVER commit this value to source control. Rotate it immediately if exposed.
const encryptEnv = process.env.ENCRYPTION_KEY;
if (!encryptEnv) {
    throw new Error('[EncryptionService] FATAL: ENCRYPTION_KEY environment variable is not set. Server cannot start safely.');
}

const KEY = Buffer.from(encryptEnv, 'hex');
if (KEY.length !== 32) {
    throw new Error(`[EncryptionService] FATAL: ENCRYPTION_KEY produces invalid key length (${KEY.length} bytes, expected 32). Provide a 64-character hex string.`);
}

export class EncryptionService {
    /**
     * Encrypt sensitive data (like private keys)
     */
    static encrypt(text: string): string {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            // Return: iv:authTag:encrypted
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    static decrypt(encryptedData: string): string {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const [ivHex, authTagHex, encrypted] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');

            const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error: any) {
            console.error('[EncryptionService] Decryption failed:', error.message);
            // Log key details safely (length only)
            console.error(`[EncryptionService] Key length: ${KEY.length} bytes`);
            console.error(`[EncryptionService] Encrypted data format valid: ${encryptedData.split(':').length === 3}`);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
}


