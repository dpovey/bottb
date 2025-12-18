import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhotoFilters } from "../photo-filters";
import type { Event, Band } from "@/lib/db";

// Mock the UI components
vi.mock("@/components/ui", () => ({
  FilterBar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="filter-bar">{children}</div>
  ),
  FilterSelect: ({
    label,
    value,
    onChange,
    children,
    disabled,
  }: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  ),
  FilterPill: ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <div data-testid={`filter-pill-${label}`}>
      {label}
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
  FilterPills: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="filter-pills">{children}</div>
  ),
  FilterClearButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>Clear All</button>
  ),
}));

describe("PhotoFilters - Band Deduplication", () => {
  const mockEvents: Event[] = [
    { id: "event1", name: "Brisbane 2024", date: "2024-01-01", location: "Brisbane", timezone: "Australia/Brisbane", is_active: true, status: "finalized", created_at: "2024-01-01" },
    { id: "event2", name: "Brisbane 2025", date: "2025-01-01", location: "Brisbane", timezone: "Australia/Brisbane", is_active: true, status: "finalized", created_at: "2025-01-01" },
  ];

  const mockBands: Band[] = [
    {
      id: "band1",
      event_id: "event1",
      name: "Jumbo Band",
      company_slug: "jumbo",
      order: 1,
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "band2",
      event_id: "event2",
      name: "Jumbo Band",
      company_slug: "jumbo",
      order: 1,
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "band3",
      event_id: "event1",
      name: "Epsilon",
      company_slug: "epsilon",
      order: 2,
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "band4",
      event_id: "event2",
      name: "Epsilon Band",
      company_slug: "epsilon",
      order: 2,
      created_at: "2024-01-01T00:00:00Z",
    },
  ];

  const mockCompanies = [
    { slug: "jumbo", name: "Jumbo" },
    { slug: "epsilon", name: "Epsilon" },
  ];

  const mockAvailableFilters = {
    companies: mockCompanies.map((c) => ({ ...c, count: 10 })),
    events: mockEvents.map((e) => ({ id: e.id, name: e.name, count: 10 })),
    bands: mockBands.map((b) => ({ id: b.id, name: b.name, count: 10 })),
    photographers: [{ name: "Photographer 1", count: 5 }],
    hasPhotosWithoutBand: true,
    hasPhotosWithoutCompany: false,
  };

  const defaultProps = {
    events: mockEvents,
    bands: mockBands,
    photographers: ["Photographer 1"],
    companies: mockCompanies,
    availableFilters: mockAvailableFilters,
    selectedEventId: null,
    selectedBandId: null,
    selectedPhotographer: null,
    selectedCompanySlug: null,
    onEventChange: vi.fn(),
    onBandChange: vi.fn(),
    onPhotographerChange: vi.fn(),
    onCompanyChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Band deduplication when company is selected", () => {
    it("should deduplicate bands with same name when company is selected and no event", async () => {
      const _user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      const options = Array.from(bandSelect.options).map((opt) => opt.text);

      // Should only show "Jumbo Band" once, not twice
      const jumboBandCount = options.filter((opt) => opt.includes("Jumbo Band")).length;
      expect(jumboBandCount).toBe(1);
    });

    it("should show different band names separately for same company", async () => {
      const _user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="epsilon"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      const options = Array.from(bandSelect.options).map((opt) => opt.text);

      // Should show both "Epsilon" and "Epsilon Band" separately
      expect(options.some((opt) => opt.includes("Epsilon") && !opt.includes("Band"))).toBe(true);
      expect(options.some((opt) => opt.includes("Epsilon Band"))).toBe(true);
    });

    it("should send all matching band IDs when deduplicated band is selected", async () => {
      const user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      
      // Find the "Jumbo Band" option (should be deduplicated)
      const jumboBandOption = Array.from(bandSelect.options).find(
        (opt) => opt.text.includes("Jumbo Band") && opt.value !== ""
      );

      expect(jumboBandOption).toBeTruthy();
      
      // Select the deduplicated band
      await user.selectOptions(bandSelect, jumboBandOption!.value);

      // Should call onBandChange with "bandIds:id1,id2" format
      expect(onBandChange).toHaveBeenCalled();
      const callArg = onBandChange.mock.calls[0][0];
      expect(callArg).toMatch(/^bandIds:/);
      const ids = callArg.replace("bandIds:", "").split(",");
      expect(ids.length).toBe(2);
      expect(ids).toContain("band1");
      expect(ids).toContain("band2");
    });

    it("should not deduplicate when event is selected", async () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          selectedEventId="event1"
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      const options = Array.from(bandSelect.options).map((opt) => opt.text);

      // When event is selected, should show all bands for that event
      // "Jumbo Band" should appear once (only in event1)
      const jumboBandCount = options.filter((opt) => opt.includes("Jumbo Band")).length;
      expect(jumboBandCount).toBe(1);
    });

    it("should send single band ID when non-deduplicated band is selected", async () => {
      const user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="epsilon"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      
      // Find "Epsilon" option (different from "Epsilon Band")
      const epsilonOption = Array.from(bandSelect.options).find(
        (opt) => opt.text.includes("Epsilon") && !opt.text.includes("Band") && opt.value !== ""
      );

      expect(epsilonOption).toBeTruthy();
      
      // Select the band
      await user.selectOptions(bandSelect, epsilonOption!.value);

      // Should call onBandChange with single ID (not bandIds: format)
      expect(onBandChange).toHaveBeenCalled();
      const callArg = onBandChange.mock.calls[0][0];
      expect(callArg).not.toMatch(/^bandIds:/);
      expect(callArg).toBe("band3");
    });
  });

  describe("Band filter value handling", () => {
    it("should display correct value when bandIds format is selected", () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="jumbo"
          selectedBandId="bandIds:band1,band2"
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      
      // Should extract first ID from bandIds format for display
      expect(bandSelect.value).toBe("band1");
    });

    it("should display correct value when single band ID is selected", () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedBandId="band3"
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      expect(bandSelect.value).toBe("band3");
    });

    it("should handle 'none' band selection", async () => {
      const user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      await user.selectOptions(bandSelect, "none");

      expect(onBandChange).toHaveBeenCalledWith("none");
    });

    it("should handle clearing band selection", async () => {
      const user = userEvent.setup();
      const onBandChange = vi.fn();

      render(
        <PhotoFilters
          {...defaultProps}
          selectedBandId="band1"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      await user.selectOptions(bandSelect, "");

      expect(onBandChange).toHaveBeenCalledWith(null);
    });
  });

  describe("Edge cases", () => {
    it("should handle company with no bands", () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedCompanySlug="nonexistent"
          bands={[]}
          availableFilters={{
            ...mockAvailableFilters,
            bands: [],
            hasPhotosWithoutBand: false,
          }}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      const options = Array.from(bandSelect.options).map((opt) => opt.text);
      
      // Should only have "All Bands" option
      expect(options.length).toBe(1);
      expect(options[0]).toContain("All Bands");
    });

    it("should handle company with single band (no deduplication needed)", async () => {
      const user = userEvent.setup();
      const onBandChange = vi.fn();

      const singleBand: Band[] = [
        {
          id: "band1",
          event_id: "event1",
          name: "Single Band",
          company_slug: "jumbo",
          order: 1,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      render(
        <PhotoFilters
          {...defaultProps}
          bands={singleBand}
          selectedCompanySlug="jumbo"
          onBandChange={onBandChange}
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      const singleBandOption = Array.from(bandSelect.options).find(
        (opt) => opt.text.includes("Single Band") && opt.value !== ""
      );

      expect(singleBandOption).toBeTruthy();
      await user.selectOptions(bandSelect, singleBandOption!.value);

      // Should send single ID, not bandIds format
      expect(onBandChange).toHaveBeenCalledWith("band1");
      expect(onBandChange).not.toHaveBeenCalledWith(
        expect.stringMatching(/^bandIds:/)
      );
    });

    it("should handle malformed bandIds format gracefully", () => {
      render(
        <PhotoFilters
          {...defaultProps}
          selectedBandId="bandIds:"
        />
      );

      const bandSelect = screen.getByLabelText(/band/i) as HTMLSelectElement;
      // Should not crash, value should be empty or handle gracefully
      expect(bandSelect).toBeInTheDocument();
    });
  });
});

