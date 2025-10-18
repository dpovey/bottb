import { NextRequest } from "next/server";
import { GET } from "../route";
import { getBandsForEvent } from "@/lib/db";

// Mock the database function
jest.mock("@/lib/db", () => ({
  getBandsForEvent: jest.fn(),
}));

const mockGetBandsForEvent = getBandsForEvent as jest.MockedFunction<
  typeof getBandsForEvent
>;

describe("/api/bands/[eventId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns bands for event", async () => {
      const eventId = "event-1";
      const mockBands = [
        {
          id: "band-1",
          event_id: eventId,
          name: "Band 1",
          description: "Description 1",
          order: 1,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "band-2",
          event_id: eventId,
          name: "Band 2",
          description: "Description 2",
          order: 2,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockGetBandsForEvent.mockResolvedValue(mockBands);

      const request = new NextRequest(`http://localhost/api/bands/${eventId}`);
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      });

      expect(mockGetBandsForEvent).toHaveBeenCalledWith(eventId);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockBands);
    });

    it("returns empty array when no bands found", async () => {
      const eventId = "event-1";
      mockGetBandsForEvent.mockResolvedValue([]);

      const request = new NextRequest(`http://localhost/api/bands/${eventId}`);
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual([]);
    });

    it("returns 500 when database error occurs", async () => {
      const eventId = "event-1";
      mockGetBandsForEvent.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(`http://localhost/api/bands/${eventId}`);
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      });

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to fetch bands" });
    });
  });
});










