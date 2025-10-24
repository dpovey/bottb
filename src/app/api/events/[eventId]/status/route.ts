import { NextRequest, NextResponse } from "next/server";
import { updateEventStatus } from "@/lib/db";
import { withAdminProtection } from "@/lib/api-protection";

async function handleUpdateEventStatus(
  request: NextRequest,
  _context?: unknown
) {
  try {
    // Extract eventId from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const eventId = pathParts[pathParts.length - 2]; // status is the last part, eventId is before it

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["upcoming", "voting", "finalized"].includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid status. Must be 'upcoming', 'voting', or 'finalized'",
        },
        { status: 400 }
      );
    }

    const updatedEvent = await updateEventStatus(eventId, status);

    if (!updatedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Event status updated to ${status}`,
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating event status:", error);
    return NextResponse.json(
      { error: "Failed to update event status" },
      { status: 500 }
    );
  }
}

export const PATCH = withAdminProtection(handleUpdateEventStatus);
