import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ResultsPage from "../page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock the database functions
vi.mock("@/lib/db", () => ({
  getEventById: vi.fn(),
  getBandsForEvent: vi.fn(),
  getBandScores: vi.fn(),
}));

// Mock the date utils
vi.mock("@/lib/date-utils", () => ({
  formatEventDate: vi.fn((date) => `Formatted: ${date}`),
}));

import { getEventById, getBandsForEvent, getBandScores } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

const mockGetEventById = getEventById as unknown as ReturnType<typeof vi.fn>;
const mockGetBandsForEvent = getBandsForEvent as unknown as ReturnType<typeof vi.fn>;
const mockGetBandScores = getBandScores as unknown as ReturnType<typeof vi.fn>;
const mockNotFound = notFound as unknown as ReturnType<typeof vi.fn>;
const mockRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

describe("ResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(
      screen.getByRole("heading", { name: "Battle Results" })
    ).toBeInTheDocument();
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return (
          element?.textContent ===
          "Formatted: 2024-12-25T18:30:00Z • Test Venue"
        );
      })
    ).toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", { name: "Overall Winner" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Winning Band" })
    ).toHaveLength(2);
    expect(screen.getByText("73.0 points")).toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", { name: "Song Choice" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Performance" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Crowd Vibe" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Crowd Vote" })
    ).toBeInTheDocument();
  });

  it("displays complete results table", async () => {
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

    expect(
      screen.getByRole("heading", { name: "Complete Results" })
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Rank")).toBeInTheDocument();
    expect(screen.getByText("Band")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Song Choice" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Performance" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Crowd Vibe" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Crowd Vote Score" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "#Votes" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Crowd Noise" })
    ).toBeInTheDocument();
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

    expect(screen.getByText("👥 Total voters: 50")).toBeInTheDocument();
  });

  it("displays only crowd vote count in votes column", async () => {
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

    // Should show only crowd vote count in the #Votes column (lighter text)
    const votesColumn = screen.getByRole("table").querySelector('td[class*="text-gray-400"]');
    expect(votesColumn).toHaveTextContent("10");
    // Should NOT show the old format with judge votes
    expect(screen.queryByText("3J")).not.toBeInTheDocument();
    expect(screen.queryByText("10C")).not.toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", { name: "No Results Yet" })
    ).toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", { name: "Individual Band Breakdowns" })
    ).toBeInTheDocument();

    const band1Link = screen.getByRole("link", { name: /Band 1/ });
    const band2Link = screen.getByRole("link", { name: /Band 2/ });

    expect(band1Link).toHaveAttribute("href", "/band/band-1");
    expect(band2Link).toHaveAttribute("href", "/band/band-2");
  });
});
