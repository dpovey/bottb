// @vitest-environment node

import { vi } from "vitest";
import { createRequest } from "node-mocks-http";
import { NextRequest } from "next/server";
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
  hasUserVotedByEmail: vi.fn(),
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

// Helper function to create NextRequest mock
function createNextRequestMock(
  voteData: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const request = createRequest({
    method: "POST",
    url: "/api/votes",
    body: voteData,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  // Add required NextRequest properties
  request.json = vi.fn().mockResolvedValue(voteData);
  request.cookies = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  };

  return request as unknown as NextRequest;
}

describe("/api/votes (Protected)", () => {
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
    it("submits a vote successfully with rate limiting", async () => {
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

      const request = createNextRequestMock(voteData, {
        "X-Forwarded-For": "127.0.0.1",
        "User-Agent": "test-agent",
      });

      const response = await POST(request);

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
      expect(data).toEqual({
        ...mockVote,
        message: "Vote submitted successfully",
        status: "approved",
        duplicateDetected: false,
      });
    });

    it("handles rate limiting correctly", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      mockSubmitVote.mockResolvedValue({
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      });

      // Make 11 requests (exceeding the 10/min vote limit)
      const requests = Array.from({ length: 11 }, (_, _i) => {
        return createNextRequestMock(voteData, {
          "X-Forwarded-For": "192.168.1.1",
          "User-Agent": "TestAgent",
        });
      });

      const responses = await Promise.all(requests.map((req) => POST(req)));

      // First 10 should succeed
      for (let i = 0; i < 10; i++) {
        expect(responses[i].status).toBe(200);
      }

      // 11th should be rate limited
      const lastResponse = responses[10];
      expect(lastResponse.status).toBe(429);

      const data = await lastResponse.json();
      expect(data.error).toBe("Too many requests");
      expect(data.limit).toBe(10);
      expect(data.retryAfter).toBeDefined();
    });

    it("includes rate limit headers", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      mockSubmitVote.mockResolvedValue({
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      });

      const request = createNextRequestMock(voteData, {
        "X-Forwarded-For": "127.0.0.1",
        "User-Agent": "test-agent",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    });

    it("returns 500 when database error occurs", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      // Mock the user context functions to return false for duplicate checks
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      // Mock submitVote to throw an error
      mockSubmitVote.mockRejectedValue(new Error("Database error"));

      const request = createNextRequestMock(voteData, {
        "X-Forwarded-For": "127.0.0.1",
        "User-Agent": "test-agent",
      });

      const response = await POST(request);

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
  });
});
