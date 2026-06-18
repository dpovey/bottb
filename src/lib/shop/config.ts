/**
 * Merch shop configuration.
 *
 * Pure constants only — safe to import from both client and server components.
 * No secrets here (Stripe keys live in `@/lib/env`, server client in
 * `@/lib/shop/stripe`).
 */

/** Stripe expects lowercase ISO currency codes. */
export const SHOP_CURRENCY = 'aud'

/** Per-unit price for a single shirt, in cents (A$40.00). */
export const TSHIRT_UNIT_PRICE_CENTS = 4000

/** Discounted per-unit price when buying TSHIRT_BULK_MIN_QTY or more (A$35.00 each). */
export const TSHIRT_BULK_UNIT_PRICE_CENTS = 3500

/** Quantity at which the bulk per-unit price applies ("$35 each for two or more"). */
export const TSHIRT_BULK_MIN_QTY = 2

/** Flat shipping within Australia, in cents (A$10.00). */
export const SHIPPING_CENTS = 1000

/**
 * Per-unit price (in cents) for a given quantity. Volume discount: full price
 * for a single shirt, the bulk price each once you reach TSHIRT_BULK_MIN_QTY.
 * This is the single source of truth — the checkout charges this exact amount
 * via Stripe `price_data`, so the displayed price can never drift from it.
 */
export function unitPriceCents(quantity: number): number {
  return quantity >= TSHIRT_BULK_MIN_QTY
    ? TSHIRT_BULK_UNIT_PRICE_CENTS
    : TSHIRT_UNIT_PRICE_CENTS
}

/** Max units per checkout — a soft guard against fat-finger / abuse. */
export const MAX_QUANTITY = 10

/** Available t-shirt sizes, in display order. */
export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const
export type TShirtSize = (typeof TSHIRT_SIZES)[number]

export function isValidSize(value: unknown): value is TShirtSize {
  return (
    typeof value === 'string' &&
    (TSHIRT_SIZES as readonly string[]).includes(value)
  )
}

/** Where fulfillment notifications are sent. */
export const FULFILLMENT_EMAIL = 'info@bottb.com'

/**
 * Seller identity printed on the invoice. BOTB Events Ltd is not registered
 * for GST, so invoices are titled "Invoice" (not "Tax Invoice") and carry no
 * GST line — see `gstRegistered`.
 */
export const SELLER = {
  name: 'BOTB Events Ltd',
  abn: '19 691 201 153',
  gstRegistered: false,
  contactEmail: 'info@bottb.com',
} as const

/** The single product the shop currently sells. */
export const TSHIRT = {
  id: 'tshirt-2026',
  name: '2026 Battle of the Tech Bands T-Shirt',
  tagline: 'Brisbane · Sydney · Melbourne · 2026',
  description:
    'Official 2026 tour tee. Heavyweight black cotton with a monochrome rock-poster print — small front logo, full back artwork.',
  priceCents: TSHIRT_UNIT_PRICE_CENTS,
  images: [
    {
      src: '/images/shop/2026-tshirt.jpg',
      alt: '2026 Battle of the Tech Bands t-shirt, front and back',
      width: 1137,
      height: 1383,
    },
    {
      src: '/images/shop/2026-tshirt-back.jpg',
      alt: '2026 Battle of the Tech Bands t-shirt back print artwork',
      width: 1084,
      height: 1536,
    },
  ],
} as const
