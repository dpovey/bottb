import {
  validateImageFile,
  generateBandImageFilename,
  generateEventImageFilename,
} from "../blob";

describe("blob utilities", () => {
  describe("validateImageFile", () => {
    it("should validate valid JPEG file", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate valid PNG file", () => {
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate valid WebP file", () => {
      const file = new File(["test"], "test.webp", { type: "image/webp" });
      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid file type", () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
      );
    });

    it("should reject file that is too large", () => {
      // Create a file larger than 5MB
      const largeContent = new Array(6 * 1024 * 1024).fill("a").join("");
      const file = new File([largeContent], "large.jpg", {
        type: "image/jpeg",
      });
      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("File too large. Maximum size is 5MB.");
    });

    it("should accept file at size limit", () => {
      // Create a file exactly at 5MB limit
      const content = new Array(5 * 1024 * 1024).fill("a").join("");
      const file = new File([content], "limit.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("generateBandImageFilename", () => {
    it("should generate filename with band ID and timestamp", () => {
      const filename = generateBandImageFilename("band-123", "photo.jpg");

      expect(filename).toMatch(/^bands\/band-123\/\d+\.jpg$/);
    });

    it("should handle different file extensions", () => {
      const jpgFilename = generateBandImageFilename("band-123", "photo.jpg");
      const pngFilename = generateBandImageFilename("band-456", "image.png");
      const webpFilename = generateBandImageFilename(
        "band-789",
        "picture.webp"
      );

      expect(jpgFilename).toMatch(/\.jpg$/);
      expect(pngFilename).toMatch(/\.png$/);
      expect(webpFilename).toMatch(/\.webp$/);
    });

    it("should default to jpg extension if no extension provided", () => {
      const filename = generateBandImageFilename("band-123", "photo");

      expect(filename).toMatch(/\.jpg$/);
    });

    it("should include timestamp in filename", () => {
      const before = Date.now();
      const filename = generateBandImageFilename("band-123", "photo.jpg");
      const after = Date.now();

      const timestamp = parseInt(filename.match(/\/(\d+)\.jpg$/)?.[1] || "0");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("generateEventImageFilename", () => {
    it("should generate filename with event ID and timestamp", () => {
      const filename = generateEventImageFilename("event-123", "banner.jpg");

      expect(filename).toMatch(/^events\/event-123\/\d+\.jpg$/);
    });

    it("should handle different file extensions", () => {
      const jpgFilename = generateEventImageFilename("event-123", "banner.jpg");
      const pngFilename = generateEventImageFilename("event-456", "poster.png");
      const webpFilename = generateEventImageFilename(
        "event-789",
        "flyer.webp"
      );

      expect(jpgFilename).toMatch(/\.jpg$/);
      expect(pngFilename).toMatch(/\.png$/);
      expect(webpFilename).toMatch(/\.webp$/);
    });

    it("should default to jpg extension if no extension provided", () => {
      const filename = generateEventImageFilename("event-123", "banner");

      expect(filename).toMatch(/\.jpg$/);
    });

    it("should include timestamp in filename", () => {
      const before = Date.now();
      const filename = generateEventImageFilename("event-123", "banner.jpg");
      const after = Date.now();

      const timestamp = parseInt(filename.match(/\/(\d+)\.jpg$/)?.[1] || "0");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
