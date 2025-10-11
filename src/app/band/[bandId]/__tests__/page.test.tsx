import { render, screen } from "@testing-library/react";
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
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

// Mock the database functions
jest.mock("@/lib/db", () => ({
  getBandScores: jest.fn(),
}));

// Mock the date utils
jest.mock("@/lib/date-utils", () => ({
  formatEventDate: jest.fn((date) => `Formatted: ${date}`),
}));

// Mock @vercel/postgres
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

import { getBandScores } from "@/lib/db";
import { notFound } from "next/navigation";
import { sql } from "@vercel/postgres";

const mockGetBandScores = getBandScores as jest.MockedFunction<
  typeof getBandScores
>;
const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;
const mockSql = sql as jest.MockedFunction<typeof sql>;

describe("BandPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders band details and scores", async () => {
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
    expect(screen.getByText("67.0")).toBeInTheDocument();
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
    expect(screen.getByText("4/20")).toBeInTheDocument();
    expect(screen.getByText("Vote Statistics")).toBeInTheDocument();
    expect(screen.getByText("Judge Votes:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Crowd Votes:")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
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

  it("shows not found when band score does not exist", async () => {
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
