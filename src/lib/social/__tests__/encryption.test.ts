import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  isEncryptionConfigured,
  generateEncryptionKey,
} from "../encryption";

describe("Token Encryption", () => {
  const originalEnv = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    // Use a test key (32 bytes = 64 hex chars)
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    }
  });

  describe("encryptToken / decryptToken", () => {
    it("should encrypt and decrypt a token successfully", () => {
      const originalToken = "my-secret-oauth-token-12345";

      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it("should produce different ciphertext for same input (due to random IV)", () => {
      const token = "same-token";

      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptToken(encrypted1)).toBe(token);
      expect(decryptToken(encrypted2)).toBe(token);
    });

    it("should handle empty string", () => {
      const token = "";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe("");
    });

    it("should handle unicode characters", () => {
      const token = "token-with-unicode-🔐-αβγ-日本語";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it("should handle long tokens", () => {
      const token = "a".repeat(10000);
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it("should throw on tampered ciphertext", () => {
      const token = "my-token";
      const encrypted = encryptToken(token);

      // Tamper with the encrypted data
      const buffer = Buffer.from(encrypted, "base64");
      buffer[buffer.length - 1] ^= 0xff; // Flip bits in last byte
      const tampered = buffer.toString("base64");

      expect(() => decryptToken(tampered)).toThrow();
    });

    it("should throw on invalid base64", () => {
      expect(() => decryptToken("not-valid-base64!!!")).toThrow();
    });

    it("should throw on too-short ciphertext", () => {
      const shortData = Buffer.alloc(10).toString("base64"); // Less than IV + authTag
      expect(() => decryptToken(shortData)).toThrow("too short");
    });
  });

  describe("isEncryptionConfigured", () => {
    it("should return true when key is configured", () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("should return false when key is not configured", () => {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("should return false when key is wrong length", () => {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "tooshort";
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate a 64-character hex string", () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it("should generate a key that can be used for encryption", () => {
      const newKey = generateEncryptionKey();
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = newKey;

      const token = "test-token";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });
  });

  describe("error handling", () => {
    it("should throw helpful error when key is missing", () => {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken("token")).toThrow(
        "SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is required"
      );
    });

    it("should throw helpful error when key is wrong length", () => {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "tooshort";

      expect(() => encryptToken("token")).toThrow("must be 64 hex characters");
    });

    it("should include key length in error message", () => {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "abc123";

      expect(() => encryptToken("token")).toThrow("Got 6 characters");
    });
  });
});

