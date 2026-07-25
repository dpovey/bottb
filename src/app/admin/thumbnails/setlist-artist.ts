/**
 * Resolving the artist to credit for a song picked out of a band's setlist.
 * Kept separate from the generator component so the matching rules are easy to
 * test without mounting a canvas-heavy client component.
 */

import type { SetlistSong } from '@/lib/db'

/**
 * The act to credit for a setlist song: the specific version being performed
 * when the band is covering a cover (`cover_artist` — e.g. artist "Sabrina
 * Carpenter", cover_artist "Good Neighbours"), otherwise the canonical
 * original artist. For an original, that is the band itself.
 */
export function songArtist(song: SetlistSong): string {
  return song.cover_artist?.trim() || song.artist
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
