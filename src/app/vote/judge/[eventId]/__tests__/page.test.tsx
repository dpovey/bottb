import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JudgeVotingPage from "../page";

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

// Setup user event
const user = userEvent.setup();

describe("JudgeVotingPage", () => {
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

  it("renders judge scoring form", async () => {
    render(<JudgeVotingPage />);

    expect(
      screen.getByRole("heading", { name: "Judge Scoring" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Score each band on the judging criteria")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
    });
  });

  it("displays judging criteria", () => {
    render(<JudgeVotingPage />);

    expect(screen.getByText("Song Choice (20 points)")).toBeInTheDocument();
    expect(screen.getByText("Performance (30 points)")).toBeInTheDocument();
    expect(screen.getByText("Crowd Vibe (30 points)")).toBeInTheDocument();
  });

  it("displays bands with scoring sliders", async () => {
    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
      expect(screen.getByText("Test Band 2")).toBeInTheDocument();
    });

    // Check for sliders for each band
    const songChoiceSliders = screen.getAllByRole("slider", {
      name: /Song Choice for/,
    });
    const performanceSliders = screen.getAllByRole("slider", {
      name: /Performance for/,
    });
    const crowdVibeSliders = screen.getAllByRole("slider", {
      name: /Crowd Vibe for/,
    });

    expect(songChoiceSliders).toHaveLength(2);
    expect(performanceSliders).toHaveLength(2);
    expect(crowdVibeSliders).toHaveLength(2);
  });

  it("allows score input via sliders", async () => {
    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const songChoiceSlider = screen.getAllByRole("slider", {
      name: /Song Choice for/,
    })[0];
    const performanceSlider = screen.getAllByRole("slider", {
      name: /Performance for/,
    })[0];
    const crowdVibeSlider = screen.getAllByRole("slider", {
      name: /Crowd Vibe for/,
    })[0];

    expect(songChoiceSlider).toHaveValue("0");
    expect(performanceSlider).toHaveValue("0");
    expect(crowdVibeSlider).toHaveValue("0");

    // Use fireEvent to properly set range input values
    act(() => {
      fireEvent.change(songChoiceSlider, { target: { value: "15" } });
      fireEvent.change(performanceSlider, { target: { value: "25" } });
      fireEvent.change(crowdVibeSlider, { target: { value: "20" } });
    });

    expect(songChoiceSlider).toHaveValue("15");
    expect(performanceSlider).toHaveValue("25");
    expect(crowdVibeSlider).toHaveValue("20");
  });

  it("shows total score for each band", async () => {
    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const songChoiceSlider = screen.getAllByRole("slider", {
      name: /Song Choice for/,
    })[0];
    const performanceSlider = screen.getAllByRole("slider", {
      name: /Performance for/,
    })[0];
    const crowdVibeSlider = screen.getAllByRole("slider", {
      name: /Crowd Vibe for/,
    })[0];

    await user.type(songChoiceSlider, "15");
    await user.type(performanceSlider, "25");
    await user.type(crowdVibeSlider, "20");

    // The total text is split across multiple elements, so we need to look for parts
    const totalElements = screen.getAllByText((content, element) => {
      return (
        element?.textContent === "Total: 0/80" && element?.tagName === "SPAN"
      );
    });
    expect(totalElements).toHaveLength(2); // One for each band
  });

  it("validates all scores are provided before submission", async () => {
    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit All Scores",
    });
    expect(submitButton).toBeDisabled();

    // Fill scores for first band only
    const songChoiceSlider = screen.getAllByRole("slider", {
      name: /Song Choice for/,
    })[0];
    const performanceSlider = screen.getAllByRole("slider", {
      name: /Performance for/,
    })[0];
    const crowdVibeSlider = screen.getAllByRole("slider", {
      name: /Crowd Vibe for/,
    })[0];

    act(() => {
      fireEvent.change(songChoiceSlider, { target: { value: "15" } });
      fireEvent.change(performanceSlider, { target: { value: "25" } });
      fireEvent.change(crowdVibeSlider, { target: { value: "20" } });
    });

    expect(submitButton).toBeDisabled();

    // Fill scores for second band
    const songChoiceSlider2 = screen.getAllByRole("slider", {
      name: /Song Choice for/,
    })[1];
    const performanceSlider2 = screen.getAllByRole("slider", {
      name: /Performance for/,
    })[1];
    const crowdVibeSlider2 = screen.getAllByRole("slider", {
      name: /Crowd Vibe for/,
    })[1];

    act(() => {
      fireEvent.change(songChoiceSlider2, { target: { value: "12" } });
      fireEvent.change(performanceSlider2, { target: { value: "22" } });
      fireEvent.change(crowdVibeSlider2, { target: { value: "18" } });
    });

    expect(submitButton).not.toBeDisabled();
  });

  it("submits all scores successfully", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBands,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ votes: [{ id: "vote-1" }, { id: "vote-2" }] }),
      } as Response);

    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    // Fill scores for all bands
    const sliders = screen.getAllByRole("slider");
    act(() => {
      for (let i = 0; i < sliders.length; i += 3) {
        fireEvent.change(sliders[i], { target: { value: "15" } }); // Song Choice
        fireEvent.change(sliders[i + 1], { target: { value: "25" } }); // Performance
        fireEvent.change(sliders[i + 2], { target: { value: "20" } }); // Crowd Vibe
      }
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit All Scores",
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Scores Submitted!")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Your scores have been recorded. Thank you for participating!"
        )
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
                  json: async () => ({
                    votes: [{ id: "vote-1" }, { id: "vote-2" }],
                  }),
                } as Response),
              100
            )
          )
      );

    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    // Fill scores for all bands
    const sliders = screen.getAllByRole("slider");
    act(() => {
      for (let i = 0; i < sliders.length; i += 3) {
        fireEvent.change(sliders[i], { target: { value: "15" } });
        fireEvent.change(sliders[i + 1], { target: { value: "25" } });
        fireEvent.change(sliders[i + 2], { target: { value: "20" } });
      }
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit All Scores",
    });
    await user.click(submitButton);

    expect(screen.getByText("Submitting...")).toBeInTheDocument();
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

    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Band 1")).toBeInTheDocument();
    });

    // Fill scores for all bands
    const sliders = screen.getAllByRole("slider");
    act(() => {
      for (let i = 0; i < sliders.length; i += 3) {
        fireEvent.change(sliders[i], { target: { value: "15" } });
        fireEvent.change(sliders[i + 1], { target: { value: "25" } });
        fireEvent.change(sliders[i + 2], { target: { value: "20" } });
      }
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit All Scores",
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Already Voted")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("handles fetch bands error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<JudgeVotingPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching bands:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
