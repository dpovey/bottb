import { describe, it, expect, vi, beforeEach } from "vitest";
import { sql } from "@vercel/postgres";

// Mock the sql function
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

describe("updateEventStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should update event status successfully", async () => {
    const mockEvent = {
      id: "test-event-1",
      name: "Test Event",
      location: "Test Location",
      status: "voting" as const,
      date: "2024-01-01",
    };

    mockSql.mockResolvedValue({
      rows: [mockEvent],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const { updateEventStatus } = await import("../db");
    const result = await updateEventStatus("test-event-1", "voting");

    expect(result).toEqual(mockEvent);
    expect(mockSql).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("UPDATE events")]),
      "voting",
      "test-event-1"
    );
  });

  it("should return null when event not found", async () => {
    mockSql.mockResolvedValue({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const { updateEventStatus } = await import("../db");
    const result = await updateEventStatus("non-existent", "voting");

    expect(result).toBeNull();
  });

  it("should handle database errors", async () => {
    mockSql.mockRejectedValue(new Error("Database error"));

    const { updateEventStatus } = await import("../db");
    await expect(updateEventStatus("test-event-1", "voting")).rejects.toThrow(
      "Database error"
    );
  });

  it("should call finalizeEventResults when status is set to finalized", async () => {
    const mockEvent = {
      id: "test-event-1",
      name: "Test Event",
      location: "Test Location",
      status: "finalized" as const,
      date: "2024-01-01",
    };

    // First call: UPDATE event status
    mockSql.mockResolvedValueOnce({
      rows: [mockEvent],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    // Second call: getBandScores (called by finalizeEventResults)
    mockSql.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const { updateEventStatus } = await import("../db");
    const result = await updateEventStatus("test-event-1", "finalized");

    expect(result).toEqual(mockEvent);
    // Verify that getBandScores was called (part of finalizeEventResults)
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("should not call finalizeEventResults when status is not finalized", async () => {
    const mockEvent = {
      id: "test-event-1",
      name: "Test Event",
      location: "Test Location",
      status: "voting" as const,
      date: "2024-01-01",
    };

    mockSql.mockResolvedValue({
      rows: [mockEvent],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const { updateEventStatus } = await import("../db");
    await updateEventStatus("test-event-1", "voting");

    // Should only be called once for the UPDATE
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("should not call finalizeEventResults when event not found", async () => {
    mockSql.mockResolvedValue({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const { updateEventStatus } = await import("../db");
    await updateEventStatus("non-existent", "finalized");

    // Should only be called once for the UPDATE
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});
