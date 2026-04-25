/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    UPDATE events
    SET info = (info - 'tickets') || jsonb_build_object('ticket_url', info->>'tickets')
    WHERE info ? 'tickets' AND NOT info ? 'ticket_url'
  `)

  pgm.sql(`
    UPDATE events
    SET info = COALESCE(info, '{}'::jsonb) || jsonb_build_object(
      'ticket_url',
      'https://m.moshtix.com.au/v2/event/battle-of-the-tech-bands/194630'
    )
    WHERE id = 'melbourne-2026'
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    UPDATE events
    SET info = (info - 'ticket_url') || jsonb_build_object('tickets', info->>'ticket_url')
    WHERE info ? 'ticket_url' AND NOT info ? 'tickets'
  `)
}
