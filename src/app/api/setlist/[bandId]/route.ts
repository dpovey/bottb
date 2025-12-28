import { NextRequest, NextResponse } from 'next/server'
import {
  getSetlistForBand,
  createSetlistSong,
  updateConflictStatus,
  SetlistSongInput,
} from '@/lib/db'
import { withAdminAuth, ProtectedApiHandler } from '@/lib/api-protection'
import { v7 as uuidv7 } from 'uuid'

interface RouteContext {
  params: Promise<{ bandId: string }>
}

/**
 * GET /api/setlist/[bandId]
 * Public endpoint to get setlist for a band
 * Note: Returns empty array if event is not finalized (visibility controlled by caller)
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { bandId } = await context.params
    const songs = await getSetlistForBand(bandId)

    return NextResponse.json({ songs })
  } catch (error) {
    console.error('Error fetching setlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch setlist' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/setlist/[bandId]
 * Admin endpoint to add a song to a band's setlist
 */
const postHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { bandId } = await (context as RouteContext).params
    const body = await request.json()

    const {
      position,
      song_type = 'cover',
      title,
      artist,
      additional_songs = [],
      transition_to_title,
      transition_to_artist,
      youtube_video_id,
      status = 'pending',
    } = body

    // Validate required fields
    if (!title || !artist) {
      return NextResponse.json(
        { error: 'Title and artist are required' },
        { status: 400 }
      )
    }

    if (position === undefined || position < 1) {
      return NextResponse.json(
        { error: 'Position must be a positive integer' },
        { status: 400 }
      )
    }

    // Validate song type
    const validTypes = ['cover', 'mashup', 'medley', 'transition']
    if (!validTypes.includes(song_type)) {
      return NextResponse.json(
        {
          error: `Invalid song_type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // For transitions, validate target song
    if (
      song_type === 'transition' &&
      (!transition_to_title || !transition_to_artist)
    ) {
      return NextResponse.json(
        {
          error:
            'Transition songs require transition_to_title and transition_to_artist',
        },
        { status: 400 }
      )
    }

    // Create the song with UUIDv7
    const songInput: SetlistSongInput = {
      id: uuidv7(),
      band_id: bandId,
      position,
      song_type,
      title,
      artist,
      additional_songs,
      transition_to_title,
      transition_to_artist,
      youtube_video_id,
      status,
    }

    const song = await createSetlistSong(songInput)

    // Update conflict status for the event
    // Get event_id from the song (need to fetch it)
    const songs = await getSetlistForBand(bandId)
    if (songs.length > 0 && songs[0].event_id) {
      await updateConflictStatus(songs[0].event_id)
    }

    // Re-fetch to get updated status
    const updatedSongs = await getSetlistForBand(bandId)
    const updatedSong = updatedSongs.find((s) => s.id === song.id)

    return NextResponse.json({ song: updatedSong || song }, { status: 201 })
  } catch (error) {
    console.error('Error creating setlist song:', error)

    // Check for unique constraint violation (duplicate position)
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'A song already exists at this position' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create setlist song' },
      { status: 500 }
    )
  }
}

export const POST = withAdminAuth(postHandler)
