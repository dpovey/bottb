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
  getEventById: vi.fn(),
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

// Import and mock hasUserVotedByEmail and getEventById
import { hasUserVotedByEmail, getEventById } from "@/lib/db";
const mockHasUserVotedByEmail = hasUserVotedByEmail as ReturnType<typeof vi.fn>;
const mockGetEventById = getEventById as ReturnType<typeof vi.fn>;

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

describe("Vote API Response Format", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getEventById to return a voting event by default
    mockGetEventById.mockResolvedValue({
      id: "event-1",
      name: "Test Event",
      status: "voting",
      is_active: true,
    });

    // Mock the band name query
    mockSql.mockResolvedValue({
      rows: [{ name: "Test Band" }],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });
  });

  describe("Crowd Voting Response Format", () => {
    it("returns success response with all required fields for crowd vote", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
        email: "test@example.com",
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        ...mockVote,
        message: "Vote submitted successfully",
        status: "approved",
        duplicateDetected: false,
      });
    });

    it("returns pending response for duplicate crowd vote with email", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
        email: "test@example.com",
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(true); // Duplicate by email
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(201); // Created but needs review
      const data = await response.json();

      expect(data).toEqual({
        ...mockVote,
        message:
          "Duplicate vote detected. Your vote has been recorded and will be reviewed for approval.",
        status: "pending",
        duplicateDetected: true,
      });
    });

    it("returns error response for duplicate crowd vote without email", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(true); // Duplicate by fingerprint
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(400); // Bad request - needs email
      const data = await response.json();

      expect(data).toEqual({
        ...mockVote,
        message:
          "Duplicate vote detected. Please provide an email address to submit your vote for review.",
        status: "pending",
        duplicateDetected: true,
      });
    });
  });

  describe("Judge Voting Response Format", () => {
    it("returns success response for judge vote", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "judge" as const,
        song_choice: 15,
        performance: 25,
        crowd_vibe: 20,
        name: "Judge Smith",
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        ...mockVote,
        message: "Vote submitted successfully",
        status: "approved",
        duplicateDetected: false,
      });
    });
  });

  describe("Response Field Validation", () => {
    it("always includes message field", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      const data = await response.json();
      expect(data).toHaveProperty("message");
      expect(typeof data.message).toBe("string");
    });

    it("always includes status field", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(["approved", "pending"]).toContain(data.status);
    });

    it("always includes duplicateDetected field", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSubmitVote.mockResolvedValue(mockVote);
      mockHasUserVotedByEmail.mockResolvedValue(false);
      mockHasUserVoted.mockResolvedValue(false);
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false);

      const request = createNextRequestMock(voteData);
      const response = await POST(request);

      const data = await response.json();
      expect(data).toHaveProperty("duplicateDetected");
      expect(typeof data.duplicateDetected).toBe("boolean");
    });
  });
});
