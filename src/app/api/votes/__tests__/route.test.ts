import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote } from "@/lib/db";

// Mock the database function
jest.mock("@/lib/db", () => ({
  submitVote: jest.fn(),
}));

const mockSubmitVote = submitVote as jest.MockedFunction<typeof submitVote>;

describe("/api/votes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(mockSubmitVote).toHaveBeenCalledWith(voteData);
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

      expect(mockSubmitVote).toHaveBeenCalledWith(voteData);
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
