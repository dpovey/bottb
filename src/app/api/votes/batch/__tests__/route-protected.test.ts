// import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote, updateVote as _updateVote } from "@/lib/db";
import { sql as _sql } from "@vercel/postgres";
import { createMockRequest, mockAdminAuth, mockUserAuth, mockNoAuth } from "@/__tests__/utils/api-test-helpers";

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

describe("/api/votes/batch (Admin Protected)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST", () => {
    it("allows admin users to submit batch votes", async () => {
      mockAdminAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
          {
            event_id: "event-1",
            band_id: "band-2",
            voter_type: "judge" as const,
            song_choice: 12,
            performance: 22,
            crowd_vibe: 18,
          },
        ],
      };

      const mockVotes = [
        {
          id: "vote-1",
          ...votesData.votes[0],
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "vote-2",
          ...votesData.votes[1],
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockSubmitVote
        .mockResolvedValueOnce(mockVotes[0])
        .mockResolvedValueOnce(mockVotes[1]);

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(mockSubmitVote).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ votes: mockVotes });
    });

    it("blocks non-admin users", async () => {
      mockUserAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized - Admin access required");
      expect(mockSubmitVote).not.toHaveBeenCalled();
    });

    it("blocks unauthenticated users", async () => {
      mockNoAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized - Admin access required");
      expect(mockSubmitVote).not.toHaveBeenCalled();
    });

    it("applies rate limiting to admin requests", async () => {
      mockAdminAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      mockSubmitVote.mockResolvedValue({
        id: "vote-1",
        ...votesData.votes[0],
        created_at: "2024-01-01T00:00:00Z",
      });

      // Make 201 requests (exceeding the 200/min admin limit)
      const requests = Array.from({ length: 201 }, (_, _i) =>
        createMockRequest("http://localhost/api/votes/batch", {
          method: "POST",
          body: votesData,
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(
        requests.map((req) => POST(req))
      );

      // First 200 should succeed
      for (let i = 0; i < 200; i++) {
        expect(responses[i].status).toBe(200);
      }

      // 201st should be rate limited
      const lastResponse = responses[200];
      expect(lastResponse.status).toBe(429);
      
      const data = await lastResponse.json();
      expect(data.error).toBe("Too many requests");
      expect(data.limit).toBe(200);
      expect(data.retryAfter).toBeDefined();
    });

    it("includes rate limit headers for admin endpoints", async () => {
      mockAdminAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      mockSubmitVote.mockResolvedValue({
        id: "vote-1",
        ...votesData.votes[0],
        created_at: "2024-01-01T00:00:00Z",
      });

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("200");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    });

    it("handles empty votes array", async () => {
      mockAdminAuth();
      
      const votesData = { votes: [] };

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(mockSubmitVote).not.toHaveBeenCalled();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ votes: [] });
    });

    it("returns 500 when database error occurs", async () => {
      mockAdminAuth();
      
      const votesData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge",
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      mockSubmitVote.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: votesData,
        headers: {
          "X-Forwarded-For": "127.0.0.1",
          "User-Agent": "test-agent",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit votes" });
    });
  });
});

