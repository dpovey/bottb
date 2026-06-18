import { sql } from '../sql'
import type { MerchOrder, MerchShippingAddress } from '../db-types'

export interface NewMerchOrder {
  stripe_session_id: string
  stripe_payment_intent_id: string | null
  product: string
  size: string
  quantity: number
  amount_subtotal: number
  amount_shipping: number
  amount_total: number
  currency: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipping_address: MerchShippingAddress | null
}

/**
 * Insert a paid order, idempotently keyed on `stripe_session_id`.
 *
 * Returns `{ order, isNew }`. `isNew` is false when the session was already
 * recorded (Stripe can deliver the same webhook more than once), in which case
 * the existing row is returned unchanged.
 */
export async function insertMerchOrderIfNew(
  input: NewMerchOrder
): Promise<{ order: MerchOrder; isNew: boolean }> {
  const { rows } = await sql<MerchOrder>`
    INSERT INTO merch_orders (
      stripe_session_id, stripe_payment_intent_id, product, size, quantity,
      amount_subtotal, amount_shipping, amount_total, currency,
      customer_name, customer_email, customer_phone, shipping_address
    ) VALUES (
      ${input.stripe_session_id}, ${input.stripe_payment_intent_id},
      ${input.product}, ${input.size}, ${input.quantity},
      ${input.amount_subtotal}, ${input.amount_shipping}, ${input.amount_total},
      ${input.currency}, ${input.customer_name}, ${input.customer_email},
      ${input.customer_phone},
      ${input.shipping_address ? JSON.stringify(input.shipping_address) : null}
    )
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING *
  `
  if (rows[0]) return { order: rows[0], isNew: true }

  const existing = await getMerchOrderBySessionId(input.stripe_session_id)
  if (!existing) {
    // Should be unreachable: conflict implies a row exists.
    throw new Error(
      `merch_orders upsert conflict but no row found for session ${input.stripe_session_id}`
    )
  }
  return { order: existing, isNew: false }
}

export async function getMerchOrderBySessionId(
  sessionId: string
): Promise<MerchOrder | null> {
  const { rows } = await sql<MerchOrder>`
    SELECT * FROM merch_orders WHERE stripe_session_id = ${sessionId}
  `
  return rows[0] ?? null
}

export async function getMerchOrderById(
  id: string
): Promise<MerchOrder | null> {
  const { rows } = await sql<MerchOrder>`
    SELECT * FROM merch_orders WHERE id = ${id}
  `
  return rows[0] ?? null
}

export async function getMerchOrders(): Promise<MerchOrder[]> {
  const { rows } = await sql<MerchOrder>`
    SELECT * FROM merch_orders ORDER BY created_at DESC
  `
  return rows
}

export async function markFulfillmentEmailed(id: string): Promise<void> {
  await sql`UPDATE merch_orders SET fulfillment_emailed_at = now() WHERE id = ${id}`
}

export async function markInvoiceEmailed(id: string): Promise<void> {
  await sql`UPDATE merch_orders SET invoice_emailed_at = now() WHERE id = ${id}`
}

export async function markOrderFulfilled(
  id: string
): Promise<MerchOrder | null> {
  const { rows } = await sql<MerchOrder>`
    UPDATE merch_orders
    SET status = 'fulfilled', fulfilled_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}
