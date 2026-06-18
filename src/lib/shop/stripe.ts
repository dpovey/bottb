/**
 * Server-only Stripe client factory for the merch shop.
 *
 * Lazily instantiates a single Stripe client so we don't read the secret key
 * (or construct the client) until the shop is actually used.
 */

import Stripe from 'stripe'
import { env } from '@/lib/env'

let _stripe: Stripe | null = null

/**
 * Returns the shared Stripe client. Throws if `STRIPE_SECRET_KEY` is not
 * configured, so callers can surface a clear error instead of a vague failure
 * deep inside the SDK.
 */
export function getStripe(): Stripe {
  const secretKey = env.server.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set — the merch shop is not configured.'
    )
  }
  if (!_stripe) {
    _stripe = new Stripe(secretKey)
  }
  return _stripe
}
