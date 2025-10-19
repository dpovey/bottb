// @vitest-environment node

import { vi } from "vitest";
import { createRequest } from "node-mocks-http";
import { POST } from "../route";
import { submitVote, updateVote as _updateVote } from "@/lib/db";
import {
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from "@/lib/user-context-server";

// Mock the database functions
vi.mock("@/lib/db", () => ({
  submitVote: vi.fn(),
  updateVote: vi.fn(),
}));

// Mock user context functions
vi.mock("@/lib/user-context-server", () => ({
  extractUserContext: vi.fn(() => ({
    ip_address: "127.0.0.1",
    user_agent: "test-agent",
    vote_fingerprint: "test-fingerprint",
  })),
  hasUserVoted: vi.fn(() => Promise.resolve(false)),
  hasUserVotedByFingerprintJS: vi.fn(() => Promise.resolve(false)),
}));

// Mock the database query for band name lookup
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

// Mock NextResponse.json to return a response with cookies
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, init) => {
      const response = {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: new Headers(init?.headers),
        cookies: {
          set: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
        },
        ...init,
      };
      return response;
    }),
  },
}));

const mockSubmitVote = submitVote as ReturnType<typeof vi.fn>;
const mockHasUserVoted = hasUserVoted as ReturnType<typeof vi.fn>;
const mockHasUserVotedByFingerprintJS =
  hasUserVotedByFingerprintJS as ReturnType<typeof vi.fn>;

// Import sql after mocking
import { sql } from "@vercel/postgres";
const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

describe("/api/votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the band name query
    mockSql.mockResolvedValue({
      rows: [{ name: "Test Band" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
  });

  describe("POST", () => {
    it("submits a vote successfully", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);

      const request = createRequest({
        method: "POST",
        url: "/api/votes",
        body: voteData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Add json() method to the mock request
      request.json = vi.fn().mockResolvedValue(voteData);

      // Add cookies property to the mock request
      request.cookies = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const response = await POST(request as unknown as Request);

      expect(mockSubmitVote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...voteData,
          ip_address: "127.0.0.1",
          user_agent: "test-agent",
          vote_fingerprint: "test-fingerprint",
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockVote);
    });

    it("submits a judge vote successfully", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "judge" as const,
        song_choice: 15,
        performance: 25,
        crowd_vibe: 20,
        crowd_vote: undefined,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);

      const request = createRequest({
        method: "POST",
        url: "/api/votes",
        body: voteData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Add json() method to the mock request
      request.json = vi.fn().mockResolvedValue(voteData);

      // Add cookies property to the mock request
      request.cookies = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const response = await POST(request as unknown as Request);

      expect(mockSubmitVote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...voteData,
          ip_address: "127.0.0.1",
          user_agent: "test-agent",
          vote_fingerprint: "test-fingerprint",
        })
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockVote);
    });

    it("returns 500 when database error occurs", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd",
        crowd_vote: 20,
      };

      // Mock the user context functions to return false for duplicate checks
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      // Mock submitVote to throw an error
      mockSubmitVote.mockRejectedValue(new Error("Database error"));

      const request = createRequest({
        method: "POST",
        url: "/api/votes",
        body: voteData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Add json() method to the mock request
      request.json = vi.fn().mockResolvedValue(voteData);

      // Add cookies property to the mock request
      request.cookies = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit vote" });

      // Assert that console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error submitting vote:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("prevents duplicate votes from same user", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
      };

      // Mock that user has already voted
      mockHasUserVoted.mockResolvedValue(true);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(true);

      const request = createRequest({
        method: "POST",
        url: "/api/votes",
        body: voteData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      request.json = vi.fn().mockResolvedValue(voteData);
      request.cookies = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data).toEqual({ error: "You have already voted for this event" });
      expect(mockSubmitVote).not.toHaveBeenCalled();
    });
  });
});
