import { getFingerprintJSData } from "../user-context";

// Mock FingerprintJS
jest.mock("@fingerprintjs/fingerprintjs", () => ({
  load: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(() =>
        Promise.resolve({
          visitorId: "test-visitor-id-123",
          confidence: {
            score: 0.95,
            comment: "High confidence fingerprint",
          },
          components: {
            canvas: { value: "canvas-fingerprint" },
            webgl: { value: "webgl-fingerprint" },
            audio: { value: "audio-fingerprint" },
          },
        })
      ),
    })
  ),
}));

describe("FingerprintJS Integration", () => {
  beforeEach(() => {
    // Mock window object for browser environment
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com" },
      writable: true,
    });
  });

  it("should get FingerprintJS data in browser environment", async () => {
    const result = await getFingerprintJSData();

    expect(result).not.toBeNull();
    expect(result?.visitorId).toBe("test-visitor-id-123");
    expect(result?.confidence).toBe(0.95);
    expect(result?.components).toEqual({
      canvas: { value: "canvas-fingerprint" },
      webgl: { value: "webgl-fingerprint" },
      audio: { value: "audio-fingerprint" },
    });
  });

  it("should return null in server environment", async () => {
    // Mock server environment
    const originalWindow = global.window;
    delete (global as unknown as { window?: unknown }).window;

    const result = await getFingerprintJSData();
    expect(result).toBeNull();

    // Restore window
    global.window = originalWindow;
  });

  it("should handle FingerprintJS errors gracefully", async () => {
    const FingerprintJS = jest.requireMock("@fingerprintjs/fingerprintjs");
    FingerprintJS.load.mockRejectedValueOnce(new Error("FingerprintJS failed"));

    // Suppress expected console.error for this test
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await getFingerprintJSData();
    expect(result).toBeNull();

    // Verify the error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error getting FingerprintJS data:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
