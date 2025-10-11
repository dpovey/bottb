import { render, screen, waitFor } from "@testing-library/react";
import EventPage from "../page";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "test-event-id" }),
}));

// Mock fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

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
    jest.clearAllMocks();
  });

  it("renders event details", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeInTheDocument();
      expect(screen.getByText("Test Venue")).toBeInTheDocument();
      expect(
        screen.getByText("25th December 2024 @ 6:30PM")
      ).toBeInTheDocument();
    });
  });

  it("shows status badge correctly", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("VOTING")).toBeInTheDocument();
    });
  });

  it("shows voting link for voting status", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      const voteLink = screen.getByRole("link", { name: "🎵 Vote for Bands" });
      expect(voteLink).toBeInTheDocument();
      expect(voteLink).toHaveAttribute("href", "/vote/crowd/test-event-id");
    });
  });

  it("shows results link for finalized status", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockEvent, status: "finalized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      const resultsLink = screen.getByRole("link", { name: "📊 View Results" });
      expect(resultsLink).toBeInTheDocument();
      expect(resultsLink).toHaveAttribute("href", "/results/test-event-id");
    });
  });

  it("displays bands list", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Bands" })
      ).toBeInTheDocument();
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
      expect(screen.getByText("A test band")).toBeInTheDocument();
      expect(screen.getByText("Another test band")).toBeInTheDocument();
    });
  });

  it("shows band order numbers", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("shows no bands message when empty", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No bands registered for this event yet.")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    // Don't mock fetch for this test - let it show loading state
    render(<EventPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error when event not found", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      expect(screen.getByText("Event not found")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<EventPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching data:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("shows back to events link", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response);

    render(<EventPage />);

    await waitFor(() => {
      const backLink = screen.getByRole("link", { name: "← Back to Events" });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute("href", "/");
    });
  });
});
