import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";
import {
  uploadImage,
  deleteImage,
  validateImageFile,
  generateBandImageFilename,
  generateEventImageFilename,
  generateUserImageFilename,
} from "@/lib/blob";
import { requireAdminAuth } from "@/lib/api-protection";

// Mock dependencies
jest.mock("@/lib/blob");
jest.mock("@/lib/api-protection");

const mockRequireAdminAuth = requireAdminAuth as jest.MockedFunction<
  typeof requireAdminAuth
>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockDeleteImage = deleteImage as jest.MockedFunction<typeof deleteImage>;
const mockValidateImageFile = validateImageFile as jest.MockedFunction<
  typeof validateImageFile
>;
const mockGenerateBandImageFilename =
  generateBandImageFilename as jest.MockedFunction<
    typeof generateBandImageFilename
  >;
const mockGenerateEventImageFilename =
  generateEventImageFilename as jest.MockedFunction<
    typeof generateEventImageFilename
  >;
const _mockGenerateUserImageFilename =
  generateUserImageFilename as jest.MockedFunction<
    typeof generateUserImageFilename
  >;

// Helper function to create a mock NextRequest with formData
const createMockRequest = (
  formData: FormData,
  url = "http://localhost:3000/api/upload/image"
) => {
  const mockRequest = {
    formData: jest.fn().mockResolvedValue(formData),
    url,
  } as unknown as NextRequest;
  return mockRequest;
};

// Helper function to create a mock NextRequest with searchParams
const createMockRequestWithSearchParams = (
  searchParams: URLSearchParams,
  baseUrl = "http://localhost:3000/api/upload/image"
) => {
  const queryString = searchParams.toString();
  const fullUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const mockRequest = {
    url: fullUrl,
  } as unknown as NextRequest;
  return mockRequest;
};

describe("/api/upload/image", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST", () => {
    it("should upload band image successfully", async () => {
      // Mock admin auth
      mockRequireAdminAuth.mockResolvedValue(undefined);

      // Mock file validation
      mockValidateImageFile.mockReturnValue({ valid: true });

      // Mock filename generation
      mockGenerateBandImageFilename.mockReturnValue(
        "bands/band-123/profile-test.jpg"
      );

      // Mock upload result
      const mockUploadResult = {
        url: "https://blob.vercel-storage.com/bands/band-123/1234567890.jpg",
        downloadUrl:
          "https://blob.vercel-storage.com/bands/band-123/1234567890.jpg",
        pathname: "bands/band-123/1234567890.jpg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
        size: 1024,
      };
      mockUploadImage.mockResolvedValue(mockUploadResult);

      // Create form data
      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("type", "band");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.url).toBe(mockUploadResult.url);
      expect(mockUploadImage).toHaveBeenCalledWith(
        file,
        "bands/band-123/profile-test.jpg",
        expect.objectContaining({
          access: "public",
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        })
      );
    });

    it("should upload event image successfully", async () => {
      // Mock admin auth
      mockRequireAdminAuth.mockResolvedValue(undefined);

      // Mock file validation
      mockValidateImageFile.mockReturnValue({ valid: true });

      // Mock filename generation
      mockGenerateEventImageFilename.mockReturnValue(
        "events/event-123/banner-test.jpg"
      );

      // Mock upload result
      const mockUploadResult = {
        url: "https://blob.vercel-storage.com/events/event-123/1234567890.jpg",
        downloadUrl:
          "https://blob.vercel-storage.com/events/event-123/1234567890.jpg",
        pathname: "events/event-123/1234567890.jpg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
        size: 1024,
      };
      mockUploadImage.mockResolvedValue(mockUploadResult);

      // Create form data
      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("type", "event");
      formData.append("entityId", "event-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.url).toBe(mockUploadResult.url);
      expect(mockUploadImage).toHaveBeenCalledWith(
        file,
        "events/event-123/banner-test.jpg",
        expect.objectContaining({
          access: "public",
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        })
      );
    });

    it("should return 400 if no file provided", async () => {
      mockRequireAdminAuth.mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("type", "band");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No file provided");
    });

    it("should return 400 if invalid type", async () => {
      mockRequireAdminAuth.mockResolvedValue(undefined);

      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("type", "invalid");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        'Invalid type. Must be "band", "event", or "user"'
      );
    });

    it("should return 400 if file validation fails", async () => {
      mockRequireAdminAuth.mockResolvedValue(undefined);
      mockValidateImageFile.mockReturnValue({
        valid: false,
        error:
          "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      });

      const formData = new FormData();
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      formData.append("file", file);
      formData.append("type", "band");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
      );
    });

    it("should return 401 if not authenticated", async () => {
      // Mock console.error to suppress output and verify it's called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockRequireAdminAuth.mockRejectedValue(new Error("Unauthorized"));

      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("type", "band");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");

      // Verify console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Image upload error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return 500 if upload fails", async () => {
      // Mock console.error to suppress output and verify it's called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockRequireAdminAuth.mockResolvedValue(undefined);
      mockValidateImageFile.mockReturnValue({ valid: true });
      mockGenerateBandImageFilename.mockReturnValue(
        "bands/band-123/profile-test.jpg"
      );
      mockUploadImage.mockRejectedValue(new Error("Upload failed"));

      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);
      formData.append("type", "band");
      formData.append("entityId", "band-123");

      const request = createMockRequest(formData);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to upload image");

      // Verify console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Image upload error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("DELETE", () => {
    it("should delete image successfully", async () => {
      mockRequireAdminAuth.mockResolvedValue(undefined);
      mockDeleteImage.mockResolvedValue(undefined);

      const searchParams = new URLSearchParams();
      searchParams.set("url", "https://example.com/image.jpg");
      const request = createMockRequestWithSearchParams(searchParams);

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteImage).toHaveBeenCalledWith(
        "https://example.com/image.jpg"
      );
    });

    it("should return 400 if no URL provided", async () => {
      mockRequireAdminAuth.mockResolvedValue(undefined);

      const searchParams = new URLSearchParams();
      const request = createMockRequestWithSearchParams(searchParams);

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Image URL is required");
    });

    it("should return 401 if not authenticated", async () => {
      // Mock console.error to suppress output and verify it's called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockRequireAdminAuth.mockRejectedValue(new Error("Unauthorized"));

      const searchParams = new URLSearchParams();
      searchParams.set("url", "https://example.com/image.jpg");
      const request = createMockRequestWithSearchParams(searchParams);

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");

      // Verify console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Image deletion error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return 500 if deletion fails", async () => {
      // Mock console.error to suppress output and verify it's called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockRequireAdminAuth.mockResolvedValue(undefined);
      mockDeleteImage.mockRejectedValue(new Error("Deletion failed"));

      const searchParams = new URLSearchParams();
      searchParams.set("url", "https://example.com/image.jpg");
      const request = createMockRequestWithSearchParams(searchParams);

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete image");

      // Verify console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Image deletion error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
