import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CrowdVotingPage from "../page";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "test-event-id" }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock the user context functions
jest.mock("@/lib/user-context", () => ({
  getClientUserContext: jest.fn(() => ({
    screen_resolution: "1920x1080",
    timezone: "America/New_York",
    language: "en-US",
  })),
  hasVotingCookie: jest.fn(() => false),
  setVotingCookie: jest.fn(),
  getFingerprintJSData: jest.fn(() =>
    Promise.resolve({
      visitorId: "test-visitor-id",
      confidence: 0.95,
      components: {},
    })
  ),
}));

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("CrowdVotingPage", () => {
  const mockBands = [
    {
      id: "band-1",
      name: "Test Band 1",
      description: "A test band",
      order: 1,
    },
    {
      id: "band-2",
      name: "Test Band 2",
      description: "Another test band",
      order: 2,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBands,
    } as Response);
  });

  it("renders crowd voting form", async () => {
    render(<CrowdVotingPage />);

    expect(
      screen.getByRole("heading", { name: "Crowd Voting" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vote for your favorite band!")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
    });
  });

  it("displays bands with correct information", async () => {
    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("A test band")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
      expect(screen.getByText("Another test band")).toBeInTheDocument();
    });
  });

  it("allows band selection via radio buttons", async () => {
    const user = userEvent.setup();
    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const band1Radio = screen.getByRole("radio", { name: /Test Band 1/ });
    const band2Radio = screen.getByRole("radio", { name: /Test Band 2/ });

    expect(band1Radio).not.toBeChecked();
    expect(band2Radio).not.toBeChecked();

    await act(async () => {
      await user.click(band1Radio);
    });
    expect(band1Radio).toBeChecked();
    expect(band2Radio).not.toBeChecked();

    await act(async () => {
      await user.click(band2Radio);
    });
    expect(band1Radio).not.toBeChecked();
    expect(band2Radio).toBeChecked();
  });

  it("submits vote successfully", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "vote-1" }),
      } as Response);

    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const band1Radio = screen.getByRole("radio", { name: /Test Band 1/ });
    await act(async () => {
      await user.click(band1Radio);
    });

    const submitButton = screen.getByRole("button", { name: "Submit Vote" });
    expect(submitButton).not.toBeDisabled();

    await act(async () => {
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Vote Submitted!")).toBeInTheDocument();
      expect(
        screen.getByText("Your vote has been recorded. Thank you for participating!")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ id: "vote-1" }),
                } as Response),
              100
            )
          )
      );

    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const band1Radio = screen.getByRole("radio", { name: /Test Band 1/ });
    await act(async () => {
      await user.click(band1Radio);
    });

    const submitButton = screen.getByRole("button", { name: "Submit Vote" });
    await act(async () => {
      await user.click(submitButton);
    });

    expect(screen.getByText("Submitting...")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("prevents submission without band selection", async () => {
    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: "Submit Vote" });
    expect(submitButton).toBeDisabled();
  });

  it("handles submission error", async () => {
    const user = userEvent.setup();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const band1Radio = screen.getByRole("radio", { name: /Test Band 1/ });
    await act(async () => {
      await user.click(band1Radio);
    });

    const submitButton = screen.getByRole("button", { name: "Submit Vote" });
    await act(async () => {
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Already Voted")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("handles fetch bands error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<CrowdVotingPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching bands:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
