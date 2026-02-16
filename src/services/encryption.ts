import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Use a consistent encryption key from environment or generate a default one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '1ef5d56bb056a08019ea2f34e6540211eacfd3fff109bcf98d483da21db2b3c5';
const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

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


