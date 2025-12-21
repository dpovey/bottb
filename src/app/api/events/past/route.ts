import { NextRequest, NextResponse } from "next/server";
import { getPastEventsWithWinners } from "@/lib/db";
import { withPublicRateLimit } from "@/lib/api-protection";

interface EventInfo {
  winner?: string;
  winner_company_slug?: string;
  winner_company_name?: string;
  winner_company_icon_url?: string;
  [key: string]: unknown;
}

async function handleGetPastEvents(_request: NextRequest) {
  try {
    // Single efficient query gets all past events with winner info
    const pastEvents = await getPastEventsWithWinners();
    
    // Merge the joined winner fields into the info object for API consistency
    const enrichedEvents = pastEvents.map((event) => {
      const eventInfo = event.info as EventInfo | null;
      
      // If we have winner info from the JOIN, add it to the info object
      if (event.winner_band_name) {
        return {
          ...event,
          info: {
            ...eventInfo,
            winner: event.winner_band_name,
            winner_company_slug: event.winner_company_slug,
            winner_company_name: event.winner_company_name,
            winner_company_icon_url: event.winner_company_icon_url,
          },
          // Remove the joined fields from top level
          winner_band_name: undefined,
          winner_company_slug: undefined,
          winner_company_name: undefined,
          winner_company_icon_url: undefined,
        };
      }
      
      return event;
    });
    
    return NextResponse.json(enrichedEvents);
  } catch (error) {
    console.error("Error fetching past events:", error);
    return NextResponse.json(
      { error: "Failed to fetch past events" },
      { status: 500 }
    );
  }
}

export const GET = withPublicRateLimit(handleGetPastEvents);
