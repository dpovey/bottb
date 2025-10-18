// import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote, updateVote as _updateVote } from "@/lib/db";
import { sql } from "@vercel/postgres";
import { createMockRequest } from "@/__tests__/utils/api-test-helpers";

// Mock the database functions
jest.mock("@/lib/db", () => ({
  submitVote: jest.fn(),
  updateVote: jest.fn(),
}));

// Mock user context functions
jest.mock("@/lib/user-context", () => ({
  extractUserContext: jest.fn(() => ({
    ip_address: "127.0.0.1",
    user_agent: "test-agent",
    vote_fingerprint: "test-fingerprint",
  })),
  hasUserVoted: jest.fn(() => Promise.resolve(false)),
  hasUserVotedByFingerprintJS: jest.fn(() => Promise.resolve(false)),
}));

// Mock the database query
jest.mock("@/vercel/postgres", () => ({
  sql: jest.fn(),
}));

// Mock NextResponse to handle cookie setting properly
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: jest.fn((data, init) => {
        const response = actual.NextResponse.json(data, init);
        // Mock cookies methods by overriding the response object
        Object.defineProperty(response, "cookies", {
          value: {
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
          },
          writable: true,
          configurable: true,
        });
        return response;
      }),
    },
  };
});

const mockSubmitVote = submitVote as jest.MockedFunction<typeof submitVote>;
const mockSql = sql as jest.MockedFunction<typeof sql>;

describe("/api/votes (Protected)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the band name query
    mockSql.mockImplementation(() =>
      Promise.resolve({
        rows: [{ name: "Test Band" }],
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        fields: [],
      })
    );
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

      const request = createMockRequest("http://localhost/api/votes", {
        method: "POST",
        body: voteData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
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
      expect(data).toEqual(mockVote);
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
      const requests = Array.from({ length: 11 }, (_, _i) =>
        createMockRequest("http://localhost/api/votes", {
          method: "POST",
          body: voteData,
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(
        requests.map((req) => POST(req))
      );

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

      const request = createMockRequest("http://localhost/api/votes", {
        method: "POST",
        body: voteData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    });

    it("returns 500 when database error occurs", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      mockSubmitVote.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("http://localhost/api/votes", {
        method: "POST",
        body: voteData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit vote" });
    });
  });
});

