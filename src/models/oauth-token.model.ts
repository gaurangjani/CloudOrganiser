// MongoDB model for storing OAuth access and refresh tokens securely.
// Tokens are AES-256-GCM encrypted at rest using TOKEN_ENCRYPTION_KEY.
import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  // Accept a hex-encoded 32-byte key or derive one via SHA-256
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptToken(plaintext: string): string {
  const keyBuf = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(encoded: string): string {
  const keyBuf = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export interface OAuthTokenDocument extends Document {
  userId: string;
  provider: 'google' | 'microsoft';
  /** AES-256-GCM encrypted access token */
  encryptedAccessToken: string;
  /** AES-256-GCM encrypted refresh token (optional) */
  encryptedRefreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OAuthTokenSchema = new Schema<OAuthTokenDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['google', 'microsoft'],
    },
    encryptedAccessToken: {
      type: String,
      required: true,
    },
    encryptedRefreshToken: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
    scope: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'oauth_tokens',
  }
);

// Compound unique index: one token record per (userId, provider)
OAuthTokenSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const OAuthTokenModel = mongoose.model<OAuthTokenDocument>(
  'OAuthToken',
  OAuthTokenSchema
);
