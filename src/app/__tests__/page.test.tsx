import { render, screen } from "@testing-library/react";
import HomePage from "../page";

// Mock the database functions
jest.mock("@/lib/db", () => ({
  getActiveEvent: jest.fn(),
  getUpcomingEvents: jest.fn(),
  getPastEvents: jest.fn(),
  getBandsForEvent: jest.fn(),
  getBandScores: jest.fn(),
}));

// Mock the date utils
jest.mock("@/lib/date-utils", () => ({
  formatEventDate: jest.fn((date) => `Formatted: ${date}`),
}));

import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandsForEvent,
  getBandScores,
} from "@/lib/db";

const mockGetActiveEvent = getActiveEvent as jest.MockedFunction<
  typeof getActiveEvent
>;
const mockGetUpcomingEvents = getUpcomingEvents as jest.MockedFunction<
  typeof getUpcomingEvents
>;
const mockGetPastEvents = getPastEvents as jest.MockedFunction<
  typeof getPastEvents
>;
const mockGetBandsForEvent = getBandsForEvent as jest.MockedFunction<
  typeof getBandsForEvent
>;
const mockGetBandScores = getBandScores as jest.MockedFunction<
  typeof getBandScores
>;

describe("HomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the main title and subtitle", async () => {
    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "Battle of the Tech Bands" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Where technology meets music")
    ).toBeInTheDocument();
  });

  it("renders upcoming events when available", async () => {
    const upcomingEvents = [
      {
        id: "event-1",
        name: "Upcoming Event 1",
        date: "2024-12-25T18:30:00Z",
        location: "Venue 1",
        is_active: false,
        status: "upcoming" as const,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "event-2",
        name: "Upcoming Event 2",
        date: "2024-12-26T18:30:00Z",
        location: "Venue 2",
        is_active: false,
        status: "upcoming" as const,
        created_at: "2024-01-02T00:00:00Z",
      },
    ];

    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue(upcomingEvents);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "Upcoming Events" })
    ).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event 1")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event 2")).toBeInTheDocument();
    expect(screen.getByText("Venue 1")).toBeInTheDocument();
    expect(screen.getByText("Venue 2")).toBeInTheDocument();
  });

  it("renders active event with bands when available", async () => {
    const activeEvent = {
      id: "active-event",
      name: "Active Event",
      date: "2024-12-25T18:30:00Z",
      location: "Active Venue",
      is_active: true,
      status: "voting" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    const bands = [
      {
        id: "band-1",
        event_id: "active-event",
        name: "Band 1",
        description: "Description 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "active-event",
        name: "Band 2",
        description: "Description 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockGetActiveEvent.mockResolvedValue(activeEvent);
    mockGetUpcomingEvents.mockResolvedValue([activeEvent]);
    mockGetPastEvents.mockResolvedValue([]);
    mockGetBandsForEvent.mockResolvedValue(bands);

    render(await HomePage());

    expect(screen.getByText("Active Event")).toBeInTheDocument();
    expect(screen.getByText("Active Venue")).toBeInTheDocument();
    expect(screen.getByText("2 bands competing:")).toBeInTheDocument();
    expect(screen.getByText("Band 1, Band 2")).toBeInTheDocument();
  });

  it("shows ACTIVE badge for active event", async () => {
    const upcomingEvents = [
      {
        id: "active-event",
        name: "Active Event",
        date: "2024-12-25T18:30:00Z",
        location: "Active Venue",
        is_active: true,
        status: "voting" as const,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockGetActiveEvent.mockResolvedValue(upcomingEvents[0]);
    mockGetUpcomingEvents.mockResolvedValue(upcomingEvents);
    mockGetPastEvents.mockResolvedValue([]);
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("shows voting link for voting events", async () => {
    const upcomingEvents = [
      {
        id: "voting-event",
        name: "Voting Event",
        date: "2024-12-25T18:30:00Z",
        location: "Voting Venue",
        is_active: false,
        status: "voting" as const,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue(upcomingEvents);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    const voteLink = screen.getByRole("link", { name: "🎵 Vote Now" });
    expect(voteLink).toBeInTheDocument();
    expect(voteLink).toHaveAttribute("href", "/vote/crowd/voting-event");
  });

  it("renders past events with winners when available", async () => {
    const pastEvents = [
      {
        id: "past-event",
        name: "Past Event",
        date: "2023-12-25T18:30:00Z",
        location: "Past Venue",
        is_active: false,
        status: "finalized" as const,
        created_at: "2023-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Winning Band",
        order: 1,
        avg_song_choice: 15.5,
        avg_performance: 25.0,
        avg_crowd_vibe: 22.5,
        avg_crowd_vote: 18.0,
        crowd_vote_count: 10,
        judge_vote_count: 3,
        total_crowd_votes: 50,
      },
    ];

    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue(pastEvents);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "Past Events" })
    ).toBeInTheDocument();
    expect(screen.getByText("Past Event")).toBeInTheDocument();
    expect(screen.getByText("Winning Band")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("shows results link for finalized events", async () => {
    const pastEvents = [
      {
        id: "finalized-event",
        name: "Finalized Event",
        date: "2023-12-25T18:30:00Z",
        location: "Finalized Venue",
        is_active: false,
        status: "finalized" as const,
        created_at: "2023-01-01T00:00:00Z",
      },
    ];

    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue(pastEvents);
    mockGetBandScores.mockResolvedValue([]);

    render(await HomePage());

    const resultsLink = screen.getByRole("link", { name: "📊 View Results" });
    expect(resultsLink).toBeInTheDocument();
    expect(resultsLink).toHaveAttribute("href", "/results/finalized-event");
  });

  it("shows no upcoming events message when none exist", async () => {
    (
      mockGetActiveEvent as unknown as jest.MockedFunction<
        () => Promise<import("@/lib/db").Event | null>
      >
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: "No Upcoming Events" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check back later for the next Battle of the Tech Bands event!"
      )
    ).toBeInTheDocument();
  });

  it("shows bands with more than 3 bands correctly", async () => {
    const activeEvent = {
      id: "active-event",
      name: "Active Event",
      date: "2024-12-25T18:30:00Z",
      location: "Active Venue",
      is_active: true,
      status: "voting" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    const bands = [
      {
        id: "band-1",
        event_id: "active-event",
        name: "Band 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "active-event",
        name: "Band 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-3",
        event_id: "active-event",
        name: "Band 3",
        order: 3,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-4",
        event_id: "active-event",
        name: "Band 4",
        order: 4,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-5",
        event_id: "active-event",
        name: "Band 5",
        order: 5,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockGetActiveEvent.mockResolvedValue(activeEvent);
    mockGetUpcomingEvents.mockResolvedValue([activeEvent]);
    mockGetPastEvents.mockResolvedValue([]);
    mockGetBandsForEvent.mockResolvedValue(bands);

    render(await HomePage());

    expect(screen.getByText("5 bands competing:")).toBeInTheDocument();
    expect(
      screen.getByText("Band 1, Band 2, Band 3 +2 more")
    ).toBeInTheDocument();
  });
});
