import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateEventStatus } from "../db";
import { sql } from "@vercel/postgres";

// Mock the sql function
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

describe("updateEventStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update event status successfully", async () => {
    const mockEvent = {
      id: "test-event-1",
      name: "Test Event",
      location: "Test Location",
      status: "voting" as const,
      date: "2024-01-01",
    };

    vi.mocked(sql).mockResolvedValue({
      rows: [mockEvent],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    } as { rows: (typeof mockEvent)[]; command: string; rowCount: number; oid: number; fields: never[] });

    const result = await updateEventStatus("test-event-1", "voting");

    expect(result).toEqual(mockEvent);
    expect(sql).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("UPDATE events")]),
      "voting",
      "test-event-1"
    );
  });

  it("should return null when event not found", async () => {
    vi.mocked(sql).mockResolvedValue({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    } as { rows: never[]; command: string; rowCount: number; oid: number; fields: never[] });

    const result = await updateEventStatus("non-existent", "voting");

    expect(result).toBeNull();
  });

  it("should handle database errors", async () => {
    vi.mocked(sql).mockRejectedValue(new Error("Database error"));

    await expect(updateEventStatus("test-event-1", "voting")).rejects.toThrow(
      "Database error"
    );
  });
});
