import { NextRequest } from "next/server";
import { POST } from "../route";
import { submitVote } from "@/lib/db";

// Mock the database function
jest.mock("@/lib/db", () => ({
  submitVote: jest.fn(),
}));

const mockSubmitVote = submitVote as jest.MockedFunction<typeof submitVote>;

describe("/api/votes/batch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST", () => {
    it("submits multiple votes successfully", async () => {
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

      const request = new NextRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: JSON.stringify(votesData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(mockSubmitVote).toHaveBeenCalledTimes(2);
      expect(mockSubmitVote).toHaveBeenCalledWith(votesData.votes[0]);
      expect(mockSubmitVote).toHaveBeenCalledWith(votesData.votes[1]);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ votes: mockVotes });
    });

    it("returns 500 when database error occurs", async () => {
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

      const request = new NextRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: JSON.stringify(votesData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit votes" });
    });

    it("handles empty votes array", async () => {
      const votesData = { votes: [] };

      const request = new NextRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: JSON.stringify(votesData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(mockSubmitVote).not.toHaveBeenCalled();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ votes: [] });
    });

    it("handles invalid JSON gracefully", async () => {
      const request = new NextRequest("http://localhost/api/votes/batch", {
        method: "POST",
        body: "invalid json",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to submit votes" });
    });
  });
});
