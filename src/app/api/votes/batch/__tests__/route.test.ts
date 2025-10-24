// @vitest-environment node

import { vi } from "vitest";
import { createRequest } from "node-mocks-http";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote, getEventById } from "@/lib/db";

// Mock the database functions
vi.mock("@/lib/db", () => ({
  submitVote: vi.fn(),
  getEventById: vi.fn(),
}));

// Mock the auth function
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock the database query
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

// Mock NextResponse.json
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, init) => {
      const response = {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: new Headers(init?.headers),
        ...init,
      };
      return response;
    }),
  },
}));

const mockSubmitVote = submitVote as ReturnType<typeof vi.fn>;
const mockGetEventById = getEventById as ReturnType<typeof vi.fn>;

// Import and mock auth
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// Import and mock sql
import { sql } from "@vercel/postgres";
const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

// Helper function to create NextRequest mock
function createNextRequestMock(
  voteData: { votes: Record<string, unknown>[] },
  headers: Record<string, string> = {}
) {
  const request = createRequest({
    method: "POST",
    url: "/api/votes/batch",
    body: voteData,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  // Add required NextRequest properties
  request.json = vi.fn().mockResolvedValue(voteData);

  return request as unknown as NextRequest;
}

describe("/api/votes/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth to return an admin user
    mockAuth.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        isAdmin: true,
      },
    });

    // Mock sql to return no existing votes by default
    mockSql.mockResolvedValue({
      rows: [{ count: 0 }],
    });

    // Mock getEventById to return a voting event by default
    mockGetEventById.mockResolvedValue({
      id: "event-1",
      name: "Test Event",
      status: "voting",
      is_active: true,
    });
  });

  describe("POST", () => {
    it("submits batch votes successfully", async () => {
      const voteData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            name: "Judge 1",
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
          {
            event_id: "event-1",
            band_id: "band-2",
            voter_type: "judge" as const,
            name: "Judge 1",
            song_choice: 12,
            performance: 20,
            crowd_vibe: 18,
          },
        ],
      };

      const mockVotes = voteData.votes.map((vote, index) => ({
        id: `vote-${index + 1}`,
        ...vote,
        created_at: "2024-01-01T00:00:00Z",
      }));

      mockSubmitVote.mockResolvedValue(mockVotes[0]);
      mockSubmitVote.mockResolvedValueOnce(mockVotes[0]);
      mockSubmitVote.mockResolvedValueOnce(mockVotes[1]);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSubmitVote).toHaveBeenCalledTimes(2);

      const data = await response.json();
      expect(data).toEqual({ votes: mockVotes });
    });

    it("returns 400 for invalid votes data", async () => {
      const voteData = { votes: "invalid" };

      const request = createRequest({
        method: "POST",
        url: "/api/votes/batch",
        body: voteData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Add required NextRequest properties
      request.json = vi.fn().mockResolvedValue(voteData);

      const response = await POST(request as unknown as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: "Invalid votes data" });
    });

    it("returns empty array for no votes", async () => {
      const voteData = { votes: [] };

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ votes: [] });
    });

    it("returns 409 for duplicate judge votes", async () => {
      const voteData = {
        votes: [
          {
            event_id: "event-1",
            band_id: "band-1",
            voter_type: "judge" as const,
            name: "Judge 1",
            song_choice: 15,
            performance: 25,
            crowd_vibe: 20,
          },
        ],
      };

      // Mock that judge has already voted
      mockSql.mockResolvedValue({
        rows: [{ count: 1 }],
      });

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data).toEqual({
        error: "Already recorded a vote for judge: Judge 1",
      });
    });

    describe("Event Status Validation", () => {
      it("returns 404 when event is not found", async () => {
        const voteData = {
          votes: [
            {
              event_id: "nonexistent-event",
              band_id: "band-1",
              voter_type: "judge" as const,
              name: "Judge 1",
              song_choice: 15,
              performance: 25,
              crowd_vibe: 20,
            },
          ],
        };

        mockGetEventById.mockResolvedValue(null);

        const request = createNextRequestMock(voteData);
        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toEqual({ error: "Event not found" });
        expect(mockSubmitVote).not.toHaveBeenCalled();
      });

      it("returns 403 when event status is 'upcoming'", async () => {
        const voteData = {
          votes: [
            {
              event_id: "upcoming-event",
              band_id: "band-1",
              voter_type: "judge" as const,
              name: "Judge 1",
              song_choice: 15,
              performance: 25,
              crowd_vibe: 20,
            },
          ],
        };

        mockGetEventById.mockResolvedValue({
          id: "upcoming-event",
          name: "Upcoming Event",
          status: "upcoming",
          is_active: false,
        });

        const request = createNextRequestMock(voteData);
        const response = await POST(request);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data).toEqual({
          error: "Voting is not currently open for this event",
          eventStatus: "upcoming",
        });
        expect(mockSubmitVote).not.toHaveBeenCalled();
      });

      it("returns 403 when event status is 'finalized'", async () => {
        const voteData = {
          votes: [
            {
              event_id: "finalized-event",
              band_id: "band-1",
              voter_type: "judge" as const,
              name: "Judge 1",
              song_choice: 15,
              performance: 25,
              crowd_vibe: 20,
            },
          ],
        };

        mockGetEventById.mockResolvedValue({
          id: "finalized-event",
          name: "Finalized Event",
          status: "finalized",
          is_active: false,
        });

        const request = createNextRequestMock(voteData);
        const response = await POST(request);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data).toEqual({
          error: "Voting is not currently open for this event",
          eventStatus: "finalized",
        });
        expect(mockSubmitVote).not.toHaveBeenCalled();
      });

      it("allows voting when event status is 'voting'", async () => {
        const voteData = {
          votes: [
            {
              event_id: "voting-event",
              band_id: "band-1",
              voter_type: "judge" as const,
              name: "Judge 1",
              song_choice: 15,
              performance: 25,
              crowd_vibe: 20,
            },
          ],
        };

        mockGetEventById.mockResolvedValue({
          id: "voting-event",
          name: "Voting Event",
          status: "voting",
          is_active: true,
        });

        const mockVote = {
          id: "vote-1",
          ...voteData.votes[0],
          created_at: "2024-01-01T00:00:00Z",
        };

        mockSubmitVote.mockResolvedValue(mockVote);

        const request = createNextRequestMock(voteData);
        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockSubmitVote).toHaveBeenCalled();
      });
    });
  });
});
