/**
 * Utilities for handling Meta (Facebook/Instagram/Threads) webhooks
 *
 * Meta sends webhook requests with a signed_request parameter that contains
 * a base64url-encoded signature and payload. We verify the signature using
 * HMAC-SHA256 with the app secret to ensure the request is from Meta.
 */

import crypto from 'crypto'

export interface SignedRequestPayload {
  user_id: string
  algorithm?: string
  issued_at?: number
}

/**
 * Parse and verify a signed_request from Meta
 *
 * The signed_request is a base64url-encoded string in the format:
 * <signature>.<payload>
 *
 * We verify the signature using HMAC-SHA256 with the app secret.
 *
 * @param signedRequest - The signed_request string from Meta
 * @param appSecret - The app secret to verify the signature
 * @returns The decoded payload if valid, null if invalid
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): SignedRequestPayload | null {
  try {
    const parts = signedRequest.split('.')
    if (parts.length !== 2) {
      console.error(
        '[Meta Webhook] Invalid signed_request format: expected 2 parts'
      )
      return null
    }

    const [encodedSig, encodedPayload] = parts

    // Decode the signature (base64url to buffer)
    const sig = Buffer.from(
      encodedSig.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    )

    // Decode the payload (base64url to JSON)
    const payloadJson = Buffer.from(
      encodedPayload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8')

    const data = JSON.parse(payloadJson) as SignedRequestPayload

    // Verify the signature using HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest()

    // Use timing-safe comparison to prevent timing attacks
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(sig, expectedSig)
    ) {
      console.error('[Meta Webhook] Invalid signature')
      return null
    }

    return data
  } catch (error) {
    console.error('[Meta Webhook] Failed to parse signed_request:', error)
    return null
  }
}

/**
 * Create a signed_request for testing purposes
 *
 * This is useful for creating test payloads that can be verified.
 */
export function createSignedRequest(
  payload: SignedRequestPayload,
  appSecret: string
): string {
  // Encode payload as base64url
  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Create signature
  const sig = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${sig}.${encodedPayload}`
}
