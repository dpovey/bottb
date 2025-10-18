import { NextResponse } from "next/server";
import {
  withAdminAuth,
  withAuth,
  withRateLimit,
  withAdminProtection,
  withUserProtection,
  withPublicRateLimit,
  withVoteRateLimit,
  clearRateLimitStore,
} from "../api-protection";
import {
  createMockRequest,
  mockAdminAuth,
  mockUserAuth,
  mockNoAuth,
  clearAuthMocks,
} from "../../__tests__/utils/api-test-helpers";

// Mock the auth function
jest.mock("../auth", () => ({
  auth: jest.fn(),
}));

describe("API Protection System", () => {
  beforeEach(() => {
    clearAuthMocks();
  });

  describe("withAdminAuth", () => {
    it("allows admin users", async () => {
      mockAdminAuth();

      const handler = withAdminAuth(async (_request, _context, session) => {
        return NextResponse.json({ success: true, userId: session?.user.id });
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe("admin-1");
    });

    it("blocks non-admin users", async () => {
      mockUserAuth();

      const handler = withAdminAuth(async () => {
        return NextResponse.json(
          { error: "Should not reach here" },
          { status: 200 }
        );
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized - Admin access required");
    });

    it("blocks unauthenticated users", async () => {
      mockNoAuth();

      const handler = withAdminAuth(async () => {
        return NextResponse.json(
          { error: "Should not reach here" },
          { status: 200 }
        );
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized - Admin access required");
    });
  });

  describe("withAuth", () => {
    it("allows authenticated users", async () => {
      mockUserAuth();

      const handler = withAuth(async (_request, _context, session) => {
        return NextResponse.json({ success: true, userId: session?.user.id });
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe("user-1");
    });

    it("blocks unauthenticated users", async () => {
      mockNoAuth();

      const handler = withAuth(async () => {
        return NextResponse.json(
          { error: "Should not reach here" },
          { status: 200 }
        );
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized - Authentication required");
    });
  });

  describe("withRateLimit", () => {
    it("allows requests within limit", async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true });
      }, "api");

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("blocks requests exceeding limit", async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true });
      }, "api");

      // Make 101 requests (exceeding the 100/min limit)
      const requests = Array.from({ length: 101 }, (_, _i) =>
        createMockRequest("http://localhost/api/test", {
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(requests.map((req) => handler(req)));

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);

      const data = await lastResponse.json();
      expect(data.error).toBe("Too many requests");
      expect(data.limit).toBe(100);
      expect(data.retryAfter).toBeDefined();
    });

    it("uses different limits for different types", async () => {
      const voteHandler = withRateLimit(async () => {
        return NextResponse.json({ success: true });
      }, "vote");

      // Make 11 requests (exceeding the 10/min vote limit)
      const requests = Array.from({ length: 11 }, (_, _i) =>
        createMockRequest("http://localhost/api/votes", {
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(
        requests.map((req) => voteHandler(req))
      );

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);

      const data = await lastResponse.json();
      expect(data.limit).toBe(10); // Vote limit is 10/min
    });
  });

  describe("withAdminProtection", () => {
    it("combines admin auth and rate limiting", async () => {
      mockAdminAuth();

      const handler = withAdminProtection(
        async (_request, _context, _session) => {
          return NextResponse.json({ success: true });
        }
      );

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
    });

    it("blocks non-admin users even with rate limiting", async () => {
      mockUserAuth();

      const handler = withAdminProtection(async () => {
        return NextResponse.json(
          { error: "Should not reach here" },
          { status: 200 }
        );
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(401);
    });
  });

  describe("withUserProtection", () => {
    it("combines user auth and rate limiting", async () => {
      mockUserAuth();

      const handler = withUserProtection(
        async (_request, _context, _session) => {
          return NextResponse.json({ success: true });
        }
      );

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
    });
  });

  describe("withPublicRateLimit", () => {
    it("applies rate limiting to public endpoints", async () => {
      const handler = withPublicRateLimit(async () => {
        return NextResponse.json({ success: true });
      });

      const request = createMockRequest("http://localhost/api/test");
      const response = await handler(request);

      expect(response.status).toBe(200);
    });
  });

  describe("withVoteRateLimit", () => {
    it("applies stricter rate limiting to vote endpoints", async () => {
      const handler = withVoteRateLimit(async () => {
        return NextResponse.json({ success: true });
      });

      // Make 11 requests (exceeding the 10/min vote limit)
      const requests = Array.from({ length: 11 }, (_, _i) =>
        createMockRequest("http://localhost/api/votes", {
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(requests.map((req) => handler(req)));

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);

      const data = await lastResponse.json();
      expect(data.limit).toBe(10);
    });
  });

  describe("Rate limit headers", () => {
    beforeEach(() => {
      clearRateLimitStore();
    });

    it("includes proper rate limit headers on rate limited responses", async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true });
      }, "api");

      // Make 101 requests with the same client identifier to trigger rate limit
      const requests = Array.from({ length: 101 }, () =>
        createMockRequest("http://localhost/api/test", {
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(requests.map((req) => handler(req)));
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(lastResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("includes retry-after header when rate limited", async () => {
      const handler = withRateLimit(async () => {
        return NextResponse.json({ success: true });
      }, "api");

      // Make 101 requests to trigger rate limit
      const requests = Array.from({ length: 101 }, (_, _i) =>
        createMockRequest("http://localhost/api/test", {
          headers: {
            "X-Forwarded-For": "192.168.1.1",
            "User-Agent": "TestAgent",
          },
        })
      );

      const responses = await Promise.all(requests.map((req) => handler(req)));

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers.get("Retry-After")).toBeDefined();
      expect(lastResponse.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(lastResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });
});
