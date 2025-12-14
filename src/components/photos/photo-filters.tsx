"use client";

import { Event, Band } from "@/lib/db";

interface PhotoFiltersProps {
  events: Event[];
  bands: Band[];
  photographers: string[];
  selectedEventId: string | null;
  selectedBandId: string | null;
  selectedPhotographer: string | null;
  onEventChange: (eventId: string | null) => void;
  onBandChange: (bandId: string | null) => void;
  onPhotographerChange: (photographer: string | null) => void;
  loading?: boolean;
}

export function PhotoFilters({
  events,
  bands,
  photographers,
  selectedEventId,
  selectedBandId,
  selectedPhotographer,
  onEventChange,
  onBandChange,
  onPhotographerChange,
  loading,
}: PhotoFiltersProps) {
  // Filter bands by selected event
  const filteredBands = selectedEventId
    ? bands.filter((b) => b.event_id === selectedEventId)
    : bands;

  // Get display names for active filters
  const selectedEventName = events.find((e) => e.id === selectedEventId)?.name;
  const selectedBandName = filteredBands.find((b) => b.id === selectedBandId)?.name;
  const hasActiveFilters = selectedEventId || selectedBandId || selectedPhotographer;

  return (
    <div className="bg-bg-elevated rounded-xl p-4 border border-white/5">
      <div className="flex flex-wrap gap-4">
        {/* Event filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            Event
          </label>
          <select
            value={selectedEventId || ""}
            onChange={(e) => {
              onEventChange(e.target.value || null);
              onBandChange(null); // Reset band when event changes
            }}
            disabled={loading}
            className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent hover:border-white/20 transition-colors disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
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
            disabled={loading || filteredBands.length === 0}
            className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent hover:border-white/20 transition-colors disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
          >
            <option value="">All Bands</option>
            {filteredBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </div>

        {/* Photographer filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] tracking-widest uppercase text-text-dim mb-2">
            Photographer
          </label>
          <select
            value={selectedPhotographer || ""}
            onChange={(e) => onPhotographerChange(e.target.value || null)}
            disabled={loading || photographers.length === 0}
            className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent hover:border-white/20 transition-colors disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')] bg-[length:1.25em_1.25em] bg-[right_0.75rem_center] bg-no-repeat"
          >
            <option value="">All Photographers</option>
            {photographers.map((photographer) => (
              <option key={photographer} value={photographer}>
                {photographer}
              </option>
            ))}
          </select>
        </div>

        {/* Clear filters button */}
        <div className="flex items-end">
          <button
            onClick={() => {
              onEventChange(null);
              onBandChange(null);
              onPhotographerChange(null);
            }}
            disabled={!hasActiveFilters}
            className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-3 rounded-lg text-xs tracking-widest uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Active Filters Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
          {selectedEventName && (
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
              {selectedEventName}
              <button
                onClick={() => {
                  onEventChange(null);
                  onBandChange(null); // Reset band too since it depends on event
                }}
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

