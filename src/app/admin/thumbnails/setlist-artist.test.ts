import { describe, expect, it } from 'vitest'
import type { SetlistSong } from '@/lib/db'
import {
  findSongByTitle,
  setlistArtists,
  songArtist,
  songCredit,
} from './setlist-artist'

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

describe('songCredit', () => {
  it('bills the original artist, with no version to qualify it', () => {
    expect(songCredit(song({}))).toEqual({
      artist: 'Foo Fighters',
      title: 'Everlong',
    })
  })

  it('keeps both acts when covering someone else’s cover', () => {
    const s = song({
      artist: 'Sabrina Carpenter',
      cover_artist: 'Good Neighbours',
    })
    expect(songCredit(s)).toEqual({
      artist: 'Sabrina Carpenter',
      title: 'Everlong',
      version: 'Good Neighbours version',
    })
  })

  it('leads a transition with the song it goes into, mentioning the opener', () => {
    const s = song({
      song_type: 'transition',
      title: 'Careless Whisper',
      artist: 'George Michael',
      transition_to_title: 'Uprising',
      transition_to_artist: 'Muse',
    })
    expect(songCredit(s)).toEqual({
      artist: 'Muse',
      title: 'Uprising',
      version: 'opening with Careless Whisper (George Michael)',
    })
  })

  it('treats a transition with no target as a plain cover', () => {
    const s = song({ song_type: 'transition', transition_to_title: '  ' })
    expect(songCredit(s)).toEqual({ artist: 'Foo Fighters', title: 'Everlong' })
  })

  it('lists the other songs in a mashup or medley', () => {
    const s = song({
      song_type: 'mashup',
      title: 'Cry Me a River',
      artist: 'Justin Timberlake',
      additional_songs: [
        { title: 'Cry Me a River', artist: 'Julie London' },
        { title: 'SexyBack', artist: '' },
      ],
    })
    expect(songCredit(s).version).toBe(
      'with Cry Me a River (Julie London) and SexyBack'
    )
  })

  it('omits the version when cover_artist is blank', () => {
    expect(songCredit(song({ cover_artist: '   ' })).version).toBeUndefined()
  })

  it('omits the version when it just repeats the artist', () => {
    const s = song({ artist: 'Foo Fighters', cover_artist: 'foo fighters' })
    expect(songCredit(s).version).toBeUndefined()
  })
})

describe('songArtist', () => {
  it('is the billed artist, without the version qualifier', () => {
    expect(songArtist(song({}))).toBe('Foo Fighters')
    expect(
      songArtist(
        song({ artist: 'Sabrina Carpenter', cover_artist: 'Good Neighbours' })
      )
    ).toBe('Sabrina Carpenter')
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

  it('matches a transition on the song it goes into', () => {
    const t = song({
      song_type: 'transition',
      title: 'Careless Whisper',
      artist: 'George Michael',
      transition_to_title: 'Uprising',
      transition_to_artist: 'Muse',
    })
    expect(findSongByTitle([t], 'uprising')).toBe(t)
    expect(findSongByTitle([t], 'Careless Whisper')).toBe(t)
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

  it('suggests the billed artist, not the cover act', () => {
    const artists = setlistArtists([
      song({ artist: 'Sabrina Carpenter', cover_artist: 'Good Neighbours' }),
    ])
    expect(artists).toEqual(['Sabrina Carpenter'])
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
