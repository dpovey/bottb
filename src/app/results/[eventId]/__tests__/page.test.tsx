import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ResultsPage from "../page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
  signOut: vi.fn(),
}));

// Mock the database functions
vi.mock("@/lib/db", () => ({
  getEventById: vi.fn(),
  getBandsForEvent: vi.fn(),
  getBandScores: vi.fn(),
  hasFinalizedResults: vi.fn(),
  getFinalizedResults: vi.fn(),
  getPhotosByLabel: vi.fn(),
  PHOTO_LABELS: {
    BAND_HERO: "band_hero",
    EVENT_HERO: "event_hero",
    GLOBAL_HERO: "global_hero",
  },
}));

// Mock the date utils
vi.mock("@/lib/date-utils", () => ({
  formatEventDate: vi.fn((date) => `Formatted: ${date}`),
}));

import {
  getEventById,
  getBandsForEvent,
  getBandScores,
  hasFinalizedResults,
  getFinalizedResults,
  getPhotosByLabel,
} from "@/lib/db";
import { notFound, redirect } from "next/navigation";

const mockGetEventById = getEventById as unknown as ReturnType<typeof vi.fn>;
const mockGetBandsForEvent = getBandsForEvent as unknown as ReturnType<
  typeof vi.fn
>;
const mockGetBandScores = getBandScores as unknown as ReturnType<typeof vi.fn>;
const mockHasFinalizedResults = hasFinalizedResults as unknown as ReturnType<
  typeof vi.fn
>;
const mockGetFinalizedResults = getFinalizedResults as unknown as ReturnType<
  typeof vi.fn
>;
const mockGetPhotosByLabel = getPhotosByLabel as unknown as ReturnType<typeof vi.fn>;
const mockNotFound = notFound as unknown as ReturnType<typeof vi.fn>;
const mockRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

describe("ResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no finalized results, use dynamic calculation
    mockHasFinalizedResults.mockResolvedValue(false);
    mockGetFinalizedResults.mockResolvedValue([]);
    mockGetPhotosByLabel.mockResolvedValue([]);
  });

  it("redirects non-finalized events to crowd voting", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: true,
      status: "voting" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue([]);
    mockGetBandScores.mockResolvedValue([]);

    await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) });

    expect(mockRedirect).toHaveBeenCalledWith("/vote/crowd/event-1");
  });

  it("shows not found when event does not exist", async () => {
    (mockGetEventById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    try {
      await ResultsPage({
        params: Promise.resolve({ eventId: "nonexistent" }),
      });
    } catch {
      // Expected to throw due to notFound() call
    }

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders results for finalized event", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Band 1",
        description: "Description 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "event-1",
        name: "Band 2",
        description: "Description 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Band 1",
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
        name: "Band 2",
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ];

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    // Check for page title (section heading)
    expect(screen.getByText("Battle Results")).toBeInTheDocument();
    // Event name appears in breadcrumbs and title
    expect(screen.getAllByText("Test Event").length).toBeGreaterThan(0);
  });

  it("displays overall winner", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
      info: { scoring_version: "2025.1" },
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Winning Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
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

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    // Check for champion badge
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Winning Band" })
    ).toHaveLength(2);
    // Score appears in multiple places - check at least one exists
    expect(screen.getAllByText("73.0").length).toBeGreaterThan(0);
    expect(screen.getByText(/100 points/)).toBeInTheDocument();
  });

  it("displays category winners", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
      info: { scoring_version: "2025.1" },
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Band 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "event-1",
        name: "Band 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Band 1",
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
        name: "Band 2",
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ];

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    // Check category winners are displayed (labels may appear in multiple places)
    expect(screen.getByText("Category Winners")).toBeInTheDocument();
    expect(screen.getAllByText("Song").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Perf").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vibe").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vote/).length).toBeGreaterThan(0);
  });

  it("displays complete results table for 2025.1 scoring", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
      info: { scoring_version: "2025.1" }, // 2025.1 has Noise column
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Band 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "event-1",
        name: "Band 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Band 1",
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
        name: "Band 2",
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ];

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    // Check for complete results section
    expect(screen.getByText("Complete Results")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Rank")).toBeInTheDocument();
    expect(screen.getByText("Band")).toBeInTheDocument();
    // Check for column headers (shortened in new design)
    expect(screen.getByRole("columnheader", { name: "Song" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Perf" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Vibe" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Vote" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Noise" })).toBeInTheDocument(); // 2025.1 has Noise
    expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("displays total voters stat in complete results", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
      info: { scoring_version: "2025.1" }, // Need scoring version to show table
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Band 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Band 1",
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

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    expect(screen.getByText(/Total voters:/)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("shows no results message when no scores available", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue([]);
    mockGetBandScores.mockResolvedValue([]);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    expect(screen.getByText("No Results Yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Voting hasn't started yet or no votes have been submitted."
      )
    ).toBeInTheDocument();
  });

  it("displays individual band links", async () => {
    const event = {
      id: "event-1",
      name: "Test Event",
      date: "2024-12-25T18:30:00Z",
      location: "Test Venue",
      is_active: false,
      status: "finalized" as const,
      created_at: "2024-01-01T00:00:00Z",
    };

    const bands = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Band 1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "band-2",
        event_id: "event-1",
        name: "Band 2",
        order: 2,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Band 1",
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
        name: "Band 2",
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ];

    mockGetEventById.mockResolvedValue(event);
    mockGetBandsForEvent.mockResolvedValue(bands);
    mockGetBandScores.mockResolvedValue(bandScores);

    render(
      await ResultsPage({ params: Promise.resolve({ eventId: "event-1" }) })
    );

    // Check for band details section
    expect(screen.getByText("Band Details")).toBeInTheDocument();

    const band1Link = screen.getByRole("link", { name: /Band 1/ });
    const band2Link = screen.getByRole("link", { name: /Band 2/ });

    expect(band1Link).toHaveAttribute("href", "/band/band-1");
    expect(band2Link).toHaveAttribute("href", "/band/band-2");
  });
});
