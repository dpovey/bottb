/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Merchandise orders for the shop (currently the 2026 t-shirt).
 *
 * One row per paid Stripe Checkout Session. `stripe_session_id` is unique so
 * the webhook can upsert idempotently (Stripe may deliver the same event more
 * than once). Money is stored in cents to match Stripe. The shipping address
 * is captured as JSON exactly as Stripe collected it.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('merch_orders', {
    id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    stripe_session_id: { type: 'varchar(255)', notNull: true },
    stripe_payment_intent_id: { type: 'varchar(255)' },
    product: { type: 'varchar(64)', notNull: true },
    size: { type: 'varchar(8)', notNull: true },
    quantity: { type: 'integer', notNull: true },
    // All amounts in cents.
    amount_subtotal: { type: 'integer', notNull: true },
    amount_shipping: { type: 'integer', notNull: true, default: 0 },
    amount_total: { type: 'integer', notNull: true },
    currency: { type: 'varchar(8)', notNull: true, default: 'aud' },
    customer_name: { type: 'varchar(255)' },
    customer_email: { type: 'varchar(255)' },
    customer_phone: { type: 'varchar(64)' },
    // { line1, line2, city, state, postal_code, country }
    shipping_address: { type: 'jsonb' },
    // paid | fulfilled | refunded | cancelled
    status: { type: 'varchar(20)', notNull: true, default: 'paid' },
    fulfillment_emailed_at: { type: 'timestamptz' },
    invoice_emailed_at: { type: 'timestamptz' },
    fulfilled_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  })

  // Idempotency key for the webhook upsert.
  pgm.addConstraint('merch_orders', 'merch_orders_stripe_session_id_unique', {
    unique: ['stripe_session_id'],
  })

  // Admin list orders newest-first / filters by status.
  pgm.createIndex('merch_orders', ['status', 'created_at'], {
    name: 'idx_merch_orders_status_created',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('merch_orders')
}
