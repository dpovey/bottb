// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the database functions BEFORE importing the route
vi.mock("@/lib/db", () => ({
  getAllSongs: vi.fn(),
  getSongCount: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";
import { getAllSongs, getSongCount } from "@/lib/db";

const mockGetAllSongs = getAllSongs as ReturnType<typeof vi.fn>;
const mockGetSongCount = getSongCount as ReturnType<typeof vi.fn>;

describe("/api/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    const mockSongs = [
      {
        id: "song-1",
        band_id: "band-1",
        position: 1,
        song_type: "cover",
        title: "Africa",
        artist: "Toto",
        additional_songs: [],
        transition_to_title: null,
        transition_to_artist: null,
        youtube_video_id: "abc123",
        status: "locked",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        band_name: "Bandlassian",
        event_id: "event-1",
        event_name: "Sydney 2024",
        event_date: "2024-03-15T18:00:00Z",
        company_slug: "atlassian",
        company_name: "Atlassian",
      },
      {
        id: "song-2",
        band_id: "band-2",
        position: 1,
        song_type: "mashup",
        title: "Super Freaky Girl",
        artist: "Nicki Minaj",
        additional_songs: [{ title: "Call Me Maybe", artist: "Carly Rae Jepsen" }],
        transition_to_title: null,
        transition_to_artist: null,
        youtube_video_id: null,
        status: "locked",
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        band_name: "Canvaband",
        event_id: "event-1",
        event_name: "Sydney 2024",
        event_date: "2024-03-15T18:00:00Z",
        company_slug: "canva",
        company_name: "Canva",
      },
      {
        id: "song-3",
        band_id: "band-1",
        position: 2,
        song_type: "transition",
        title: "If You Were the Rain",
        artist: "Original",
        additional_songs: [],
        transition_to_title: "Umbrella",
        transition_to_artist: "Rihanna",
        youtube_video_id: null,
        status: "locked",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        band_name: "Bandlassian",
        event_id: "event-1",
        event_name: "Sydney 2024",
        event_date: "2024-03-15T18:00:00Z",
        company_slug: "atlassian",
        company_name: "Atlassian",
      },
    ];

    it("returns all songs with pagination", async () => {
      mockGetAllSongs.mockResolvedValue(mockSongs);
      mockGetSongCount.mockResolvedValue(3);

      const request = new NextRequest(new URL("http://localhost/api/songs"));
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.songs).toHaveLength(3);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1,
      });
    });

    it("filters songs by event", async () => {
      mockGetAllSongs.mockResolvedValue(mockSongs);
      mockGetSongCount.mockResolvedValue(3);

      const request = new NextRequest(new URL("http://localhost/api/songs?event=event-1"));
      const response = await GET(request);

      expect(mockGetAllSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
        })
      );

      expect(response.status).toBe(200);
    });

    it("filters songs by song type", async () => {
      const mashupSongs = mockSongs.filter((s) => s.song_type === "mashup");
      mockGetAllSongs.mockResolvedValue(mashupSongs);
      mockGetSongCount.mockResolvedValue(1);

      const request = new NextRequest(new URL("http://localhost/api/songs?type=mashup"));
      const response = await GET(request);

      expect(mockGetAllSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          songType: "mashup",
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.songs).toHaveLength(1);
      expect(data.songs[0].song_type).toBe("mashup");
    });

    it("filters songs by search term", async () => {
      const africaSongs = mockSongs.filter((s) => s.title === "Africa");
      mockGetAllSongs.mockResolvedValue(africaSongs);
      mockGetSongCount.mockResolvedValue(1);

      const request = new NextRequest(new URL("http://localhost/api/songs?search=Africa"));
      const response = await GET(request);

      expect(mockGetAllSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Africa",
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.songs).toHaveLength(1);
      expect(data.songs[0].title).toBe("Africa");
    });

    it("supports pagination", async () => {
      mockGetAllSongs.mockResolvedValue(mockSongs.slice(0, 2));
      mockGetSongCount.mockResolvedValue(100);

      const request = new NextRequest(new URL("http://localhost/api/songs?page=2&limit=2"));
      const response = await GET(request);

      expect(mockGetAllSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 2,
          offset: 2, // (page 2 - 1) * limit 2
        })
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 100,
        totalPages: 50,
      });
    });

    it("validates song type parameter", async () => {
      const request = new NextRequest(new URL("http://localhost/api/songs?type=invalid"));
      const response = await GET(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("Invalid type");
    });

    it("returns filter options in response", async () => {
      mockGetAllSongs.mockResolvedValue(mockSongs);
      mockGetSongCount.mockResolvedValue(3);

      const request = new NextRequest(new URL("http://localhost/api/songs"));
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.filters).toBeDefined();
      expect(data.filters.events).toBeInstanceOf(Array);
      expect(data.filters.bands).toBeInstanceOf(Array);
      expect(data.filters.types).toBeInstanceOf(Array);
    });

    it("returns 500 when database error occurs", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockGetAllSongs.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(new URL("http://localhost/api/songs"));
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({ error: "Failed to fetch songs" });

      consoleSpy.mockRestore();
    });
  });
});
