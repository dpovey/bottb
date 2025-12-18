import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as db from "@/lib/db";

// Mock the database functions
vi.mock("@/lib/db", () => ({
  getPhotos: vi.fn(),
  getPhotoCount: vi.fn(),
  getDistinctPhotographers: vi.fn(),
  getDistinctCompanies: vi.fn(),
  getAvailablePhotoFilters: vi.fn(),
}));

describe("Photos API Route - Multiple Band IDs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (searchParams: Record<string, string>) => {
    const url = new URL("http://localhost:3000/api/photos");
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  it("should parse bandIds parameter and pass to getPhotos", async () => {
    const mockPhotos = [
      {
        id: "photo1",
        band_id: "band1",
        event_id: "event1",
      },
      {
        id: "photo2",
        band_id: "band2",
        event_id: "event2",
      },
    ];

    (db.getPhotos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPhotos);
    (db.getPhotoCount as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (db.getDistinctPhotographers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getDistinctCompanies as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getAvailablePhotoFilters as ReturnType<typeof vi.fn>).mockResolvedValue({
      companies: [],
      events: [],
      bands: [],
      photographers: [],
      hasPhotosWithoutBand: false,
      hasPhotosWithoutCompany: false,
    });

    const request = createMockRequest({
      bandIds: "band1,band2",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(db.getPhotos).toHaveBeenCalledWith(
      expect.objectContaining({
        bandIds: ["band1", "band2"],
      })
    );
    expect(data.photos).toEqual(mockPhotos);
  });

  it("should handle single bandId parameter (backward compatibility)", async () => {
    const mockPhotos = [
      {
        id: "photo1",
        band_id: "band1",
        event_id: "event1",
      },
    ];

    (db.getPhotos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPhotos);
    (db.getPhotoCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (db.getDistinctPhotographers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getDistinctCompanies as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getAvailablePhotoFilters as ReturnType<typeof vi.fn>).mockResolvedValue({
      companies: [],
      events: [],
      bands: [],
      photographers: [],
      hasPhotosWithoutBand: false,
      hasPhotosWithoutCompany: false,
    });

    const request = createMockRequest({
      band: "band1",
    });

    const response = await GET(request);
    await response.json(); // Verify response is valid JSON

    expect(response.status).toBe(200);
    expect(db.getPhotos).toHaveBeenCalledWith(
      expect.objectContaining({
        bandId: "band1",
      })
    );
  });

  it("should prefer bandIds over band when both are provided", async () => {
    const mockPhotos = [
      {
        id: "photo1",
        band_id: "band1",
      },
      {
        id: "photo2",
        band_id: "band2",
      },
    ];

    (db.getPhotos as ReturnType<typeof vi.fn>).mockResolvedValue(mockPhotos);
    (db.getPhotoCount as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (db.getDistinctPhotographers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getDistinctCompanies as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getAvailablePhotoFilters as ReturnType<typeof vi.fn>).mockResolvedValue({
      companies: [],
      events: [],
      bands: [],
      photographers: [],
      hasPhotosWithoutBand: false,
      hasPhotosWithoutCompany: false,
    });

    const request = createMockRequest({
      band: "band1",
      bandIds: "band1,band2",
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(db.getPhotos).toHaveBeenCalledWith(
      expect.objectContaining({
        bandIds: ["band1", "band2"],
      })
    );
    // bandId should not be set when bandIds is provided
    const callArgs = (db.getPhotos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.bandId).toBeUndefined();
  });

  it("should pass bandIds to getPhotoCount and getAvailablePhotoFilters", async () => {
    (db.getPhotos as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getPhotoCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.getDistinctPhotographers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getDistinctCompanies as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getAvailablePhotoFilters as ReturnType<typeof vi.fn>).mockResolvedValue({
      companies: [],
      events: [],
      bands: [],
      photographers: [],
      hasPhotosWithoutBand: false,
      hasPhotosWithoutCompany: false,
    });

    const request = createMockRequest({
      bandIds: "band1,band2",
    });

    await GET(request);

    expect(db.getPhotoCount).toHaveBeenCalledWith(
      expect.objectContaining({
        bandIds: ["band1", "band2"],
      })
    );

    expect(db.getAvailablePhotoFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        bandIds: ["band1", "band2"],
      })
    );
  });

  it("should handle empty bandIds parameter", async () => {
    (db.getPhotos as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getPhotoCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.getDistinctPhotographers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getDistinctCompanies as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.getAvailablePhotoFilters as ReturnType<typeof vi.fn>).mockResolvedValue({
      companies: [],
      events: [],
      bands: [],
      photographers: [],
      hasPhotosWithoutBand: false,
      hasPhotosWithoutCompany: false,
    });

    const request = createMockRequest({
      bandIds: "",
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Empty bandIds should result in undefined
    const callArgs = (db.getPhotos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.bandIds).toBeUndefined();
  });
});

