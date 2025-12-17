"use client";

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
        value={selectedBandId || ""}
        onChange={(e) => onBandChange(e.target.value || null)}
        disabled={loading || !hasAvailableBands}
      >
        <option value="">All Bands</option>
        {availableFilters?.hasPhotosWithoutBand && (
          <option value="none">No Band</option>
        )}
        {filteredBands.map((band) => {
          const isAvailable =
            !availableFilters || availableBandIds.has(band.id);
          return (
            <option key={band.id} value={band.id} disabled={!isAvailable}>
              {band.name}
              {!isAvailable ? " (0)" : ""}
            </option>
          );
        })}
      </FilterSelect>

      {/* Photographer filter - last */}
      <FilterSelect
        label="Photographer"
        value={selectedPhotographer || ""}
        onChange={(e) => onPhotographerChange(e.target.value || null)}
        disabled={loading || !hasAvailablePhotographers}
      >
        <option value="">All Photographers</option>
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
