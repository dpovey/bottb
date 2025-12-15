"use client";

import { Event, Band } from "@/lib/db";

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

  const selectClassName =
    "w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent hover:border-white/20 transition-colors disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat";

  return (
    <div className="bg-bg-elevated rounded-xl p-4 border border-white/5">
      <div className="flex flex-wrap gap-4">
        {/* Company filter - first */}
        {companies.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
              Company
            </label>
            <select
              value={selectedCompanySlug || ""}
              onChange={(e) => onCompanyChange(e.target.value || null)}
              disabled={loading || !hasAvailableCompanies}
              className={selectClassName}
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
            </select>
          </div>
        )}

        {/* Event filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            Event
          </label>
          <select
            value={selectedEventId || ""}
            onChange={(e) => onEventChange(e.target.value || null)}
            disabled={loading || !hasAvailableEvents}
            className={selectClassName}
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
          </select>
        </div>

        {/* Band filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            Band
          </label>
          <select
            value={selectedBandId || ""}
            onChange={(e) => onBandChange(e.target.value || null)}
            disabled={loading || !hasAvailableBands}
            className={selectClassName}
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
          </select>
        </div>

        {/* Photographer filter - last */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            Photographer
          </label>
          <select
            value={selectedPhotographer || ""}
            onChange={(e) => onPhotographerChange(e.target.value || null)}
            disabled={loading || !hasAvailablePhotographers}
            className={selectClassName}
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
          </select>
        </div>

        {/* Clear filters button */}
        <div className="flex items-end">
          <button
            onClick={() => {
              onEventChange(null);
              onBandChange(null);
              onPhotographerChange(null);
              onCompanyChange(null);
            }}
            disabled={!hasActiveFilters}
            className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-3 rounded-lg text-xs tracking-widest uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Active Filters Pills - order: Company > Event > Band > Photographer */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
          {selectedCompanyName && (
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
              {selectedCompanyName}
              <button
                onClick={() => onCompanyChange(null)}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${selectedCompanyName} filter`}
              >
                ×
              </button>
            </span>
          )}
          {selectedEventName && (
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
              {selectedEventName}
              <button
                onClick={() => onEventChange(null)}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${selectedEventName} filter`}
              >
                ×
              </button>
            </span>
          )}
          {selectedBandName && (
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
              {selectedBandName}
              <button
                onClick={() => onBandChange(null)}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${selectedBandName} filter`}
              >
                ×
              </button>
            </span>
          )}
          {selectedPhotographer && (
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
              {selectedPhotographer}
              <button
                onClick={() => onPhotographerChange(null)}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${selectedPhotographer} filter`}
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
