/**
 * Resolving the artist to credit for a song picked out of a band's setlist.
 * Kept separate from the generator component so the matching rules are easy to
 * test without mounting a canvas-heavy client component.
 */

import type { SetlistSong } from '@/lib/db'

/** How a setlist song is credited on an overlay. */
export interface SongCredit {
  /** The act to bill — the song's original artist. */
  artist: string
  /**
   * The particular version performed, when it differs from the original
   * (e.g. "Good Neighbours version"). Undefined when there is only one act
   * to credit, which is the common case.
   */
  version?: string
}

/**
 * Split a setlist song into the artist to bill and, where the band is covering
 * someone else's cover, the version being performed.
 *
 * `cover_artist` records that second act (e.g. artist "Sabrina Carpenter",
 * cover_artist "Good Neighbours"). Billing only one of the two — as this used
 * to, by preferring `cover_artist` — throws away the more recognisable name
 * about half the time, so the overlay now shows the original as the headline
 * and the version beneath it.
 */
export function songCredit(song: SetlistSong): SongCredit {
  const artist = song.artist.trim()
  const cover = song.cover_artist?.trim()
  if (!cover || cover.toLowerCase() === artist.toLowerCase()) return { artist }
  return { artist, version: `${cover} version` }
}

/** The act to bill for a setlist song, without the version qualifier. */
export function songArtist(song: SetlistSong): string {
  return songCredit(song).artist
}

/**
 * Find the setlist song whose title matches `title`, ignoring case and
 * surrounding whitespace.
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
  return songs.find((s) => s.title.trim().toLowerCase() === wanted)
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
