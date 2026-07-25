import { describe, expect, it } from 'vitest'
import type { SetlistSong } from '@/lib/db'
import { findSongByTitle, setlistArtists, songArtist } from './setlist-artist'

function song(partial: Partial<SetlistSong>): SetlistSong {
  return {
    id: partial.title ?? 'id',
    band_id: 'band-1',
    position: 1,
    song_type: 'cover',
    title: 'Everlong',
    artist: 'Foo Fighters',
    cover_artist: null,
    additional_songs: [],
    transition_to_title: null,
    transition_to_artist: null,
    youtube_video_id: null,
    status: 'draft',
    artist_description: null,
    spotify_track_id: null,
    created_at: '2026-01-01',
    ...partial,
  } as SetlistSong
}

describe('songArtist', () => {
  it('credits the original artist', () => {
    expect(songArtist(song({}))).toBe('Foo Fighters')
  })

  it('prefers the version actually performed when covering a cover', () => {
    const s = song({
      artist: 'Sabrina Carpenter',
      cover_artist: 'Good Neighbours',
    })
    expect(songArtist(s)).toBe('Good Neighbours')
  })

  it('falls back to the original artist when cover_artist is blank', () => {
    expect(songArtist(song({ cover_artist: '   ' }))).toBe('Foo Fighters')
  })
})

describe('findSongByTitle', () => {
  const songs = [
    song({ title: 'Everlong', artist: 'Foo Fighters' }),
    song({ title: 'Mr. Brightside', artist: 'The Killers' }),
  ]

  it('matches an exact title', () => {
    expect(findSongByTitle(songs, 'Mr. Brightside')?.artist).toBe('The Killers')
  })

  it('ignores case and surrounding whitespace', () => {
    expect(findSongByTitle(songs, '  everlong ')?.artist).toBe('Foo Fighters')
  })

  it('does not match a partial title, so typing cannot clobber the artist', () => {
    expect(findSongByTitle(songs, 'Ever')).toBeUndefined()
    expect(findSongByTitle(songs, '')).toBeUndefined()
  })

  it('returns undefined for a title that is not in the setlist', () => {
    expect(findSongByTitle(songs, 'Free Bird')).toBeUndefined()
  })

  it('returns undefined for an empty setlist', () => {
    expect(findSongByTitle([], 'Everlong')).toBeUndefined()
  })
})

describe('setlistArtists', () => {
  it('lists distinct artists alphabetically', () => {
    const artists = setlistArtists([
      song({ title: 'Mr. Brightside', artist: 'The Killers' }),
      song({ title: 'Everlong', artist: 'Foo Fighters' }),
      song({ title: 'My Hero', artist: 'Foo Fighters' }),
    ])
    expect(artists).toEqual(['Foo Fighters', 'The Killers'])
  })

  it('uses the performed version when covering a cover', () => {
    const artists = setlistArtists([
      song({ artist: 'Sabrina Carpenter', cover_artist: 'Good Neighbours' }),
    ])
    expect(artists).toEqual(['Good Neighbours'])
  })

  it('de-duplicates case-insensitively, keeping the first spelling', () => {
    const artists = setlistArtists([
      song({ title: 'a', artist: 'Foo Fighters' }),
      song({ title: 'b', artist: 'foo fighters' }),
    ])
    expect(artists).toEqual(['Foo Fighters'])
  })

  it('is empty for an empty setlist', () => {
    expect(setlistArtists([])).toEqual([])
  })
})
