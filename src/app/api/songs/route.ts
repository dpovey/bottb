import { NextRequest, NextResponse } from 'next/server'
import { getAllSongs, getSongCount, SongType } from '@/lib/db'
import { withPublicRateLimit } from '@/lib/api-protection'

/**
 * GET /api/songs
 * Public endpoint to list all songs with optional filters
 * Only returns songs from finalized events
 */
export const GET = withPublicRateLimit(async function GET(
  request: NextRequest
) {
  try {
    // Use URL constructor for testability (nextUrl.searchParams is not available in tests)
    const searchParams = new URL(request.url).searchParams
    const eventId = searchParams.get('event') || undefined
    const bandId = searchParams.get('band') || undefined
    const songType = (searchParams.get('type') as SongType) || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Validate song type if provided
    if (songType) {
      const validTypes = ['cover', 'mashup', 'medley', 'transition']
      if (!validTypes.includes(songType)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const [songs, total] = await Promise.all([
      getAllSongs({ eventId, bandId, songType, search, limit, offset }),
      getSongCount({ eventId, bandId, songType, search }),
    ])

    // Get unique events and bands for filter options
    const events = new Map<string, { id: string; name: string }>()
    const bands = new Map<string, { id: string; name: string }>()
    const types = new Set<string>()

    for (const song of songs) {
      if (song.event_id && song.event_name) {
        events.set(song.event_id, { id: song.event_id, name: song.event_name })
      }
      if (song.band_id && song.band_name) {
        bands.set(song.band_id, { id: song.band_id, name: song.band_name })
      }
      types.add(song.song_type)
    }

    return NextResponse.json({
      songs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        events: Array.from(events.values()),
        bands: Array.from(bands.values()),
        types: Array.from(types),
      },
    })
  } catch (error) {
    console.error('Error fetching songs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch songs' },
      { status: 500 }
    )
  }
})
