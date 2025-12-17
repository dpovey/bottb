/**
 * Token encryption utilities for social media OAuth tokens.
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Tokens are stored as base64-encoded strings containing:
 * - 12-byte IV
 * - 16-byte auth tag
 * - Encrypted ciphertext
 *
 * Environment variable required:
 * - SOCIAL_TOKEN_ENCRYPTION_KEY: 32-byte hex-encoded key (64 hex chars)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is required. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
        `Got ${keyHex.length} characters.`
    );
  }

  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a token for storage.
 *
 * @param plaintext - The token to encrypt
 * @returns Base64-encoded encrypted token (IV + authTag + ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: IV (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a stored token.
 *
 * @param encryptedBase64 - Base64-encoded encrypted token
 * @returns The decrypted token
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptToken(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted token: too short");
  }

  // Extract: IV (12) + authTag (16) + ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if encryption is properly configured.
 * Useful for startup checks or health endpoints.
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new encryption key (for setup).
 * Returns a 64-character hex string suitable for SOCIAL_TOKEN_ENCRYPTION_KEY.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

