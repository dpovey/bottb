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
  getPhotosByLabel: vi.fn(),
  getCompanies: vi.fn(),
  PHOTO_LABELS: {
    BAND_HERO: "band_hero",
    EVENT_HERO: "event_hero",
    GLOBAL_HERO: "global_hero",
  },
}));

// Mock the date utils
vi.mock("@/lib/date-utils", () => ({
  formatEventDate: vi.fn((date) => `Formatted: ${date}`),
  getDatePartsInTimezone: vi.fn(() => ({ day: 25, month: "Dec", year: 2024 })),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
  signOut: vi.fn(),
}));

// Mock async server components that don't work well in test environment
vi.mock("@/components/company-logo-marquee", () => ({
  CompanyLogoMarquee: () => null,
}));

import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandsForEvent,
  getBandScores,
  getPhotosByLabel,
  getCompanies,
} from "@/lib/db";

const mockGetActiveEvent = getActiveEvent as ReturnType<typeof vi.fn>;
const mockGetUpcomingEvents = getUpcomingEvents as ReturnType<typeof vi.fn>;
const mockGetPastEvents = getPastEvents as ReturnType<typeof vi.fn>;
const mockGetBandsForEvent = getBandsForEvent as ReturnType<typeof vi.fn>;
const mockGetBandScores = getBandScores as ReturnType<typeof vi.fn>;
const mockGetPhotosByLabel = getPhotosByLabel as ReturnType<typeof vi.fn>;
const mockGetCompanies = getCompanies as ReturnType<typeof vi.fn>;

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to no photos and no companies (marquee won't render)
    mockGetPhotosByLabel.mockResolvedValue([]);
    mockGetCompanies.mockResolvedValue([]);
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
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event 1")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event 2")).toBeInTheDocument();
  });

  it("renders active event with voting buttons", async () => {
    const activeEvent = {
      id: "active-event",
      name: "Active Event",
      date: "2024-12-25T18:30:00Z",
      location: "Active Venue",
      is_active: true,
      status: "voting" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockGetActiveEvent.mockResolvedValue(activeEvent);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    // Hero section should have Vote Now and View Event buttons (may appear multiple times)
    expect(screen.getAllByText("Vote Now").length).toBeGreaterThan(0);
    expect(screen.getAllByText("View Event").length).toBeGreaterThan(0);
  });

  it("shows Live Now badge for active event", async () => {
    const activeEvent = {
      id: "active-event",
      name: "Active Event",
      date: "2024-12-25T18:30:00Z",
      location: "Active Venue",
      is_active: true,
      status: "voting" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockGetActiveEvent.mockResolvedValue(activeEvent);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Happening Now")).toBeInTheDocument();
    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("shows upcoming event card linking to event page", async () => {
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
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Voting Event")).toBeInTheDocument();
    // Visual cards link the entire card to the event page
    const eventLink = screen.getByRole("link", { name: /Voting Event/i });
    expect(eventLink).toHaveAttribute("href", "/event/voting-event");
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
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Past Events")).toBeInTheDocument();
    expect(screen.getByText("Past Event")).toBeInTheDocument();
    // Visual cards show winner with trophy emoji in a badge
    expect(screen.getByText(/🏆.*Winning Band/)).toBeInTheDocument();
  });

  it("shows past event card linking to event page", async () => {
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
    mockGetBandsForEvent.mockResolvedValue([]);

    render(await HomePage());

    // Visual cards link the entire card to the event page
    const eventLink = screen.getByRole("link", { name: /Finalized Event/i });
    expect(eventLink).toBeInTheDocument();
    expect(eventLink).toHaveAttribute("href", "/event/finalized-event");
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

  it("renders hero section", async () => {
    (
      mockGetActiveEvent as unknown as ReturnType<typeof vi.fn> & {
        (): Promise<import("@/lib/db").Event | null>;
      }
    ).mockResolvedValue(null);
    mockGetUpcomingEvents.mockResolvedValue([]);
    mockGetPastEvents.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByText("Battle of the Tech Bands")).toBeInTheDocument();
  });
});
