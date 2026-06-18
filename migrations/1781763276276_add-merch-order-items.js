/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Support multiple sizes in one merch order.
 *
 * `items` holds the per-size breakdown, e.g. [{"size":"M","quantity":1},
 * {"size":"L","quantity":2}]. `quantity` stays the total; `size` becomes a
 * convenience summary (single size, or NULL when an order mixes sizes), so it
 * must allow NULL now.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('merch_orders', {
    items: { type: 'jsonb', notNull: true, default: '[]' },
  })
  pgm.alterColumn('merch_orders', 'size', { notNull: false })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Multi-size orders store NULL `size`; back-fill from the first item (lossy)
  // so the NOT NULL constraint can be restored without failing.
  pgm.sql(
    `UPDATE merch_orders SET size = COALESCE(size, items->0->>'size', 'NA') WHERE size IS NULL`
  )
  pgm.dropColumn('merch_orders', 'items')
  pgm.alterColumn('merch_orders', 'size', { notNull: true })
}
