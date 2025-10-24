import { http, HttpResponse } from "msw";

export const handlers = [
  // Events API
  http.get("/api/events", () => {
    return HttpResponse.json([
      {
        id: "event-1",
        name: "Test Event 1",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue 1",
        status: "voting",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "event-2",
        name: "Test Event 2",
        date: "2024-12-26T18:30:00Z",
        location: "Test Venue 2",
        status: "upcoming",
        is_active: false,
        created_at: "2024-01-02T00:00:00Z",
      },
      {
        id: "event-3",
        name: "Test Event 3",
        date: "2023-12-10T00:00:00Z",
        location: "Test Venue 3",
        status: "finalized",
        is_active: false,
        created_at: "2023-01-01T00:00:00Z",
      },
    ]);
  }),

  http.get("/api/events/:eventId", ({ params }) => {
    const { eventId } = params;

    // Return 404 for specific test cases
    if (eventId === "not-found-event") {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Return different statuses for testing
    if (eventId === "upcoming-event") {
      return HttpResponse.json({
        id: eventId,
        name: "Upcoming Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "upcoming",
        is_active: false,
        created_at: "2024-01-01T00:00:00Z",
      });
    }

    if (eventId === "finalized-event") {
      return HttpResponse.json({
        id: eventId,
        name: "Finalized Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
        is_active: false,
        created_at: "2024-01-01T00:00:00Z",
      });
    }

    return HttpResponse.json({
      id: eventId,
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      status: "voting",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
    });
  }),

  http.get("/api/events/active", () => {
    return HttpResponse.json({
      id: "active-event-1",
      name: "Active Event",
      date: "2024-12-25T18:30:00Z",
      location: "Active Venue",
      status: "voting",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
    });
  }),

  http.get("/api/events/upcoming", () => {
    return HttpResponse.json([
      {
        id: "upcoming-event-1",
        name: "Upcoming Event 1",
        date: "2024-12-25T18:30:00Z",
        location: "Upcoming Venue 1",
        status: "upcoming",
        is_active: false,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
  }),

  http.get("/api/events/past", () => {
    return HttpResponse.json([
      {
        id: "past-event-1",
        name: "Past Event 1",
        date: "2023-12-25T18:30:00Z",
        location: "Past Venue 1",
        status: "finalized",
        is_active: false,
        created_at: "2023-01-01T00:00:00Z",
      },
    ]);
  }),

  // Bands API
  http.get("/api/bands/:eventId", ({ params }) => {
    const { eventId } = params;

    // Return empty array for specific test cases
    if (eventId === "no-bands-event") {
      return HttpResponse.json([]);
    }

    return HttpResponse.json([
      {
        id: "band-1",
        event_id: eventId,
        name: "Test Band 1",
        description: "A test band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: eventId,
        name: "Test Band 2",
        description: "Another test band",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
  }),

  // Votes API
  http.post("/api/votes", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Simulate already voted error for specific test cases
    if (body.event_id === "already-voted-event") {
      return HttpResponse.json({ error: "Already Voted" }, { status: 400 });
    }

    // Simulate status validation errors
    if (body.event_id === "upcoming-event") {
      return HttpResponse.json(
        {
          error: "Voting is not currently open for this event",
          eventStatus: "upcoming",
        },
        { status: 403 }
      );
    }

    if (body.event_id === "finalized-event") {
      return HttpResponse.json(
        {
          error: "Voting is not currently open for this event",
          eventStatus: "finalized",
        },
        { status: 403 }
      );
    }

    if (body.event_id === "not-found-event") {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return HttpResponse.json({
      id: "vote-1",
      ...body,
      created_at: "2024-01-01T00:00:00Z",
    });
  }),

  http.post("/api/votes/batch", async ({ request }) => {
    const body = (await request.json()) as { votes: Record<string, unknown>[] };

    // Simulate already voted error for specific test cases
    if (
      body.votes.some(
        (vote: Record<string, unknown>) =>
          vote.event_id === "already-voted-event"
      )
    ) {
      return HttpResponse.json({ error: "Already Voted" }, { status: 400 });
    }

    // Simulate status validation errors
    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === "upcoming-event"
      )
    ) {
      return HttpResponse.json(
        {
          error: "Voting is not currently open for this event",
          eventStatus: "upcoming",
        },
        { status: 403 }
      );
    }

    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === "finalized-event"
      )
    ) {
      return HttpResponse.json(
        {
          error: "Voting is not currently open for this event",
          eventStatus: "finalized",
        },
        { status: 403 }
      );
    }

    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === "not-found-event"
      )
    ) {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return HttpResponse.json({
      votes: body.votes.map((vote: Record<string, unknown>, index: number) => ({
        id: `vote-${index + 1}`,
        ...vote,
        created_at: "2024-01-01T00:00:00Z",
      })),
    });
  }),

  // Event scores API
  http.get("/api/events/:eventId/scores", () => {
    return HttpResponse.json([
      {
        id: "band-1",
        name: "Test Band 1",
        order: 1,
        avg_song_choice: 15.5,
        avg_performance: 25.0,
        avg_crowd_vibe: 22.5,
        avg_crowd_vote: 18.0,
        crowd_vote_count: 10,
        judge_vote_count: 3,
        total_crowd_votes: 50,
      },
      {
        id: "band-2",
        name: "Test Band 2",
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ]);
  }),

  // Event status update API
  http.patch("/api/events/:eventId/status", async ({ request, params }) => {
    const { eventId } = params;
    const body = (await request.json()) as { status: string };

    // Return 404 for specific test cases
    if (eventId === "non-existent") {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Return 400 for invalid status
    if (
      !body.status ||
      !["upcoming", "voting", "finalized"].includes(body.status)
    ) {
      return HttpResponse.json(
        {
          error: "Invalid status. Must be 'upcoming', 'voting', or 'finalized'",
        },
        { status: 400 }
      );
    }

    // Return success response
    return HttpResponse.json({
      success: true,
      message: `Event status updated to ${body.status}`,
      event: {
        id: eventId,
        name: "Test Event",
        location: "Test Location",
        status: body.status,
        date: "2024-01-01T00:00:00Z",
        is_active: body.status === "voting",
        created_at: "2024-01-01T00:00:00Z",
      },
    });
  }),

  // Fallback handler for unhandled requests
  http.all("*", () => {
    return HttpResponse.json(
      { error: "No handler found for this request" },
      { status: 404 }
    );
  }),
];
