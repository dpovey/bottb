/**
 * Tests for Meta (Facebook/Instagram) provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock getBaseUrl before importing meta
vi.mock("../linkedin", () => ({
  getBaseUrl: vi.fn(() => "http://localhost:3000"),
}));

import {
  getMetaAuthUrl,
  exchangeMetaCode,
  getLongLivedToken,
  getMetaPages,
  getInstagramAccount,
  postToFacebookPage,
  postMultipleToFacebookPage,
  postToInstagram,
  postCarouselToInstagram,
} from "../meta";

describe("Meta Provider", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    global.fetch = mockFetch;
    process.env = {
      ...originalEnv,
      META_APP_ID: "test-app-id",
      META_APP_SECRET: "test-app-secret",
    };
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe("getMetaAuthUrl", () => {
    it("generates correct OAuth URL", () => {
      const url = getMetaAuthUrl("test-state");
      
      expect(url).toContain("facebook.com");
      expect(url).toContain("dialog/oauth");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("state=test-state");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("pages_show_list");
      expect(url).toContain("instagram_content_publish");
    });

    it("throws if META_APP_ID is missing", () => {
      delete process.env.META_APP_ID;
      
      expect(() => getMetaAuthUrl("test-state")).toThrow(
        "META_APP_ID environment variable is required"
      );
    });
  });

  describe("exchangeMetaCode", () => {
    it("exchanges code for access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "short-lived-token",
            token_type: "bearer",
            expires_in: 3600,
          }),
      });

      const result = await exchangeMetaCode("auth-code");

      expect(result.access_token).toBe("short-lived-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("oauth/access_token")
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
        json: () =>
          Promise.resolve({
            error: { message: "Invalid code" },
          }),
      });

      await expect(exchangeMetaCode("bad-code")).rejects.toThrow(
        "Invalid code"
      );
    });
  });

  describe("getLongLivedToken", () => {
    it("exchanges short-lived for long-lived token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "long-lived-token",
            token_type: "bearer",
            expires_in: 5184000, // 60 days
          }),
      });

      const result = await getLongLivedToken("short-lived-token");

      expect(result.access_token).toBe("long-lived-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("fb_exchange_token=short-lived-token")
      );
    });
  });

  describe("getMetaPages", () => {
    it("fetches pages with Instagram business accounts", async () => {
      // Mock the debug endpoint call (first fetch)
      const mockDebugResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              id: "page-123",
              name: "Test Page",
              access_token: "page-token",
              instagram_business_account: { id: "ig-456" },
            },
          ],
        }),
      };
      // Mock the actual pages endpoint call (second fetch)
      const mockPagesResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
            data: [
              {
                id: "page-123",
                name: "Test Page",
                access_token: "page-token",
                instagram_business_account: { id: "ig-456" },
              },
            ],
          }),
      };
      mockFetch
        .mockResolvedValueOnce(mockDebugResponse)
        .mockResolvedValueOnce(mockPagesResponse);

      const pages = await getMetaPages("access-token");

      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe("page-123");
      expect(pages[0].instagram_business_account?.id).toBe("ig-456");
    });

    it("returns empty array if no pages", async () => {
      // Mock the debug endpoint call (first fetch)
      const mockDebugResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] }),
      };
      // Mock the actual pages endpoint call (second fetch)
      const mockPagesResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] }),
      };
      mockFetch
        .mockResolvedValueOnce(mockDebugResponse)
        .mockResolvedValueOnce(mockPagesResponse);

      const pages = await getMetaPages("access-token");

      expect(pages).toEqual([]);
    });
  });

  describe("getInstagramAccount", () => {
    it("fetches Instagram account details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "ig-456",
            username: "testband",
            name: "Test Band",
          }),
      });

      const account = await getInstagramAccount("ig-456", "access-token");

      expect(account.username).toBe("testband");
    });
  });

  describe("postToFacebookPage", () => {
    it("posts a single photo to Facebook Page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "post-789" }),
      });

      const result = await postToFacebookPage(
        "page-123",
        "page-token",
        "https://example.com/photo.jpg",
        "Great show tonight!"
      );

      expect(result.id).toBe("post-789");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page-123/photos"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on post failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Forbidden",
        json: () =>
          Promise.resolve({
            error: { message: "Insufficient permissions" },
          }),
      });

      await expect(
        postToFacebookPage(
          "page-123",
          "bad-token",
          "https://example.com/photo.jpg",
          "Caption"
        )
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("postMultipleToFacebookPage", () => {
    it("posts multiple photos as album", async () => {
      // First call: upload photo 1 as unpublished
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "photo-1" }),
      });
      // Second call: upload photo 2 as unpublished
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "photo-2" }),
      });
      // Third call: create post with attached media
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "post-789" }),
      });

      const result = await postMultipleToFacebookPage(
        "page-123",
        "page-token",
        ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        "Album caption"
      );

      expect(result.id).toBe("post-789");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("postToInstagram", () => {
    it("creates and publishes single image", async () => {
      // Create container
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "container-123" }),
      });
      // Publish
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "media-456" }),
      });

      const result = await postToInstagram(
        "ig-account",
        "access-token",
        "https://example.com/photo.jpg",
        "Instagram caption"
      );

      expect(result.id).toBe("media-456");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("postCarouselToInstagram", () => {
    it("creates carousel with multiple images", async () => {
      // Create carousel item 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "item-1" }),
      });
      // Create carousel item 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "item-2" }),
      });
      // Create carousel container
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "carousel-123" }),
      });
      // Publish
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "media-789" }),
      });

      const result = await postCarouselToInstagram(
        "ig-account",
        "access-token",
        ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        "Carousel caption"
      );

      expect(result.id).toBe("media-789");
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("throws if less than 2 images", async () => {
      await expect(
        postCarouselToInstagram(
          "ig-account",
          "access-token",
          ["https://example.com/photo1.jpg"],
          "Caption"
        )
      ).rejects.toThrow("Carousel requires at least 2 images");
    });

    it("throws if more than 10 images", async () => {
      const urls = Array(11)
        .fill(null)
        .map((_, i) => `https://example.com/photo${i}.jpg`);

      await expect(
        postCarouselToInstagram("ig-account", "access-token", urls, "Caption")
      ).rejects.toThrow("Carousel supports maximum 10 images");
    });
  });
});

