/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

const BAND_IDS = [
  'loop-there-it-is-melbourne-2026',
  'continuously-groovin-melbourne-2026',
  'fully-seek-melbourne-2026',
  'hot-property-melbourne-2026',
]

const DESCRIPTIONS = {
  'loop-there-it-is-melbourne-2026':
    "Loop There It Is, a Mentorloop x misfits band, can make 2 minute noodles in 1.5 minutes. We have veterans in love and outlaws in Peru. With 5 members, 7 instruments, 22 strings, and 88 keys, we're going to tell a story all about true love and what it can do to you.",
  'continuously-groovin-melbourne-2026':
    'Continuously Grooving is where office energy meets live music. Made up of colleagues who swap keyboards and spreadsheets for guitars and drumsticks, the band brings a mix of tight rhythms, catchy hooks, and a genuine love of playing together. From indie rock favourites to crowd-pleasing classics, their sound is all about keeping the vibe high and the dance floor moving.',
  'fully-seek-melbourne-2026':
    'FULLY SEEK is a six-piece band, bringing together six completely different musical backgrounds to create one electrifying sound. What starts as a mix of influences quickly locks into a groove of soulful melodies, catchy pop hooks, and irresistibly tight funk rhythms. Their sets are all about feel-good energy, big smiles, and getting every crowd on their feet, proving that when diverse styles come together, the result is pure, powerful fun.',
  'hot-property-melbourne-2026':
    "One fateful day 13 years ago, REA's band Lost Property Office was formed. They organised and performed in the very first Battle of the Agile bands. Its founding members still grace our stage, some still working at REA. A couple of name changes later, we're now called Hot Property!\n\nHot Property now rocks out in the office garage - from nostalgic 90s grunge to punk and pop music! We'll bring the house down with a diverse mix of energetic songs you forgot you knew the words to!",
}

/** @typedef {{ position: number, song_type: 'cover'|'mashup'|'medley'|'transition', title: string, artist: string, additional_songs?: {title:string,artist:string}[] }} Song */

/** @type {Record<string, Song[]>} */
const SETLISTS = {
  'loop-there-it-is-melbourne-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'Are You Gonna Go My Way',
      artist: 'Lenny Kravitz',
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'Fell in Love with a Girl',
      artist: 'The White Stripes',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Torn',
      artist: 'Natalie Imbruglia',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'You Give Love a Bad Name',
      artist: 'Bon Jovi',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'I Will Survive',
      artist: 'Gloria Gaynor',
    },
    {
      position: 6,
      song_type: 'cover',
      title: 'Am I Ever Going to See Your Face Again',
      artist: 'The Angels',
    },
  ],
  'continuously-groovin-melbourne-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'Take Me Out',
      artist: 'Franz Ferdinand',
    },
    {
      position: 2,
      song_type: 'cover',
      title: 'When You Were Young',
      artist: 'The Killers',
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Everybody Wants to Rule the World',
      artist: 'Tears for Fears',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'Dancing in the Moonlight',
      artist: 'Toploader',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'Murder on the Dancefloor',
      artist: 'Sophie Ellis-Bextor',
    },
  ],
  'fully-seek-melbourne-2026': [
    {
      position: 1,
      song_type: 'cover',
      title: 'Lose Control',
      artist: 'Teddy Swims',
    },
    {
      position: 2,
      song_type: 'mashup',
      title: 'Cry Me a River',
      artist: 'Justin Timberlake',
      additional_songs: [{ title: 'Cry Me a River', artist: 'Julie London' }],
    },
    {
      position: 3,
      song_type: 'cover',
      title: 'Where Is My Husband',
      artist: 'Raye',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'Pretty Young Thing',
      artist: 'Michael Jackson',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'Baby One More Time',
      artist: 'Britney Spears',
    },
  ],
  'hot-property-melbourne-2026': [
    { position: 1, song_type: 'cover', title: 'Golden', artist: 'Huntr/x' },
    {
      position: 2,
      song_type: 'cover',
      title: 'Sk8er Boi',
      artist: 'Avril Lavigne',
    },
    {
      position: 3,
      song_type: 'cover',
      title: "Livin' on a Prayer",
      artist: 'Bon Jovi',
    },
    {
      position: 4,
      song_type: 'cover',
      title: 'Are You Gonna Be My Girl',
      artist: 'Jet',
    },
    {
      position: 5,
      song_type: 'cover',
      title: 'Murder on the Dancefloor',
      artist: 'Sophie Ellis-Bextor & Royel Otis',
    },
  ],
}

const esc = (s) => s.replace(/'/g, "''")

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  for (const bandId of BAND_IDS) {
    const desc = DESCRIPTIONS[bandId]
    pgm.sql(
      `UPDATE bands SET description = '${esc(desc)}' WHERE id = '${bandId}'`
    )

    for (const song of SETLISTS[bandId]) {
      const additional = JSON.stringify(song.additional_songs || [])
      pgm.sql(
        `INSERT INTO setlist_songs (band_id, position, song_type, title, artist, additional_songs, status)
         VALUES ('${bandId}', ${song.position}, '${song.song_type}', '${esc(song.title)}', '${esc(song.artist)}', '${esc(additional)}'::jsonb, 'pending')`
      )
    }
  }
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  for (const bandId of BAND_IDS) {
    pgm.sql(`DELETE FROM setlist_songs WHERE band_id = '${bandId}'`)
    pgm.sql(`UPDATE bands SET description = NULL WHERE id = '${bandId}'`)
  }
}
