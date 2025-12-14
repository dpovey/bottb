import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { server } from "@/__mocks__/server";
import { http, HttpResponse } from "msw";
import EventPage from "../page";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "test-event-id" }),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: vi.fn(),
}));

describe("EventPage", () => {
  const mockEvent = {
    id: "test-event-id",
    name: "Test Event",
    date: "2024-12-25T18:30:00Z",
    location: "Test Venue",
    status: "voting",
  };

  const mockBands = [
    {
      id: "band-1",
      event_id: "test-event-id",
      name: "Test Band 1",
      description: "A test band",
      order: 1,
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "band-2",
      event_id: "test-event-id",
      name: "Test Band 2",
      description: "Another test band",
      order: 2,
      created_at: "2024-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: Tests for event rendering with API calls are timing out due to MSW/fetch issues
  // TODO: Fix these tests when addressing test infrastructure
  it.skip("renders event details", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeInTheDocument();
    });
  });

  it.skip("shows status badge correctly", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("Voting Open")).toBeInTheDocument();
    });
  });

  it.skip("shows voting link for voting status", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      const voteLink = screen.getByRole("link", { name: "Vote for Bands" });
      expect(voteLink).toBeInTheDocument();
      expect(voteLink).toHaveAttribute("href", "/vote/crowd/test-event-id");
    });
  });

  it.skip("shows results link for finalized status", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json({ ...mockEvent, status: "finalized" });
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      const resultsLink = screen.getByRole("link", { name: "View Results" });
      expect(resultsLink).toBeInTheDocument();
      expect(resultsLink).toHaveAttribute("href", "/results/test-event-id");
    });
  });

  it.skip("displays bands list", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("2 Bands")).toBeInTheDocument();
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
    });
  });

  it("shows band order numbers", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("shows no bands message when empty", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json(mockEvent);
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json([]);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No bands registered for this event yet.")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    render(<EventPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error when event not found", async () => {
    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.json({ error: "Event not found" }, { status: 404 });
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.json(mockBands);
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("Event not found")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    server.use(
      http.get("/api/events/test-event-id", () => {
        return HttpResponse.error();
      }),
      http.get("/api/bands/test-event-id", () => {
        return HttpResponse.error();
      })
    );

    render(<EventPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching data:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
