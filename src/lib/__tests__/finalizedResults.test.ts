import { describe, it, expect, vi, beforeEach } from "vitest";
import { sql } from "@vercel/postgres";

// Mock the sql function
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

// Helper function to create a proper QueryResult mock
const createMockQueryResult = <T>(rows: T[]) => ({
  rows,
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
});

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

describe("Finalized Results Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to get fresh imports
    vi.resetModules();
  });

  describe("hasFinalizedResults", () => {
    it("returns true when finalized results exist", async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ count: "3" }]));

      const { hasFinalizedResults } = await import("../db");
      const result = await hasFinalizedResults("event-1");

      expect(result).toBe(true);
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining(
            "SELECT COUNT(*) as count FROM finalized_results"
          ),
        ]),
        "event-1"
      );
    });

    it("returns false when no finalized results exist", async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ count: "0" }]));

      const { hasFinalizedResults } = await import("../db");
      const result = await hasFinalizedResults("event-1");

      expect(result).toBe(false);
    });
  });

  describe("getFinalizedResults", () => {
    it("returns finalized results ordered by rank", async () => {
      const mockResults = [
        {
          id: "result-1",
          event_id: "event-1",
          band_id: "band-1",
          band_name: "Winner Band",
          final_rank: 1,
          avg_song_choice: "18.5",
          avg_performance: "27.0",
          avg_crowd_vibe: "25.0",
          crowd_vote_count: 50,
          judge_vote_count: 5,
          total_crowd_votes: 100,
          crowd_noise_score: 8,
          judge_score: "70.5",
          crowd_score: "10.0",
          total_score: "88.5",
          finalized_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "result-2",
          event_id: "event-1",
          band_id: "band-2",
          band_name: "Second Band",
          final_rank: 2,
          avg_song_choice: "15.0",
          avg_performance: "22.0",
          avg_crowd_vibe: "20.0",
          crowd_vote_count: 30,
          judge_vote_count: 5,
          total_crowd_votes: 100,
          crowd_noise_score: 6,
          judge_score: "57.0",
          crowd_score: "6.0",
          total_score: "69.0",
          finalized_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockResults));

      const { getFinalizedResults } = await import("../db");
      const result = await getFinalizedResults("event-1");

      expect(result).toEqual(mockResults);
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining("SELECT * FROM finalized_results"),
          expect.stringContaining("ORDER BY final_rank ASC"),
        ]),
        "event-1"
      );
    });

    it("returns empty array when no results exist", async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]));

      const { getFinalizedResults } = await import("../db");
      const result = await getFinalizedResults("event-1");

      expect(result).toEqual([]);
    });
  });

  describe("finalizeEventResults", () => {
    it("returns empty array when no band scores exist", async () => {
      // Mock getBandScores to return empty
      mockSql.mockResolvedValue(createMockQueryResult([]));

      const { finalizeEventResults } = await import("../db");
      const result = await finalizeEventResults("event-1");

      expect(result).toEqual([]);
    });

    it("deletes existing results before inserting new ones", async () => {
      // Mock getBandScores response
      mockSql.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "band-1",
            name: "Band 1",
            order: 1,
            avg_song_choice: "18",
            avg_performance: "27",
            avg_crowd_vibe: "25",
            crowd_vote_count: "50",
            judge_vote_count: "5",
            total_crowd_votes: "100",
            crowd_noise_energy: "0.85",
            crowd_noise_peak: "0.95",
            crowd_score: 8,
          },
        ])
      );

      // Mock DELETE
      mockSql.mockResolvedValueOnce(createMockQueryResult([]));

      // Mock INSERT
      mockSql.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "result-1",
            event_id: "event-1",
            band_id: "band-1",
            band_name: "Band 1",
            final_rank: 1,
            total_score: "88.0",
            finalized_at: "2024-01-01T00:00:00Z",
          },
        ])
      );

      const { finalizeEventResults } = await import("../db");
      const result = await finalizeEventResults("event-1");

      expect(result).toHaveLength(1);
      expect(result[0].band_name).toBe("Band 1");

      // Verify DELETE was called
      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining("DELETE FROM finalized_results"),
        ]),
        "event-1"
      );
    });

    it("assigns ranks based on total score", async () => {
      // Mock getBandScores - two bands with different scores
      mockSql.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "band-1",
            name: "Lower Score Band",
            order: 1,
            avg_song_choice: "10",
            avg_performance: "15",
            avg_crowd_vibe: "12",
            crowd_vote_count: "20",
            judge_vote_count: "3",
            total_crowd_votes: "100",
            crowd_score: 5,
          },
          {
            id: "band-2",
            name: "Higher Score Band",
            order: 2,
            avg_song_choice: "19",
            avg_performance: "28",
            avg_crowd_vibe: "27",
            crowd_vote_count: "100",
            judge_vote_count: "5",
            total_crowd_votes: "100",
            crowd_score: 9,
          },
        ])
      );

      // Mock DELETE
      mockSql.mockResolvedValueOnce(createMockQueryResult([]));

      // Mock INSERTs - band-2 should be first (higher score)
      mockSql.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "result-1",
            event_id: "event-1",
            band_id: "band-2",
            band_name: "Higher Score Band",
            final_rank: 1,
            total_score: "93.0",
            finalized_at: "2024-01-01T00:00:00Z",
          },
        ])
      );

      mockSql.mockResolvedValueOnce(
        createMockQueryResult([
          {
            id: "result-2",
            event_id: "event-1",
            band_id: "band-1",
            band_name: "Lower Score Band",
            final_rank: 2,
            total_score: "44.0",
            finalized_at: "2024-01-01T00:00:00Z",
          },
        ])
      );

      const { finalizeEventResults } = await import("../db");
      const result = await finalizeEventResults("event-1");

      expect(result).toHaveLength(2);
      // Higher Score Band should be rank 1
      expect(result[0].band_name).toBe("Higher Score Band");
      expect(result[0].final_rank).toBe(1);
      expect(result[1].band_name).toBe("Lower Score Band");
      expect(result[1].final_rank).toBe(2);
    });
  });
});
