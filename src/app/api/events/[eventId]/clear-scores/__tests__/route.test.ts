import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";

// Mock the database
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

// Mock the API protection
vi.mock("@/lib/api-protection", () => ({
  withAdminProtection: (handler: unknown) => handler,
}));

const { sql } = await import("@vercel/postgres");

describe("Clear Scores API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear scores for a valid event", async () => {
    const mockEvent = {
      id: "test-event",
      name: "Test Event",
      location: "Test Location",
      date: "2024-01-01",
    };

    const mockVotesDeleted = 5;
    const mockNoiseDeleted = 2;

    // Mock database responses
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [mockEvent],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: mockVotesDeleted,
      oid: 0,
      fields: [],
    });

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: "DELETE",
      rowCount: mockNoiseDeleted,
      oid: 0,
      fields: [],
    });

    const request = new NextRequest(
      "http://localhost/api/events/test-event/clear-scores",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.votesDeleted).toBe(mockVotesDeleted);
    expect(data.noiseDeleted).toBe(mockNoiseDeleted);
    expect(data.message).toContain("Test Event");
  });

  it("should return 404 for non-existent event", async () => {
    // Mock empty event result
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const request = new NextRequest(
      "http://localhost/api/events/non-existent/clear-scores",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Event not found");
  });

  it("should handle database errors", async () => {
    // Mock console.error to suppress and assert it
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock database error
    vi.mocked(sql).mockRejectedValueOnce(new Error("Database error"));

    const request = new NextRequest(
      "http://localhost/api/events/test-event/clear-scores",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to clear scores");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error clearing scores:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
