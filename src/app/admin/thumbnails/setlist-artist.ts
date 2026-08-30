/**
 * Resolving the artist to credit for a song picked out of a band's setlist.
 * Kept separate from the generator component so the matching rules are easy to
 * test without mounting a canvas-heavy client component.
 */

import type { SetlistSong } from '@/lib/db'

/** How a setlist song is credited on an overlay. */
export interface SongCredit {
  /** The act to bill — the original artist of the main song. */
  artist: string
  /** The main song's title — for a transition, the song it goes *into*. */
  title: string
  /**
   * A short qualifier drawn small and dim under the artist, when one line of
   * artist + title doesn't tell the whole story: the particular version
   * performed ("Good Neighbours version"), the song a transition opens with
   * ("opening with Careless Whisper (George Michael)"), or the other songs in
   * a mashup / medley ("with Cry Me a River (Julie London)"). Undefined in the
   * common case of a straight cover.
   */
  version?: string
}

/** "Title (Artist)", or just the title when the artist is blank. */
function titleWithArtist(title: string, artist: string | null | undefined) {
  const a = artist?.trim()
  return a ? `${title.trim()} (${a})` : title.trim()
}

/** Join a list of names as "A", "A and B", or "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Work out what to bill for a setlist song: the main song and its artist as
 * the headline, plus a qualifier line for anything else worth a mention.
 *
 * - Straight cover: title + artist. `cover_artist` records that the band is
 *   covering someone else's cover (artist "Sabrina Carpenter", cover_artist
 *   "Good Neighbours"); billing only one of the two throws away the more
 *   recognisable name about half the time, so the original stays the headline
 *   and the version goes in the qualifier.
 * - Transition: `title`/`artist` is the song the band *opens* with and
 *   `transition_to_*` is the song it becomes. The overlay leads with the main
 *   song (the one it goes into) and mentions the opener in the qualifier.
 * - Mashup / medley: the headline song, with `additional_songs` in the
 *   qualifier.
 */
export function songCredit(song: SetlistSong): SongCredit {
  const artist = song.artist.trim()
  const title = song.title.trim()
  const notes: string[] = []

  const cover = song.cover_artist?.trim()
  if (cover && cover.toLowerCase() !== artist.toLowerCase()) {
    notes.push(`${cover} version`)
  }

  const toTitle = song.transition_to_title?.trim()
  if (song.song_type === 'transition' && toTitle) {
    const toArtist = song.transition_to_artist?.trim() || artist
    notes.unshift(`opening with ${titleWithArtist(title, artist)}`)
    return {
      artist: toArtist,
      title: toTitle,
      version: notes.join(' · '),
    }
  }

  const extras = (song.additional_songs ?? [])
    .filter((s) => s.title?.trim())
    .map((s) => titleWithArtist(s.title, s.artist))
  if (extras.length > 0) notes.push(`with ${joinNames(extras)}`)

  return notes.length > 0
    ? { artist, title, version: notes.join(' · ') }
    : { artist, title }
}

/** The act to bill for a setlist song, without the qualifier. */
export function songArtist(song: SetlistSong): string {
  return songCredit(song).artist
}

/**
 * Find the setlist song whose title matches `title`, ignoring case and
 * surrounding whitespace. A transition matches on either the opener's title
 * or the main song's, since the overlay leads with the latter.
 *
 * Returns `undefined` for a partial or free-text title, which is what keeps
 * typing from clobbering a hand-entered artist: the fill only fires once the
 * field holds a complete setlist title (i.e. on picking from the datalist, or
 * on typing one out in full).
 */
export function findSongByTitle(
  songs: SetlistSong[],
  title: string
): SetlistSong | undefined {
  const wanted = title.trim().toLowerCase()
  if (!wanted) return undefined
  return songs.find(
    (s) =>
      s.title.trim().toLowerCase() === wanted ||
      songCredit(s).title.toLowerCase() === wanted
  )
}

/**
 * The distinct artists across a setlist, alphabetically — the suggestions for
 * the artist combobox. A band covering two songs by the same act should offer
 * that act once.
 */
export function setlistArtists(songs: SetlistSong[]): string[] {
  const seen = new Map<string, string>()
  for (const song of songs) {
    const artist = songArtist(song).trim()
    if (artist && !seen.has(artist.toLowerCase())) {
      seen.set(artist.toLowerCase(), artist)
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}
