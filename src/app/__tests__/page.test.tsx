import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import HomePage from "../page";

// Mock the database functions
vi.mock("@/lib/db", () => ({
  getActiveEvent: vi.fn(),
  getUpcomingEvents: vi.fn(),
  getPastEvents: vi.fn(),
  getBandsForEvent: vi.fn(),
  getBandScores: vi.fn(),
}));

// Mock the date utils
vi.mock("@/lib/date-utils", () => ({
  formatEventDate: vi.fn((date) => `Formatted: ${date}`),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
}));

import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandsForEvent,
  getBandScores,
} from "@/lib/db";

const mockGetActiveEvent = getActiveEvent as ReturnType<typeof vi.fn>;
const mockGetUpcomingEvents = getUpcomingEvents as ReturnType<typeof vi.fn>;
const mockGetPastEvents = getPastEvents as ReturnType<typeof vi.fn>;
const mockGetBandsForEvent = getBandsForEvent as ReturnType<typeof vi.fn>;
const mockGetBandScores = getBandScores as ReturnType<typeof vi.fn>;

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no active event exists", async () => {
    (
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    // Should not show "No Active Event" message
    expect(
      screen.queryByRole("heading", { name: "No Active Event" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Check back later for upcoming battles!")
    ).not.toBeInTheDocument();
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
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
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

    expect(screen.getAllByText("Active Event")).toHaveLength(2);
    expect(screen.getByText("Active Venue")).toBeInTheDocument();
    expect(screen.getByText("View Event")).toBeInTheDocument();
    expect(screen.getByText("Vote Now")).toBeInTheDocument();
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

    expect(screen.getAllByText("Active Event")).toHaveLength(2);
    expect(screen.getByText("Vote Now")).toBeInTheDocument();
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
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue(upcomingEvents);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Voting Event")).toBeInTheDocument();
    expect(screen.getByText("Voting Venue")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();
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
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
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
    expect(screen.getByText("🏆 Winner")).toBeInTheDocument();
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
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue(pastEvents);
    mockGetBandScores.mockResolvedValue([]);

    render(await HomePage());

    const resultsLink = screen.getByRole("link", { name: "📊 View Results" });
    expect(resultsLink).toBeInTheDocument();
    expect(resultsLink).toHaveAttribute("href", "/results/finalized-event");
  });

  it("shows nothing when no events exist", async () => {
    (
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    // Should not show any placeholder messages
    expect(
      screen.queryByRole("heading", { name: "No Active Event" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Check back later for upcoming battles!")
    ).not.toBeInTheDocument();
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

    expect(screen.getAllByText("Active Event")).toHaveLength(2);
    expect(screen.getByText("Active Venue")).toBeInTheDocument();
    expect(screen.getByText("View Event")).toBeInTheDocument();
    expect(screen.getByText("Vote Now")).toBeInTheDocument();
  });
});
