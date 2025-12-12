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

  return (
    <div className="flex flex-wrap gap-3 p-4 bg-gray-900/50 rounded-xl backdrop-blur-sm">
      {/* Event filter */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
          Event
        </label>
        <select
          value={selectedEventId || ""}
          onChange={(e) => {
            onEventChange(e.target.value || null);
            onBandChange(null); // Reset band when event changes
          }}
          disabled={loading}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
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
        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
          Band
        </label>
        <select
          value={selectedBandId || ""}
          onChange={(e) => onBandChange(e.target.value || null)}
          disabled={loading || filteredBands.length === 0}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
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
        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
          Photographer
        </label>
        <select
          value={selectedPhotographer || ""}
          onChange={(e) => onPhotographerChange(e.target.value || null)}
          disabled={loading || photographers.length === 0}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
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
      {(selectedEventId || selectedBandId || selectedPhotographer) && (
        <div className="flex items-end">
          <button
            onClick={() => {
              onEventChange(null);
              onBandChange(null);
              onPhotographerChange(null);
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

