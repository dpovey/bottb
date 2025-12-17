import { NextRequest, NextResponse } from "next/server";
import {
  getSetlistForBand,
  updateSetlistSong,
  deleteSetlistSong,
  updateConflictStatus,
} from "@/lib/db";
import { withAdminAuth, ProtectedApiHandler } from "@/lib/api-protection";

interface RouteContext {
  params: Promise<{ bandId: string; songId: string }>;
}

/**
 * GET /api/setlist/[bandId]/[songId]
 * Get a single setlist song
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { bandId, songId } = await context.params;
    const songs = await getSetlistForBand(bandId);
    const song = songs.find((s) => s.id === songId);

    if (!song) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ song });
  } catch (error) {
    console.error("Error fetching setlist song:", error);
    return NextResponse.json(
      { error: "Failed to fetch setlist song" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/setlist/[bandId]/[songId]
 * Admin endpoint to update a setlist song
 */
const putHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { bandId, songId } = await (context as RouteContext).params;
    const body = await request.json();

    const {
      position,
      song_type,
      title,
      artist,
      additional_songs,
      transition_to_title,
      transition_to_artist,
      youtube_video_id,
      status,
    } = body;

    // Validate song type if provided
    if (song_type) {
      const validTypes = ["cover", "mashup", "medley", "transition"];
      if (!validTypes.includes(song_type)) {
        return NextResponse.json(
          { error: `Invalid song_type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ["pending", "locked", "conflict"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const song = await updateSetlistSong(songId, {
      position,
      song_type,
      title,
      artist,
      additional_songs,
      transition_to_title,
      transition_to_artist,
      youtube_video_id,
      status,
    });

    if (!song) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    // Update conflict status for the event
    const songs = await getSetlistForBand(bandId);
    if (songs.length > 0 && songs[0].event_id) {
      await updateConflictStatus(songs[0].event_id);
    }

    // Re-fetch to get updated status
    const updatedSongs = await getSetlistForBand(bandId);
    const updatedSong = updatedSongs.find((s) => s.id === song.id);

    return NextResponse.json({ song: updatedSong || song });
  } catch (error) {
    console.error("Error updating setlist song:", error);

    // Check for unique constraint violation (duplicate position)
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "A song already exists at this position" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update setlist song" },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/setlist/[bandId]/[songId]
 * Admin endpoint to delete a setlist song
 */
const deleteHandler: ProtectedApiHandler = async (_request, context) => {
  try {
    const { bandId, songId } = await (context as RouteContext).params;

    // Get event_id before deleting
    const songs = await getSetlistForBand(bandId);
    const eventId = songs.length > 0 ? songs[0].event_id : null;

    const song = await deleteSetlistSong(songId);

    if (!song) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    // Update conflict status for the event
    if (eventId) {
      await updateConflictStatus(eventId);
    }

    return NextResponse.json({ success: true, song });
  } catch (error) {
    console.error("Error deleting setlist song:", error);
    return NextResponse.json(
      { error: "Failed to delete setlist song" },
      { status: 500 }
    );
  }
};

export const PUT = withAdminAuth(putHandler);
export const DELETE = withAdminAuth(deleteHandler);

