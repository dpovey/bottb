/**
 * Migration: Add descriptions and artist_metadata table
 *
 * Adds:
 * - description column to companies table
 * - description column to events table
 * - artist_description column to setlist_songs table
 * - spotify_track_id column to setlist_songs table
 * - artist_metadata table for caching MusicBrainz data
 */

exports.up = (pgm) => {
  // Add description to companies
  pgm.addColumn('companies', {
    description: { type: 'text' },
  })

  // Add description to events
  pgm.addColumn('events', {
    description: { type: 'text' },
  })

  // Add artist_description and spotify_track_id to setlist_songs
  pgm.addColumn('setlist_songs', {
    artist_description: { type: 'text' },
    spotify_track_id: { type: 'varchar(50)' },
  })

  // Create artist_metadata table
  pgm.createTable('artist_metadata', {
    artist_name_normalized: {
      type: 'varchar(255)',
      primaryKey: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    musicbrainz_id: { type: 'varchar(36)' },
    formed_year: { type: 'integer' },
    country: { type: 'varchar(100)' },
    genres: { type: 'text[]' },
    description: { type: 'text' },
    spotify_artist_id: { type: 'varchar(50)' },
    first_performed_at: { type: 'varchar(255)' }, // Event ID where first performed
    total_performances: {
      type: 'integer',
      default: 0,
    },
    fetched_at: { type: 'timestamp with time zone' },
    created_at: {
      type: 'timestamp with time zone',
      default: pgm.func('now()'),
    },
  })

  // Add indexes for artist_metadata
  pgm.createIndex('artist_metadata', 'display_name')
  pgm.createIndex('artist_metadata', 'musicbrainz_id', {
    where: 'musicbrainz_id IS NOT NULL',
  })
  pgm.createIndex('artist_metadata', 'spotify_artist_id', {
    where: 'spotify_artist_id IS NOT NULL',
  })

  // Add index for spotify_track_id lookups
  pgm.createIndex('setlist_songs', 'spotify_track_id', {
    where: 'spotify_track_id IS NOT NULL',
  })
}

exports.down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('setlist_songs', 'spotify_track_id')
  pgm.dropIndex('artist_metadata', 'spotify_artist_id')
  pgm.dropIndex('artist_metadata', 'musicbrainz_id')
  pgm.dropIndex('artist_metadata', 'display_name')

  // Drop artist_metadata table
  pgm.dropTable('artist_metadata')

  // Remove columns from setlist_songs
  pgm.dropColumn('setlist_songs', ['artist_description', 'spotify_track_id'])

  // Remove description from events
  pgm.dropColumn('events', 'description')

  // Remove description from companies
  pgm.dropColumn('companies', 'description')
}
