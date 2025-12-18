"use client";

import { useEffect, useRef } from "react";
import { Event, Band } from "@/lib/db";
import {
  FilterBar,
  FilterSelect,
  FilterPill,
  FilterPills,
  FilterClearButton,
} from "@/components/ui";

interface Company {
  slug: string;
  name: string;
}

interface AvailableFilters {
  companies: { slug: string; name: string; count: number }[];
  events: { id: string; name: string; count: number }[];
  bands: { id: string; name: string; count: number }[];
  photographers: { name: string; count: number }[];
  hasPhotosWithoutBand: boolean;
  hasPhotosWithoutCompany: boolean;
}

interface PhotoFiltersProps {
  events: Event[];
  bands: Band[];
  photographers: string[];
  companies?: Company[];
  availableFilters?: AvailableFilters;
  selectedEventId: string | null;
  selectedBandId: string | null;
  selectedPhotographer: string | null;
  selectedCompanySlug: string | null;
  onEventChange: (eventId: string | null) => void;
  onBandChange: (bandId: string | null) => void;
  onPhotographerChange: (photographer: string | null) => void;
  onCompanyChange: (companySlug: string | null) => void;
  loading?: boolean;
}

export function PhotoFilters({
  events,
  bands,
  photographers,
  companies = [],
  availableFilters,
  selectedEventId,
  selectedBandId,
  selectedPhotographer,
  selectedCompanySlug,
  onEventChange,
  onBandChange,
  onPhotographerChange,
  onCompanyChange,
  loading,
}: PhotoFiltersProps) {
  // Filter bands by selected event
  const filteredBands = selectedEventId
    ? bands.filter((b) => b.event_id === selectedEventId)
    : bands;

  // When company is selected and no event, deduplicate bands by name
  // (same name at different events should appear once)
  let displayBands: Array<{ id: string; name: string; ids: string[] }> = [];
  if (selectedCompanySlug && !selectedEventId) {
    // Group bands by name for the selected company
    const bandsByName = new Map<string, string[]>();
    filteredBands
      .filter((b) => b.company_slug === selectedCompanySlug)
      .forEach((band) => {
        if (!bandsByName.has(band.name)) {
          bandsByName.set(band.name, []);
        }
        bandsByName.get(band.name)!.push(band.id);
      });

    // Create display bands - if multiple IDs for same name, use first ID as primary (for select value)
    // but store all IDs so we can query for photos from all matching bands
    displayBands = Array.from(bandsByName.entries()).map(([name, ids]) => {
      // Always use first ID as primary for select value consistency
      const primaryId = ids[0];
      return { id: primaryId, name, ids };
    });
  } else {
    // Normal case: show all bands (or filtered by event)
    displayBands = filteredBands.map((b) => ({ id: b.id, name: b.name, ids: [b.id] }));
  }

  // Create sets of available IDs for quick lookup
  const availableCompanySlugs = new Set(
    availableFilters?.companies.map((c) => c.slug) || []
  );
  const availableEventIds = new Set(
    availableFilters?.events.map((e) => e.id) || []
  );
  const availableBandIds = new Set(
    availableFilters?.bands.map((b) => b.id) || []
  );
  const availablePhotographerNames = new Set(
    availableFilters?.photographers.map((p) => p.name) || []
  );

  // Determine which filters have available options
  const hasAvailableCompanies =
    !availableFilters ||
    availableFilters.companies.length > 0 ||
    availableFilters.hasPhotosWithoutCompany;
  const hasAvailableEvents =
    !availableFilters || availableFilters.events.length > 0;
  const hasAvailableBands =
    !availableFilters ||
    availableFilters.bands.length > 0 ||
    availableFilters.hasPhotosWithoutBand;
  const hasAvailablePhotographers =
    !availableFilters || availableFilters.photographers.length > 0;

  // Get display names for active filters
  const selectedEventName = events.find((e) => e.id === selectedEventId)?.name;
  const selectedBandName =
    selectedBandId === "none"
      ? "No Band"
      : selectedBandId && selectedBandId.startsWith("bandIds:")
      ? displayBands.find((db) => db.id === selectedBandId.split(":")[1]?.split(",")[0])?.name || "Band"
      : filteredBands.find((b) => b.id === selectedBandId)?.name;
  const selectedCompanyName =
    selectedCompanySlug === "none"
      ? "No Company"
      : companies.find((c) => c.slug === selectedCompanySlug)?.name;
  const hasActiveFilters =
    selectedEventId ||
    selectedBandId ||
    selectedPhotographer ||
    selectedCompanySlug;

  const handleClearAll = () => {
    onEventChange(null);
    onBandChange(null);
    onPhotographerChange(null);
    onCompanyChange(null);
  };

  // Ref to the photographer select element
  const photographerSelectRef = useRef<HTMLSelectElement>(null);

  // Explicitly set "All Photographers" as selected when photographers load and no photographer is selected
  useEffect(() => {
    if (
      photographerSelectRef.current &&
      !selectedPhotographer &&
      photographers.length > 0
    ) {
      // Ensure the first option (All Photographers) is selected
      photographerSelectRef.current.selectedIndex = 0;
    }
  }, [photographers.length, selectedPhotographer]);

  return (
    <FilterBar>
      {/* Company filter - first */}
      {companies.length > 0 && (
        <FilterSelect
          label="Company"
          value={selectedCompanySlug || ""}
          onChange={(e) => onCompanyChange(e.target.value || null)}
          disabled={loading || !hasAvailableCompanies}
        >
          <option value="">All Companies</option>
          {availableFilters?.hasPhotosWithoutCompany && (
            <option value="none">No Company</option>
          )}
          {companies.map((company) => {
            const isAvailable =
              !availableFilters || availableCompanySlugs.has(company.slug);
            return (
              <option
                key={company.slug}
                value={company.slug}
                disabled={!isAvailable}
              >
                {company.name}
                {!isAvailable ? " (0)" : ""}
              </option>
            );
          })}
        </FilterSelect>
      )}

      {/* Event filter */}
      <FilterSelect
        label="Event"
        value={selectedEventId || ""}
        onChange={(e) => onEventChange(e.target.value || null)}
        disabled={loading || !hasAvailableEvents}
      >
        <option value="">All Events</option>
        {events.map((event) => {
          const isAvailable =
            !availableFilters || availableEventIds.has(event.id);
          return (
            <option key={event.id} value={event.id} disabled={!isAvailable}>
              {event.name}
              {!isAvailable ? " (0)" : ""}
            </option>
          );
        })}
      </FilterSelect>

      {/* Band filter */}
      <FilterSelect
        label="Band"
        value={
          selectedBandId && selectedBandId.startsWith("bandIds:")
            ? selectedBandId.split(":")[1]?.split(",")[0] || ""
            : selectedBandId || ""
        }
        onChange={(e) => {
          const value = e.target.value || null;
          if (value === null || value === "none") {
            onBandChange(value);
          } else {
            // Find the display band entry to get all matching IDs
            const displayBand = displayBands.find((db) => db.id === value);
            if (displayBand && displayBand.ids.length > 1) {
              // Multiple IDs - need to pass all of them
              // Use a special format: "bandIds:id1,id2,id3"
              onBandChange(`bandIds:${displayBand.ids.join(",")}`);
            } else {
              // Single ID - normal behavior
              onBandChange(value);
            }
          }
        }}
        disabled={loading || !hasAvailableBands}
      >
        <option value="">All Bands</option>
        {availableFilters?.hasPhotosWithoutBand && (
          <option value="none">No Band</option>
        )}
        {displayBands.map((displayBand) => {
          const isAvailable =
            !availableFilters ||
            displayBand.ids.some((id) => availableBandIds.has(id));
          return (
            <option key={displayBand.id} value={displayBand.id} disabled={!isAvailable}>
              {displayBand.name}
              {!isAvailable ? " (0)" : ""}
            </option>
          );
        })}
      </FilterSelect>

      {/* Photographer filter - last */}
      <FilterSelect
        ref={photographerSelectRef}
        key={`photographer-${photographers.length}-${selectedPhotographer || 'all'}`}
        label="Photographer"
        value={selectedPhotographer ?? ""}
        onChange={(e) => {
          onPhotographerChange(e.target.value || null);
        }}
        disabled={loading || !hasAvailablePhotographers}
      >
        <option value="" key="all-photographers-default">All Photographers</option>
        {photographers.map((photographer) => {
          const isAvailable =
            !availableFilters ||
            availablePhotographerNames.has(photographer);
          return (
            <option
              key={photographer}
              value={photographer}
              disabled={!isAvailable}
            >
              {photographer}
              {!isAvailable ? " (0)" : ""}
            </option>
          );
        })}
      </FilterSelect>

      {/* Clear filters button */}
      <FilterClearButton disabled={!hasActiveFilters} onClick={handleClearAll} />

      {/* Active Filters Pills - order: Company > Event > Band > Photographer */}
      {hasActiveFilters && (
        <FilterPills className="w-full">
          {selectedCompanyName && (
            <FilterPill onRemove={() => onCompanyChange(null)}>
              {selectedCompanyName}
            </FilterPill>
          )}
          {selectedEventName && (
            <FilterPill onRemove={() => onEventChange(null)}>
              {selectedEventName}
            </FilterPill>
          )}
          {selectedBandName && (
            <FilterPill onRemove={() => onBandChange(null)}>
              {selectedBandName}
            </FilterPill>
          )}
          {selectedPhotographer && (
            <FilterPill onRemove={() => onPhotographerChange(null)}>
              {selectedPhotographer}
            </FilterPill>
          )}
        </FilterPills>
      )}
    </FilterBar>
  );
}
