import { NextRequest, NextResponse } from "next/server";
import {
  getSetlistsForEvent,
  detectSongConflicts,
  lockBandSetlist,
  unlockBandSetlist,
  updateConflictStatus,
} from "@/lib/db";
import { withAdminAuth, ProtectedApiHandler } from "@/lib/api-protection";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/events/[eventId]/setlists
 * Get all setlists for an event, grouped by band, with conflict detection
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { eventId } = await context.params;

    const [songs, conflicts] = await Promise.all([
      getSetlistsForEvent(eventId),
      detectSongConflicts(eventId),
    ]);

    // Group songs by band
    const bandSetlists = new Map<string, {
      band_id: string;
      band_name: string;
      company_slug?: string;
      company_name?: string;
      company_icon_url?: string;
      songs: typeof songs;
    }>();

    for (const song of songs) {
      if (!bandSetlists.has(song.band_id)) {
        bandSetlists.set(song.band_id, {
          band_id: song.band_id,
          band_name: song.band_name || "",
          company_slug: song.company_slug,
          company_name: song.company_name,
          company_icon_url: song.company_icon_url,
          songs: [],
        });
      }
      bandSetlists.get(song.band_id)!.songs.push(song);
    }

    return NextResponse.json({
      setlists: Array.from(bandSetlists.values()),
      conflicts,
      totalSongs: songs.length,
      totalConflicts: conflicts.length,
    });
  } catch (error) {
    console.error("Error fetching event setlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch event setlists" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/setlists
 * Admin endpoint for bulk operations: lock/unlock band setlists, refresh conflicts
 * Body: { action: "lock" | "unlock" | "refresh_conflicts", bandId?: string }
 */
const postHandler: ProtectedApiHandler = async (request, context) => {
  try {
    const { eventId } = await (context as RouteContext).params;
    const body = await request.json();
    const { action, bandId } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "lock":
        if (!bandId) {
          return NextResponse.json(
            { error: "bandId is required for lock action" },
            { status: 400 }
          );
        }
        await lockBandSetlist(bandId);
        break;

      case "unlock":
        if (!bandId) {
          return NextResponse.json(
            { error: "bandId is required for unlock action" },
            { status: 400 }
          );
        }
        await unlockBandSetlist(bandId);
        break;

      case "refresh_conflicts":
        await updateConflictStatus(eventId);
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action. Must be one of: lock, unlock, refresh_conflicts` },
          { status: 400 }
        );
    }

    // Return updated data
    const [songs, conflicts] = await Promise.all([
      getSetlistsForEvent(eventId),
      detectSongConflicts(eventId),
    ]);

    // Group songs by band
    const bandSetlists = new Map<string, {
      band_id: string;
      band_name: string;
      company_slug?: string;
      company_name?: string;
      company_icon_url?: string;
      songs: typeof songs;
    }>();

    for (const song of songs) {
      if (!bandSetlists.has(song.band_id)) {
        bandSetlists.set(song.band_id, {
          band_id: song.band_id,
          band_name: song.band_name || "",
          company_slug: song.company_slug,
          company_name: song.company_name,
          company_icon_url: song.company_icon_url,
          songs: [],
        });
      }
      bandSetlists.get(song.band_id)!.songs.push(song);
    }

    return NextResponse.json({
      success: true,
      action,
      setlists: Array.from(bandSetlists.values()),
      conflicts,
      totalSongs: songs.length,
      totalConflicts: conflicts.length,
    });
  } catch (error) {
    console.error("Error performing setlist action:", error);
    return NextResponse.json(
      { error: "Failed to perform setlist action" },
      { status: 500 }
    );
  }
};

export const POST = withAdminAuth(postHandler);

