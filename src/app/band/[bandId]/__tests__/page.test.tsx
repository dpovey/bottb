import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import BandPage from "../page";

// Helper function to create a proper QueryResult mock
const createMockQueryResult = <T,>(rows: T[]) => ({
  rows,
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
});

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock the database functions
vi.mock("@/lib/db", () => ({
  getBandScores: vi.fn(),
}));

// Mock the date utils
vi.mock("@/lib/date-utils", () => ({
  formatEventDate: vi.fn((date) => `Formatted: ${date}`),
}));

// Mock @vercel/postgres
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { getBandScores } from "@/lib/db";
import { notFound } from "next/navigation";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

const mockGetBandScores = getBandScores as unknown as ReturnType<typeof vi.fn>;
const mockNotFound = notFound as unknown as ReturnType<typeof vi.fn>;
const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("BandPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to non-admin user
    mockAuth.mockResolvedValue({ user: { isAdmin: false } });
  });

  it("renders band details and scores for finalized event", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        description: "A test band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(screen.getByText("Test Band")).toBeInTheDocument();
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return (
          element?.textContent ===
          "Formatted: 2024-12-25T18:30:00Z • Test Venue"
        );
      })
    ).toBeInTheDocument();
    expect(screen.getByText("A test band")).toBeInTheDocument();
  });

  it("shows event in progress message for non-admin users when event is not finalized", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        description: "A test band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "upcoming",
      },
    ];

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockAuth.mockResolvedValue({ user: { isAdmin: false } });

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(screen.getByText("Test Band")).toBeInTheDocument();
    expect(screen.getByText("Event Upcoming")).toBeInTheDocument();
    expect(
      screen.getByText("Scores will be available after the event is finalized")
    ).toBeInTheDocument();
    // Should not show scores
    expect(screen.queryByText("Total Score")).not.toBeInTheDocument();
  });

  it("shows scores for admin users even when event is not finalized", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        description: "A test band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "upcoming",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);
    mockAuth.mockResolvedValue({ user: { isAdmin: true } });

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(screen.getByText("Test Band")).toBeInTheDocument();
    expect(screen.getByText("Total Score")).toBeInTheDocument();
    expect(screen.queryByText("Event Upcoming")).not.toBeInTheDocument();
  });

  it("displays total score", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(
      screen.getByRole("heading", { name: "Total Score" })
    ).toBeInTheDocument();
    expect(screen.getByText("73.0")).toBeInTheDocument();
    expect(screen.getByText("out of 100 points")).toBeInTheDocument();
  });

  it("displays judge scores breakdown", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(
      screen.getByRole("heading", { name: "Judge Scores" })
    ).toBeInTheDocument();
    expect(screen.getByText("Song Choice")).toBeInTheDocument();
    expect(screen.getByText("15.5/20")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("25.0/30")).toBeInTheDocument();
    expect(screen.getByText("Crowd Vibe")).toBeInTheDocument();
    expect(screen.getByText("22.5/30")).toBeInTheDocument();
  });

  it("displays crowd vote section", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(
      screen.getByRole("heading", { name: "Crowd Vote" })
    ).toBeInTheDocument();
    expect(screen.getByText("10/10")).toBeInTheDocument();
    expect(screen.getByText("Vote Statistics")).toBeInTheDocument();
    expect(screen.getByText("Judge Votes:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Crowd Votes:")).toBeInTheDocument();
    expect(screen.getAllByText("10")).toHaveLength(2);
  });

  it("displays score summary", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(
      screen.getByRole("heading", { name: "Score Summary" })
    ).toBeInTheDocument();
    expect(screen.getByText("Judge Score Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Song Choice (20%):")).toBeInTheDocument();
    expect(screen.getByText("15.5")).toBeInTheDocument();
    expect(screen.getByText("Performance (30%):")).toBeInTheDocument();
    expect(screen.getByText("25.0")).toBeInTheDocument();
    expect(screen.getByText("Crowd Vibe (30%):")).toBeInTheDocument();
    expect(screen.getByText("22.5")).toBeInTheDocument();
    expect(screen.getByText("Judge Total:")).toBeInTheDocument();
    expect(screen.getByText("63.0/80")).toBeInTheDocument();
  });

  it("shows back to results link", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    const backLink = screen.getByRole("link", {
      name: "← Back to Full Results",
    });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/results/event-1");
  });

  it("shows not found when band does not exist", async () => {
    mockSql.mockResolvedValue(createMockQueryResult([]));

    try {
      await BandPage({ params: Promise.resolve({ bandId: "nonexistent" }) });
    } catch {
      // Expected to throw due to notFound() call
    }

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows not found when band score does not exist for finalized event", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        status: "finalized",
      },
    ];

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue([]);

    try {
      await BandPage({ params: Promise.resolve({ bandId: "band-1" }) });
    } catch {
      // Expected to throw due to notFound() call
    }

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("handles missing description gracefully", async () => {
    const bandData = [
      {
        id: "band-1",
        event_id: "event-1",
        name: "Test Band",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        event_name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
      },
    ];

    const bandScores = [
      {
        id: "band-1",
        name: "Test Band",
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

    mockSql.mockResolvedValue(createMockQueryResult(bandData));
    mockGetBandScores.mockResolvedValue(bandScores);

    render(await BandPage({ params: Promise.resolve({ bandId: "band-1" }) }));

    expect(screen.getByText("Test Band")).toBeInTheDocument();
    expect(screen.queryByText("A test band")).not.toBeInTheDocument();
  });
});
