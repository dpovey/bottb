/**
 * Tests for Meta webhook utilities
 */

import { describe, it, expect } from 'vitest'
import {
  parseSignedRequest,
  createSignedRequest,
  SignedRequestPayload,
} from '../meta-webhooks'

describe('Meta Webhooks', () => {
  const testAppSecret = 'test-app-secret-12345'

  describe('parseSignedRequest', () => {
    it('parses a valid signed request', () => {
      const payload: SignedRequestPayload = {
        user_id: '123456789',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890,
      }

      // Create a valid signed request
      const signedRequest = createSignedRequest(payload, testAppSecret)

      // Parse it back
      const result = parseSignedRequest(signedRequest, testAppSecret)

      expect(result).not.toBeNull()
      expect(result?.user_id).toBe('123456789')
      expect(result?.algorithm).toBe('HMAC-SHA256')
      expect(result?.issued_at).toBe(1234567890)
    })

    it('returns null for invalid signature', () => {
      const payload: SignedRequestPayload = {
        user_id: '123456789',
      }

      // Create with one secret
      const signedRequest = createSignedRequest(payload, testAppSecret)

      // Try to parse with different secret
      const result = parseSignedRequest(signedRequest, 'wrong-secret')

      expect(result).toBeNull()
    })

    it('returns null for malformed signed request (no dot separator)', () => {
      const result = parseSignedRequest('invalid-no-dot', testAppSecret)

      expect(result).toBeNull()
    })

    it('returns null for malformed signed request (too many parts)', () => {
      const result = parseSignedRequest('part1.part2.part3', testAppSecret)

      expect(result).toBeNull()
    })

    it('returns null for invalid base64 payload', () => {
      // Valid looking structure but invalid base64
      const result = parseSignedRequest('sig.!!!invalid!!!', testAppSecret)

      expect(result).toBeNull()
    })

    it('returns null for invalid JSON payload', () => {
      // Create a signed request with invalid JSON
      // Base64 of "not json" = "bm90IGpzb24="
      const invalidPayload = 'bm90IGpzb24'
      const result = parseSignedRequest(
        `fakesig.${invalidPayload}`,
        testAppSecret
      )

      expect(result).toBeNull()
    })

    it('handles payload with only user_id', () => {
      const payload: SignedRequestPayload = {
        user_id: '987654321',
      }

      const signedRequest = createSignedRequest(payload, testAppSecret)
      const result = parseSignedRequest(signedRequest, testAppSecret)

      expect(result).not.toBeNull()
      expect(result?.user_id).toBe('987654321')
      expect(result?.algorithm).toBeUndefined()
    })
  })

  describe('createSignedRequest', () => {
    it('creates a properly formatted signed request', () => {
      const payload: SignedRequestPayload = {
        user_id: '123',
      }

      const signedRequest = createSignedRequest(payload, testAppSecret)

      // Should have exactly one dot separator
      expect(signedRequest.split('.')).toHaveLength(2)

      // Should not contain padding characters
      expect(signedRequest).not.toContain('=')

      // Should be base64url (no + or /)
      expect(signedRequest).not.toMatch(/[+/]/)
    })

    it('creates verifiable signed requests', () => {
      const payload: SignedRequestPayload = {
        user_id: 'test-user',
        algorithm: 'HMAC-SHA256',
      }

      // Create and immediately verify - should always work
      const signedRequest = createSignedRequest(payload, testAppSecret)
      const result = parseSignedRequest(signedRequest, testAppSecret)

      expect(result).toEqual(payload)
    })
  })

  describe('round-trip verification', () => {
    it('handles various user_id formats', () => {
      const userIds = ['123456789', '0', '999999999999999999', 'abc-123-def']

      for (const userId of userIds) {
        const payload: SignedRequestPayload = { user_id: userId }
        const signedRequest = createSignedRequest(payload, testAppSecret)
        const result = parseSignedRequest(signedRequest, testAppSecret)

        expect(result?.user_id).toBe(userId)
      }
    })

    it('handles special characters in app secret', () => {
      const specialSecrets = [
        'secret-with-dashes',
        'secret_with_underscores',
        'SecretWithCaps123',
        'secret/with/slashes+and+plus',
      ]

      for (const secret of specialSecrets) {
        const payload: SignedRequestPayload = { user_id: 'test' }
        const signedRequest = createSignedRequest(payload, secret)
        const result = parseSignedRequest(signedRequest, secret)

        expect(result?.user_id).toBe('test')
      }
    })
  })
})
