/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * Sydney 2026 setlists as the bands sent them (28 Sep 2026), with titles and
 * artists canonicalised: artist is the version the band is covering, and
 * spellings match earlier setlists (e.g. "The Joker and the Thief") so the
 * title+artist conflict check lines up across events. Amakazaam!'s Alexa
 * segments are laptop audio between songs, not songs, so they are left out.
 */

/** @typedef {{ title: string, artist: string }} Ref */
/** @typedef {{ position: number, song_type: 'cover'|'mashup'|'medley'|'transition', title: string, artist: string, additional_songs?: Ref[], transition_to?: Ref }} Song */

/** @type {Record<string, Song[]>} */
const SETLISTS = {
  'bandlassian-sydney-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'good 4 u',
      artist: 'Olivia Rodrigo',
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'Still into You',
      artist: 'Paramore',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Life Is a Highway',
      artist: 'Rascal Flatts',
    },
    {
      position: 4,
      song_type: 'cover',
      title: "I'm a Believer",
      artist: 'Smash Mouth',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'Pokémon Theme',
      artist: 'Jason Paige',
    },
  ],
  'canvanauts-sydney-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'The Joker and the Thief',
      artist: 'Wolfmother',
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'Thnks fr th Mmrs',
      artist: 'Fall Out Boy',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'So Easy (To Fall in Love)',
      artist: 'Olivia Dean',
    },
    { position: 4, song_type: 'cover', title: "Beggin'", artist: 'Måneskin' },
    {
      position: 5,
      song_type: 'cover',
      title: 'Smooth Criminal',
      artist: 'Alien Ant Farm',
    },
    {
      position: 6,
      song_type: 'cover',
      title: 'Welcome to the Black Parade',
      artist: 'My Chemical Romance',
    },
  ],
  'amakazaam-sydney-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'Valerie',
      artist: 'Amy Winehouse',
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'Superstition',
      artist: 'Stevie Wonder',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Under Pressure',
      artist: 'Queen & David Bowie',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'Are You Gonna Go My Way',
      artist: 'Lenny Kravitz',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'You Oughta Know',
      artist: 'Alanis Morissette',
    },
    {
      position: 6,
      song_type: 'cover',
      title: 'Killing in the Name',
      artist: 'Rage Against the Machine',
    },
  ],
  'v2-voyagers-sydney-2026': [
    { position: 1, song_type: 'cover', title: 'Venus', artist: 'Bananarama' },
    {
      position: 2,
      song_type: 'cover',
      title: 'Cosmic Girl',
      artist: 'Jamiroquai',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Drops of Jupiter',
      artist: 'Train',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'All Star',
      artist: 'Smash Mouth',
    },
    {
      position: 5,
      song_type: 'medley',
      title: 'Starships',
      artist: 'Nicki Minaj',
      additional_songs: [{ title: 'UFO', artist: 'Sneaky Sound System' }],
    },
  ],
  'shiprex-sydney-2026': [
    {
      position: 1,
      song_type: 'transition',
      title: 'Careless Whisper',
      artist: 'George Michael',
      transition_to: { title: 'Uprising', artist: 'Muse' },
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Dumb Things',
      artist: 'Paul Kelly',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'Mustang Sally',
      artist: 'Wilson Pickett',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'Everlong',
      artist: 'Foo Fighters',
    },
    {
      position: 6,
      song_type: 'cover',
      title: 'Covered in Chrome',
      artist: 'Violent Soho',
    },
  ],
}

const esc = (s) => s.replace(/'/g, "''")
const str = (s) => (s ? `'${esc(s)}'` : 'NULL')

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  for (const [bandId, songs] of Object.entries(SETLISTS)) {
    for (const song of songs) {
      const additional = JSON.stringify(song.additional_songs || [])
      pgm.sql(
        `INSERT INTO setlist_songs (band_id, position, song_type, title, artist, additional_songs, transition_to_title, transition_to_artist, status)
         VALUES ('${bandId}', ${song.position}, '${song.song_type}', '${esc(song.title)}', '${esc(song.artist)}', '${esc(additional)}'::jsonb, ${str(song.transition_to?.title)}, ${str(song.transition_to?.artist)}, 'pending')`
      )
    }
  }
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  for (const bandId of Object.keys(SETLISTS)) {
    pgm.sql(`DELETE FROM setlist_songs WHERE band_id = '${bandId}'`)
  }
}
