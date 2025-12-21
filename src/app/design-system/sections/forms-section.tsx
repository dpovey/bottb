'use client'

import { useState } from 'react'
import {
  FilterBar,
  FilterSelect,
  FilterSearch,
  FilterPill,
  FilterPills,
  FilterClearButton,
  Button,
} from '@/components/ui'
import { CheckIcon } from '@/components/icons'

export function FormsSection() {
  const [searchValue, setSearchValue] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [bandFilter, setBandFilter] = useState('')
  const [selectedBand, setSelectedBand] = useState<string | null>(
    'code-rockers'
  )

  const hasFilters = searchValue || eventFilter || bandFilter

  const handleClear = () => {
    setSearchValue('')
    setEventFilter('')
    setBandFilter('')
  }

  return (
    <div className="space-y-20">
      {/* Text Inputs */}
      <section id="form-elements">
        <h2 className="font-semibold text-4xl mb-8">Form Elements</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Text Input */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Text Input
            </h3>
            <div>
              <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
              />
            </div>
          </div>

          {/* Textarea */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Textarea
            </h3>
            <div>
              <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                Message
              </label>
              <textarea
                placeholder="Your message..."
                rows={4}
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20 resize-none"
              />
            </div>
          </div>

          {/* Input States */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Input States
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                  Default
                </label>
                <input
                  type="text"
                  placeholder="Default state"
                  className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                  Disabled
                </label>
                <input
                  type="text"
                  placeholder="Disabled state"
                  disabled
                  className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-error mb-2">
                  Error
                </label>
                <input
                  type="text"
                  placeholder="Error state"
                  className="w-full px-4 py-3 bg-bg border border-error/50 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-error"
                />
                <p className="text-error text-sm mt-1">
                  This field is required
                </p>
              </div>
            </div>
          </div>

          {/* Voting Selection */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Selection (Voting)
            </h3>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedBand === 'agentics'
                    ? 'bg-accent/10 border border-accent/40'
                    : 'bg-bg border border-white/10 hover:border-white/20'
                }`}
                onClick={() => setSelectedBand('agentics')}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    selectedBand === 'agentics'
                      ? 'bg-accent border border-accent'
                      : 'border border-white/30'
                  }`}
                >
                  {selectedBand === 'agentics' && (
                    <CheckIcon className="w-3 h-3 text-bg" />
                  )}
                </div>
                <div>
                  <p className="font-medium">The Agentics</p>
                  <p className="text-text-dim text-sm">Salesforce</p>
                </div>
              </label>
              <label
                className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedBand === 'code-rockers'
                    ? 'bg-accent/10 border border-accent/40'
                    : 'bg-bg border border-white/10 hover:border-white/20'
                }`}
                onClick={() => setSelectedBand('code-rockers')}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    selectedBand === 'code-rockers'
                      ? 'bg-accent border border-accent'
                      : 'border border-white/30'
                  }`}
                >
                  {selectedBand === 'code-rockers' && (
                    <CheckIcon className="w-3 h-3 text-bg" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Code Rockers</p>
                  <p className="text-text-dim text-sm">Google</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Components */}
      <section id="filter-components">
        <h2 className="font-semibold text-4xl mb-8">Filter Components</h2>
        <p className="text-text-muted text-lg mb-8 max-w-3xl">
          Standardized filter components for filtering data. Always use
          FilterSelect for dropdowns to ensure consistent chevron styling.
        </p>

        <div className="space-y-8">
          {/* FilterSelect */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              FilterSelect (Dropdown)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Styled dropdown with custom chevron.{' '}
              <strong className="text-white">
                Always use this instead of raw &lt;select&gt;.
              </strong>
            </p>

            <div className="flex flex-wrap gap-6 items-end">
              {/* With Label */}
              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <FilterSelect label="Event">
                  <option>All Events</option>
                  <option>Sydney Tech Battle 2025</option>
                  <option>Brisbane Battle 2025</option>
                </FilterSelect>
              </div>

              {/* Without Label */}
              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <FilterSelect>
                  <option>All Bands</option>
                  <option>The Agentics</option>
                  <option>Code Rockers</option>
                </FilterSelect>
              </div>
            </div>
          </div>

          {/* FilterSearch */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              FilterSearch
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Search input with icon and optional clear button.
            </p>

            <div className="flex-1 min-w-[240px] max-w-md">
              <FilterSearch
                label="Search"
                placeholder="Search songs, bands..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onClear={() => setSearchValue('')}
              />
            </div>
          </div>

          {/* FilterBar (Complete) */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              FilterBar (Complete Example)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Wraps all filter elements with consistent styling. Used on Photos,
              Videos, Songs pages.
            </p>

            <FilterBar>
              <FilterSearch
                label="Search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onClear={() => setSearchValue('')}
                className="flex-1 min-w-[200px]"
              />

              <FilterSelect
                label="Event"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="min-w-[180px]"
              >
                <option value="">All Events</option>
                <option value="sydney-2025">Sydney 2025</option>
                <option value="brisbane-2025">Brisbane 2025</option>
              </FilterSelect>

              <FilterSelect
                label="Band"
                value={bandFilter}
                onChange={(e) => setBandFilter(e.target.value)}
                className="min-w-[180px]"
              >
                <option value="">All Bands</option>
                <option value="agentics">The Agentics</option>
                <option value="code-rockers">Code Rockers</option>
              </FilterSelect>

              <FilterClearButton onClick={handleClear} disabled={!hasFilters} />
            </FilterBar>

            {/* Active Filter Pills */}
            {hasFilters && (
              <FilterPills className="mt-4">
                {eventFilter && (
                  <FilterPill onRemove={() => setEventFilter('')}>
                    {eventFilter === 'sydney-2025'
                      ? 'Sydney 2025'
                      : 'Brisbane 2025'}
                  </FilterPill>
                )}
                {bandFilter && (
                  <FilterPill onRemove={() => setBandFilter('')}>
                    {bandFilter === 'agentics'
                      ? 'The Agentics'
                      : 'Code Rockers'}
                  </FilterPill>
                )}
                {searchValue && (
                  <FilterPill onRemove={() => setSearchValue('')}>
                    &quot;{searchValue}&quot;
                  </FilterPill>
                )}
              </FilterPills>
            )}
          </div>

          {/* Usage Code */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              React Component
            </h3>
            <p className="text-text-dim text-sm mb-4">
              Location:{' '}
              <code className="bg-bg-surface px-2 py-0.5 rounded-sm text-xs">
                src/components/ui/filter-bar.tsx
              </code>
            </p>

            <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
              <code className="text-text-dim">{`import { FilterBar, FilterSelect, FilterSearch, FilterClearButton } from "@/components/ui";

<FilterBar>
  <FilterSearch
    label="Search"
    placeholder="Search songs..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    onClear={() => setSearch("")}
  />
  
  <FilterSelect label="Event" value={event} onChange={handleEventChange}>
    <option value="">All Events</option>
    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
  </FilterSelect>
  
  <FilterClearButton onClick={handleClear} disabled={!hasFilters} />
</FilterBar>`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Form Layout Example */}
      <section id="form-layout">
        <h2 className="font-semibold text-4xl mb-8">Form Layout Example</h2>

        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5 max-w-lg">
          <h3 className="font-medium text-xl mb-6">Contact Form</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-text-muted mb-2">
                Message
              </label>
              <textarea
                placeholder="Your message..."
                rows={4}
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-text-dim transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20 resize-none"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <Button variant="filled" type="submit">
                Send Message
              </Button>
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
