/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Add cover_artist to setlist_songs.
 *
 * Distinguishes the specific version/arrangement a band performs from the song's
 * canonical artist. `artist` stays the canonical artist (and remains the key for
 * conflict detection); `cover_artist` records whose rendition is being played
 * when it differs — e.g. "Espresso" by Sabrina Carpenter, performed as the Good
 * Neighbours version. Nullable and additive; conflict logic is unchanged.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('setlist_songs', {
    cover_artist: { type: 'varchar(255)' },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('setlist_songs', 'cover_artist')
}
