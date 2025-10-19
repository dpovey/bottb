import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signOut } from "next-auth/react";
import { vi } from "vitest";
import { server } from "@/__mocks__/server";
import { http, HttpResponse } from "msw";
import AdminDashboard from "../admin-dashboard";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  },
}));

// Use MSW for fetch mocking

const mockEvents = [
  {
    id: "event-1",
    name: "Tech Battle 2024",
    location: "Sydney Convention Centre",
    status: "active",
    date: "2024-01-15",
  },
  {
    id: "event-2",
    name: "Melbourne Showdown",
    location: "Melbourne Exhibition Centre",
    status: "upcoming",
    date: "2024-02-20",
  },
  {
    id: "event-3",
    name: "Brisbane Finals",
    location: "Brisbane Convention Centre",
    status: "past",
    date: "2023-12-10",
  },
];

const mockSession = {
  user: {
    id: "admin-1",
    name: "Admin User",
    email: "admin@example.com",
    isAdmin: true,
  },
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // MSW will handle the fetch mocking
  });

  it("renders admin dashboard with header and sign out button", async () => {
    // Override MSW handler for this test
    server.use(
      http.get("/api/events", () => {
        return HttpResponse.json(mockEvents);
      })
    );

    render(<AdminDashboard session={mockSession} />);

    expect(
      screen.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome, Admin User")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign Out" })
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<AdminDashboard session={mockSession} />);
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });

  it("renders events list when data is loaded", async () => {
    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      expect(screen.getByText("Test Event 2")).toBeInTheDocument();
    });
  });

  it("displays event details correctly", async () => {
    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      // Check first event details
      expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      expect(screen.getByText("Test Venue 1")).toBeInTheDocument();
      expect(screen.getByText("2024-12-25T18:30:00Z")).toBeInTheDocument();
    });
  });

  it("shows correct status badges for different event statuses", async () => {
    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      // Voting event - gray badge
      const votingStatus = screen.getByText("voting");
      expect(votingStatus).toHaveClass("bg-gray-500/20", "text-gray-400");

      // Upcoming event - blue badge
      const upcomingStatus = screen.getByText("upcoming");
      expect(upcomingStatus).toHaveClass("bg-blue-500/20", "text-blue-400");
    });
  });

  it("renders Manage Event button for each event", async () => {
    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      const manageButtons = screen.getAllByRole("link", {
        name: "Manage Event",
      });
      expect(manageButtons).toHaveLength(2);
    });
  });

  it("links Manage Event button to correct event admin page", async () => {
    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      const manageButtons = screen.getAllByRole("link", {
        name: "Manage Event",
      });

      // Check that each button links to the correct event admin page
      expect(manageButtons[0]).toHaveAttribute("href", "/admin/events/event-1");
      expect(manageButtons[1]).toHaveAttribute("href", "/admin/events/event-2");
    });
  });

  it("handles sign out button click", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard session={mockSession} />);

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    await user.click(signOutButton);

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows no events message when no events are returned", async () => {
    server.use(
      http.get("/api/events", () => {
        return HttpResponse.json([]);
      })
    );

    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByText("No events found")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    // Mock console.error to suppress output and verify it's called
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    server.use(
      http.get("/api/events", () => {
        return HttpResponse.error();
      })
    );

    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByText("No events found")).toBeInTheDocument();
    });

    // Verify console.error was called with the expected error
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching events:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("handles fetch response error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    server.use(
      http.get("/api/events", () => {
        return HttpResponse.json({ error: "Server error" }, { status: 500 });
      })
    );

    render(<AdminDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByText("No events found")).toBeInTheDocument();
    });

    // Assert that console.error was called with the expected error
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching events:",
      "Internal Server Error"
    );

    consoleSpy.mockRestore();
  });

  it("displays user email when name is not available", () => {
    const sessionWithEmail = {
      user: {
        id: "admin-1",
        name: null,
        email: "admin@example.com",
        isAdmin: true,
      },
    };

    render(<AdminDashboard session={sessionWithEmail} />);
    expect(screen.getByText("Welcome, admin@example.com")).toBeInTheDocument();
  });
});
