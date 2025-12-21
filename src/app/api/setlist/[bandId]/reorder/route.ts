import { NextResponse } from 'next/server'
import { getSetlistForBand, reorderSetlistSongs } from '@/lib/db'
import { withAdminAuth, ProtectedApiHandler } from '@/lib/api-protection'

interface RouteContext {
  params: Promise<{ bandId: string }>
}

/**
 * PUT /api/setlist/[bandId]/reorder
 * Admin endpoint to reorder setlist songs
 * Body: { songIds: string[] } - array of song IDs in desired order
 */
const putHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { bandId } = await (context as RouteContext).params
    const body = await request.json()
    const { songIds } = body

    if (!Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json(
        { error: 'songIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Verify all songIds belong to this band
    const currentSongs = await getSetlistForBand(bandId)
    const currentIds = new Set(currentSongs.map((s) => s.id))

    for (const id of songIds) {
      if (!currentIds.has(id)) {
        return NextResponse.json(
          { error: `Song ${id} does not belong to this band's setlist` },
          { status: 400 }
        )
      }
    }

    // Reorder the songs
    await reorderSetlistSongs(bandId, songIds)

    // Fetch the updated setlist
    const songs = await getSetlistForBand(bandId)

    return NextResponse.json({ songs })
  } catch (error) {
    console.error('Error reordering setlist:', error)
    return NextResponse.json(
      { error: 'Failed to reorder setlist' },
      { status: 500 }
    )
  }
}

export const PUT = withAdminAuth(putHandler)
