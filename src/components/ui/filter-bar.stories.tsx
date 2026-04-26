import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import {
  FilterBar,
  FilterSelect,
  FilterSearch,
  FilterPill,
  FilterPills,
  FilterClearButton,
} from './filter-bar'

const meta: Meta<typeof FilterBar> = {
  title: 'Forms/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A composable system for building filter interfaces. Used in Photos page and Songs page.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof FilterBar>

// Basic FilterBar
export const Default: Story = {
  render: () => (
    <FilterBar>
      <FilterSelect label="Event">
        <option value="">All Events</option>
        <option value="sydney-2025">Sydney 2025</option>
        <option value="brisbane-2024">Brisbane 2024</option>
      </FilterSelect>
      <FilterSearch label="Search" placeholder="Search..." />
      <FilterClearButton disabled />
    </FilterBar>
  ),
}

// FilterSelect only
export const SelectOnly: Story = {
  render: () => (
    <div className="max-w-sm">
      <FilterSelect label="Event">
        <option value="">All Events</option>
        <option value="sydney-2025">Sydney Tech Battle 2025</option>
        <option value="brisbane-2024">Brisbane Tech Battle 2024</option>
      </FilterSelect>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Styled dropdown with custom arrow indicator.',
      },
    },
  },
}

// FilterSearch only
export const SearchOnly: Story = {
  render: () => {
    const SearchDemo = () => {
      const [value, setValue] = useState('')
      return (
        <div className="max-w-sm">
          <FilterSearch
            label="Search"
            placeholder="Search songs..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onClear={() => setValue('')}
          />
        </div>
      )
    }
    return <SearchDemo />
  },
  parameters: {
    docs: {
      description: {
        story: 'Search input with icon and clear button when value exists.',
      },
    },
  },
}

// FilterPill examples
export const Pills: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <FilterPill onRemove={() => {}}>Sydney Tech Battle 2025</FilterPill>
      <FilterPill onRemove={() => {}}>The Agentics</FilterPill>
      <FilterPill onRemove={() => {}}>Cover</FilterPill>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Removable pills showing active filters.',
      },
    },
  },
}

// Complete interactive example
export const Interactive: Story = {
  render: () => {
    const InteractiveDemo = () => {
      const [search, setSearch] = useState('')
      const [event, setEvent] = useState('')
      const [band, setBand] = useState('')

      const hasActiveFilters = search || event || band

      return (
        <FilterBar>
          <FilterSearch
            label="Search"
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />

          <FilterSelect
            label="Event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            <option value="">All Events</option>
            <option value="sydney-2025">Sydney Tech Battle 2025</option>
            <option value="brisbane-2024">Brisbane Tech Battle 2024</option>
          </FilterSelect>

          <FilterSelect
            label="Band"
            value={band}
            onChange={(e) => setBand(e.target.value)}
          >
            <option value="">All Bands</option>
            <option value="agentics">The Agentics</option>
            <option value="code-rockers">Code Rockers</option>
          </FilterSelect>

          <FilterClearButton
            disabled={!hasActiveFilters}
            onClick={() => {
              setSearch('')
              setEvent('')
              setBand('')
            }}
          />

          {hasActiveFilters && (
            <FilterPills className="w-full">
              {search && (
                <FilterPill onRemove={() => setSearch('')}>
                  &ldquo;{search}&rdquo;
                </FilterPill>
              )}
              {event && (
                <FilterPill onRemove={() => setEvent('')}>
                  {event === 'sydney-2025'
                    ? 'Sydney Tech Battle 2025'
                    : 'Brisbane Tech Battle 2024'}
                </FilterPill>
              )}
              {band && (
                <FilterPill onRemove={() => setBand('')}>
                  {band === 'agentics' ? 'The Agentics' : 'Code Rockers'}
                </FilterPill>
              )}
            </FilterPills>
          )}
        </FilterBar>
      )
    }
    return <InteractiveDemo />
  },
  parameters: {
    docs: {
      description: {
        story:
          'Complete interactive filter bar with search, selects, and pills.',
      },
    },
  },
}

// Photos page example
export const PhotosPageExample: Story = {
  render: () => (
    <FilterBar>
      <FilterSelect label="Event">
        <option value="">All Events</option>
        <option value="sydney-2025">Sydney Tech Battle 2025</option>
      </FilterSelect>

      <FilterSelect label="Band">
        <option value="">All Bands</option>
        <option value="agentics">The Agentics</option>
        <option value="code-rockers">Code Rockers</option>
      </FilterSelect>

      <FilterSelect label="Photographer">
        <option value="">All Photographers</option>
        <option value="john">John Smith</option>
        <option value="jane">Jane Doe</option>
      </FilterSelect>

      <FilterClearButton disabled />
    </FilterBar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Filter bar as used on the Photos page.',
      },
    },
  },
}

// Songs page example
export const SongsPageExample: Story = {
  render: () => (
    <FilterBar>
      <FilterSearch label="Search" placeholder="Search songs, artists..." />

      <FilterSelect label="Event">
        <option value="">All Events</option>
        <option value="sydney-2025">Sydney 2025</option>
      </FilterSelect>

      <FilterSelect label="Type">
        <option value="">All Types</option>
        <option value="cover">Cover</option>
        <option value="mashup">Mashup</option>
        <option value="medley">Medley</option>
      </FilterSelect>

      <FilterClearButton disabled />
    </FilterBar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Filter bar as used on the Songs page.',
      },
    },
  },
}
