import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote, updateVote as _updateVote } from "@/lib/db";
import { sql } from "@vercel/postgres";

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
jest.mock("@vercel/postgres", () => ({
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

describe("/api/votes", () => {
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

      const request = new NextRequest("http://localhost/api/votes", {
        method: "POST",
        body: JSON.stringify(voteData),
        headers: {
          "Content-Type": "application/json",
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

      const request = new NextRequest("http://localhost/api/votes", {
        method: "POST",
        body: JSON.stringify(voteData),
        headers: {
          "Content-Type": "application/json",
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

    it("returns 500 when database error occurs", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd",
        crowd_vote: 20,
      };

      mockSubmitVote.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost/api/votes", {
        method: "POST",
        body: JSON.stringify(voteData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit vote" });
    });

    it("handles invalid JSON gracefully", async () => {
      const request = new NextRequest("http://localhost/api/votes", {
        method: "POST",
        body: "invalid json",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit vote" });
    });
  });
});
