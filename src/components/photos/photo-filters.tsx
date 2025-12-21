'use client'

import { Event } from '@/lib/db'
import {
  FilterBar,
  FilterSelect,
  FilterPill,
  FilterPills,
  FilterClearButton,
} from '@/components/ui'

interface Company {
  slug: string
  name: string
}

interface AvailableFilters {
  companies: { slug: string; name: string; count: number }[]
  events: { id: string; name: string; count: number }[]
  photographers: { name: string; count: number }[]
  hasPhotosWithoutCompany: boolean
}

interface PhotoFiltersProps {
  events: Event[]
  photographers: string[]
  companies?: Company[]
  availableFilters?: AvailableFilters
  selectedEventId: string | null
  selectedPhotographer: string | null
  selectedCompanySlug: string | null
  onEventChange: (eventId: string | null) => void
  onPhotographerChange: (photographer: string | null) => void
  onCompanyChange: (companySlug: string | null) => void
  loading?: boolean
}

export function PhotoFilters({
  events,
  photographers,
  companies = [],
  availableFilters,
  selectedEventId,
  selectedPhotographer,
  selectedCompanySlug,
  onEventChange,
  onPhotographerChange,
  onCompanyChange,
  loading,
}: PhotoFiltersProps) {
  // Filter options to only show those with results (faceted search pattern)
  // This replaces the previous "disable unavailable" pattern which was confusing

  // Companies: show only those with photos matching current filters
  const displayCompanies = availableFilters
    ? companies.filter(
        (c) =>
          availableFilters.companies.some((ac) => ac.slug === c.slug) ||
          c.slug === selectedCompanySlug // Always show currently selected
      )
    : companies

  // Events: show only those with photos matching current filters
  const displayEvents = availableFilters
    ? events.filter(
        (e) =>
          availableFilters.events.some((ae) => ae.id === e.id) ||
          e.id === selectedEventId // Always show currently selected
      )
    : events

  // Photographers: show only those with photos matching current filters
  const displayPhotographers = availableFilters
    ? photographers.filter(
        (p) =>
          availableFilters.photographers.some((ap) => ap.name === p) ||
          p === selectedPhotographer // Always show currently selected
      )
    : photographers

  // Get display names for active filters
  const selectedEventName = events.find((e) => e.id === selectedEventId)?.name
  const selectedCompanyName =
    selectedCompanySlug === 'none'
      ? 'No Company'
      : companies.find((c) => c.slug === selectedCompanySlug)?.name
  const hasActiveFilters =
    selectedEventId || selectedPhotographer || selectedCompanySlug

  const handleClearAll = () => {
    onEventChange(null)
    onPhotographerChange(null)
    onCompanyChange(null)
  }

  return (
    <FilterBar>
      {/* Company filter - first */}
      {companies.length > 0 && (
        <FilterSelect
          label="Company"
          value={selectedCompanySlug || ''}
          onChange={(e) => onCompanyChange(e.target.value || null)}
          disabled={loading}
        >
          <option value="">All Companies</option>
          {availableFilters?.hasPhotosWithoutCompany && (
            <option value="none">No Company</option>
          )}
          {displayCompanies.map((company) => (
            <option key={company.slug} value={company.slug}>
              {company.name}
            </option>
          ))}
        </FilterSelect>
      )}

      {/* Event filter */}
      <FilterSelect
        label="Event"
        value={selectedEventId || ''}
        onChange={(e) => onEventChange(e.target.value || null)}
        disabled={loading || displayEvents.length === 0}
      >
        <option value="">All Events</option>
        {displayEvents.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </FilterSelect>

      {/* Photographer filter */}
      <FilterSelect
        label="Photographer"
        value={selectedPhotographer ?? ''}
        onChange={(e) => {
          onPhotographerChange(e.target.value || null)
        }}
        disabled={loading || displayPhotographers.length === 0}
      >
        <option value="">All Photographers</option>
        {displayPhotographers.map((photographer) => (
          <option key={photographer} value={photographer}>
            {photographer}
          </option>
        ))}
      </FilterSelect>

      {/* Clear filters button */}
      <FilterClearButton
        disabled={!hasActiveFilters}
        onClick={handleClearAll}
      />

      {/* Active Filters Pills - order: Company > Event > Photographer */}
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
          {selectedPhotographer && (
            <FilterPill onRemove={() => onPhotographerChange(null)}>
              {selectedPhotographer}
            </FilterPill>
          )}
        </FilterPills>
      )}
    </FilterBar>
  )
}
