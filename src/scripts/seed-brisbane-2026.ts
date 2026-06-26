#!/usr/bin/env tsx

/**
 * One-off seed for the Brisbane 2026 lineup from the band-information form.
 *
 * - Upserts the Suncorp company row (logo/icon set separately via
 *   set-company-logo.ts).
 * - Inserts/updates the five bands for the brisbane-2026 event, with
 *   descriptions and logistics captured in band.info.
 * - Replaces each band's setlist with the normalised prospective songlist.
 * - Recomputes conflict status and prints a conflict report.
 *
 * Idempotent: safe to re-run.
 *
 * Usage: pnpm exec tsx src/scripts/seed-brisbane-2026.ts
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import { v7 as uuidv7 } from 'uuid'
import { nameToSlug } from '../lib/slug-utils'
import { updateConflictStatus, detectSongConflicts } from '../lib/db/songs'
import { triggerRevalidate } from '../lib/revalidate-client'

config({ path: '.env.local' })

const EVENT_ID = 'brisbane-2026'

interface Song {
  title: string
  artist: string
  cover_artist?: string
}

interface Logistics {
  members_count: number
  backline: string
  stage_setup?: string
  special_requests?: string
}

interface SeedBand {
  name: string
  company_slug: string
  order: number
  description?: string
  contact_email: string
  logistics: Logistics
  songs: Song[]
}

const COMPANY = {
  slug: 'suncorp',
  name: 'Suncorp',
  website: 'https://www.suncorp.com.au',
  description:
    'Suncorp is one of Australia and New Zealand’s largest financial services groups, providing insurance, banking and superannuation. Headquartered in Brisbane.',
}

const BANDS: SeedBand[] = [
  {
    name: 'Total Loss',
    company_slug: 'suncorp',
    order: 1,
    contact_email: 'mail@alistairsutton.com',
    description:
      'You never know what might happen if you take your guitar to team drinks. Musicians seem to come out of the woodwork! Twelve years later, we are still getting together and playing music… good friends, good tunes, good times!',
    logistics: {
      members_count: 5,
      backline:
        '2 x Vocals; 4 x Guitars (1 DI, 3 Amp); 1 x Bass; 1 x Keyboards (stereo inputs, maybe); 1 x Drummer (in-ear monitors)',
      special_requests:
        'Will a keyboard be provided? Could bring one if others want to use it.',
    },
    songs: [
      { title: 'Back in the U.S.S.R.', artist: 'The Beatles' },
      { title: 'Paint It Black', artist: 'The Rolling Stones' },
      { title: 'We Can Get Together', artist: 'Icehouse' },
      { title: 'Gold on the Ceiling', artist: 'The Black Keys' },
      { title: 'Sultans of Swing', artist: 'Dire Straits' },
    ],
  },
  {
    name: 'Jumbo Band',
    company_slug: 'jumbo-interactive',
    order: 2,
    contact_email: 'grahamk@jumbointeractive.com',
    description:
      'As the veteran crew from Jumbo Interactive, these tech professionals transform into a powerhouse live act that delivers crowd-pleasing covers with raw energy, infectious enthusiasm, and serious attitude. Expect a genre-hopping setlist packed with bangers and curveballs — from Michael Jackson’s "Beat It" and System of a Down’s "Chop Suey" to Aussie favourites like The Chats’ "Smoko".\n\nWhether they’re storming the stage with expanded vocals, themed energy, or pure pub-rock velocity, Jumbo Band turns every show into a sweaty, sing-along celebration that gets the whole room jumping. Winners of the inaugural Brisbane event and consistent scene favourites, they embody the perfect mix of corporate camaraderie, musical passion, and feel-good chaos that makes Battle of the Tech Bands unforgettable.',
    logistics: {
      members_count: 6,
      backline:
        '4+ vocals; 2 DI guitars; 1 bass; 1 drummer (in-ears); 1 keyboard',
      special_requests: 'As usual, some video clips to go on the projector.',
    },
    // First two are "current definites"; the rest are the shortlist. All added
    // as pending so conflict detection sees the whole prospective songlist.
    songs: [
      { title: 'Chelsea Dagger', artist: 'The Fratellis' },
      { title: 'Take the Power Back', artist: 'Rage Against the Machine' },
      { title: 'Beer', artist: 'Reel Big Fish' },
      { title: 'Mr. Brightside', artist: 'The Killers' },
      { title: 'I Believe in a Thing Called Love', artist: 'The Darkness' },
      { title: 'Starlight', artist: 'Muse' },
      { title: 'Prayer of the Refugee', artist: 'Rise Against' },
      { title: 'Bohemian Like You', artist: 'The Dandy Warhols' },
      { title: 'My Hero', artist: 'Foo Fighters' },
      { title: "Say It Ain't So", artist: 'Weezer' },
      { title: 'Hate to Say I Told You So', artist: 'The Hives' },
      { title: 'Bring Me to Life', artist: 'Evanescence' },
      { title: 'Pinball Wizard', artist: 'The Who' },
      { title: 'Second Solution', artist: 'The Living End' },
    ],
  },
  {
    name: 'Epsonics',
    company_slug: 'epsilon',
    order: 3,
    contact_email: 'dean.povey@gmail.com',
    description:
      'Epsonics are Epsilon’s house band for the big build and the bigger chorus. A mix of engineering, product and design folk — building the software behind retail media advertising — they spend their days shipping code and shaping features, and their nights chasing the loud, communal high of indie rock — choruses big enough to send a whole room’s arms skyward.\n\nTheir sound is built on the anthemic alt-rock of the late ’90s and early 2000s — desert-rock grooves, stadium-sized choruses and slow-burn, prog-tinged crescendos — all filtered through a melodic indie sensibility. But they’re just as happy to dig back into a classic-rock staple or an ’80s synth-pop singalong, then swerve onto the dancefloor with a psych-pop curveball. Whatever the decade, the brief stays the same: find the big moment and lean all the way into it.',
    logistics: {
      members_count: 5,
      backline:
        '3 x Vocals; 1 x Guitar/DI; 1 x Bass/DI; 1 x Keyboard (stereo inputs); 1 x Keytar (stereo inputs); 1 x Drums (IEMs)',
    },
    songs: [
      { title: 'No One Knows', artist: 'Queens of the Stone Age' },
      { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' },
      { title: 'The Chain', artist: 'Fleetwood Mac' },
      { title: 'Electric Feel', artist: 'MGMT' },
      { title: 'When You Were Young', artist: 'The Killers' },
      { title: "It's My Life", artist: 'No Doubt' },
    ],
  },
  {
    name: 'The ShipRex',
    company_slug: 'rex-software',
    order: 4,
    contact_email: 'kirranorrie@gmail.com',
    description:
      'ShipReX is the band you get when two great teams behind keeping real estate tech running decide to plug in and turn it up. We’re drawn from the crews behind Rex and UrbanX - by day we ship software and solve problems, by night we ship riffs and cause our own.\n\nThe setlist? Classified. What we will tell you: it’s loud, it’s a little unhinged, it lurches across genres and decades with zero shame, and it builds to a finish that’ll have the whole room singing. Trust us, it’s a vibe. You’ll just have to show up to find out!',
    logistics: {
      members_count: 10,
      backline:
        '3-4 x Vocals; 1 x Guitar; 1 x Bass; 1 x Drummer; 1 x Erhu; 1 x Keyboard',
    },
    songs: [
      { title: 'Careless Whisper', artist: 'George Michael' },
      { title: 'Uprising', artist: 'Muse' },
      // Espresso is originally by Sabrina Carpenter; ShipRex are performing the
      // Good Neighbours rendition. artist = canonical (drives conflicts),
      // cover_artist = the version actually being played.
      {
        title: 'Espresso',
        artist: 'Sabrina Carpenter',
        cover_artist: 'Good Neighbours',
      },
      { title: 'Everlong', artist: 'Foo Fighters' },
      { title: 'Covered in Chrome', artist: 'Violent Soho' },
      { title: "You're the Voice", artist: 'John Farnham' },
    ],
  },
  {
    name: 'Off the Record',
    company_slug: 'for-the-record',
    order: 5,
    contact_email: 'eentwistle@fortherecord.com',
    description:
      'For The Record has spent 30 years making sure every word spoken in a courtroom ends up on the record. Come performance night, they’re going Off The Record — no transcripts, no timestamps, no objections. Expect a full-throttle set with more range than their lawyers would recommend. From hard rock to power ballads, they’ll bring dual vocalists, guitars, bass, drums, keys, and a surprise fiddle to The Triffid. Loud, occasionally inadmissible, and entirely Off The Record.',
    logistics: {
      members_count: 6,
      backline:
        '1 x vocals; 1 x vocals + keyboard; 2 x guitars (DI + foldbacks, possibly also vocals); 1 x bass (amp); 1 x drummer (IEM); 1 x fiddle (tentative)',
    },
    songs: [
      { title: 'Barracuda', artist: 'Heart' },
      { title: "It's All Coming Back to Me Now", artist: 'Celine Dion' },
      { title: 'Just a Girl', artist: 'No Doubt' },
      { title: 'Immigrant Song', artist: 'Led Zeppelin' },
      { title: "It's My Life", artist: 'Bon Jovi' },
      { title: 'Never Miss a Beat', artist: 'Kaiser Chiefs' },
    ],
  },
]

function bandSlug(name: string): string {
  return `${nameToSlug(name)}-${EVENT_ID}`
}

async function main() {
  console.log(`\n\u{1F3B8} Seeding Brisbane 2026 lineup\n`)

  // 1. Upsert Suncorp company (logo/icon set by set-company-logo.ts)
  await sql`
    INSERT INTO companies (slug, name, website, description)
    VALUES (${COMPANY.slug}, ${COMPANY.name}, ${COMPANY.website}, ${COMPANY.description})
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          website = EXCLUDED.website,
          description = COALESCE(companies.description, EXCLUDED.description)
  `
  console.log(`✅ Company upserted: ${COMPANY.name} (${COMPANY.slug})`)

  // Validate all company slugs exist
  for (const band of BANDS) {
    const { rows } =
      await sql`SELECT name FROM companies WHERE slug = ${band.company_slug}`
    if (rows.length === 0) {
      throw new Error(
        `Missing company "${band.company_slug}" for band "${band.name}"`
      )
    }
  }

  // Wipe the event's existing bands/setlists first so re-runs (and band
  // renames, which change the derived id) never leave orphaned rows.
  await sql`
    DELETE FROM setlist_songs
    WHERE band_id IN (SELECT id FROM bands WHERE event_id = ${EVENT_ID})
  `
  await sql`DELETE FROM bands WHERE event_id = ${EVENT_ID}`

  // 2. Insert bands + 3. setlists
  for (const band of BANDS) {
    const id = bandSlug(band.name)
    const info = {
      logistics: band.logistics,
      contact_email: band.contact_email,
    }

    await sql`
      INSERT INTO bands (id, event_id, name, description, company_slug, "order", info)
      VALUES (${id}, ${EVENT_ID}, ${band.name}, ${band.description ?? null},
              ${band.company_slug}, ${band.order}, ${JSON.stringify(info)}::jsonb)
    `

    let position = 1
    for (const song of band.songs) {
      await sql`
        INSERT INTO setlist_songs (id, band_id, position, song_type, title, artist, cover_artist, status)
        VALUES (${uuidv7()}, ${id}, ${position}, 'cover', ${song.title}, ${song.artist}, ${song.cover_artist ?? null}, 'pending')
      `
      position++
    }
    console.log(
      `✅ ${band.name} (order ${band.order}) → ${band.company_slug}, ${band.songs.length} songs`
    )
  }

  // 4. Recompute conflicts and report
  await updateConflictStatus(EVENT_ID)
  const conflicts = await detectSongConflicts(EVENT_ID)
  console.log(`\n\u{1F50D} Exact title+artist conflicts: ${conflicts.length}`)
  for (const c of conflicts) {
    console.log(
      `  ⚠️  "${c.title}" — ${c.artist}: ${c.bands.map((b) => b.band_name).join(', ')}`
    )
  }

  // Soft near-conflicts: same title (different artist) and same artist (different title)
  const all: { band: string; title: string; artist: string }[] = []
  for (const band of BANDS) {
    for (const s of band.songs) {
      all.push({ band: band.name, title: s.title, artist: s.artist })
    }
  }
  const byTitle = new Map<string, { band: string; artist: string }[]>()
  const byArtist = new Map<string, { band: string; title: string }[]>()
  for (const s of all) {
    const tk = s.title.toLowerCase()
    if (!byTitle.has(tk)) byTitle.set(tk, [])
    byTitle.get(tk)!.push({ band: s.band, artist: s.artist })
    const ak = s.artist.toLowerCase()
    if (!byArtist.has(ak)) byArtist.set(ak, [])
    byArtist.get(ak)!.push({ band: s.band, title: s.title })
  }

  console.log(`\n\u{1F4DD} Same TITLE across bands (different songs/artists):`)
  for (const [title, entries] of byTitle) {
    if (new Set(entries.map((e) => e.band)).size > 1) {
      console.log(
        `  • "${title}": ` +
          entries.map((e) => `${e.band} (${e.artist})`).join(' vs ')
      )
    }
  }

  console.log(`\n\u{1F3B5} Same ARTIST across bands (different songs):`)
  for (const [, entries] of byArtist) {
    if (new Set(entries.map((e) => e.band)).size > 1) {
      console.log(
        `  • ${entries.map((e) => `${e.title} — ${e.band}`).join(' / ')}`
      )
    }
  }

  await triggerRevalidate({
    paths: [
      '/',
      '/events',
      `/event/${EVENT_ID}`,
      '/companies',
      '/companies/suncorp',
    ],
    tags: ['nav-events'],
  }).catch(() => {})

  console.log(`\n\u{1F389} Done.`)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ Seed failed:', e)
  process.exit(1)
})
