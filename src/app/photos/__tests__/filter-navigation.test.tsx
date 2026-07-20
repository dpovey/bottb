/**
 * Filter persistence across navigation.
 *
 * Reproduces the reported bug: apply a filter in the gallery, navigate into a
 * photo/slideshow, then navigate BACK — the filter is dropped and every photo
 * is shown again.
 *
 * These tests mount the real PhotosContent and drive the filter → navigate →
 * back flow. They model the Next.js App Router quirk that a raw
 * window.history.replaceState() updates the address bar but does NOT update
 * useSearchParams(), which is the crux of the bug.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { useSearchParams, useRouter } from 'next/navigation'
import { PhotosContent } from '../photos-content'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ---------------------------------------------------------------------------
// Fake browser + Next router harness
//
// The router's searchParams are ONLY updated by router.push/replace. A raw
// window.history.replaceState updates the address bar (fakeLocation) but NOT
// the router's searchParams — matching real Next App Router behaviour.
// ---------------------------------------------------------------------------
let routerSearchParams: URLSearchParams
let fakeLocationSearch: string
const pushMock = vi.fn()
const replaceMock = vi.fn()

function setUrl(search: string) {
  fakeLocationSearch = search
  routerSearchParams = new URLSearchParams(search)
}

beforeEach(() => {
  vi.clearAllMocks()
  setUrl('')

  // Router: push/replace are the ONLY things that update searchParams.
  ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })
  ;(useSearchParams as ReturnType<typeof vi.fn>).mockImplementation(
    () => routerSearchParams
  )

  // window.location — read the address bar.
  Object.defineProperty(window, 'location', {
    value: { href: 'http://localhost/photos', pathname: '/photos', search: '' },
    writable: true,
  })
  Object.defineProperty(window.location, 'search', {
    get: () => fakeLocationSearch,
    configurable: true,
  })
  Object.defineProperty(window.location, 'href', {
    get: () => `http://localhost/photos${fakeLocationSearch}`,
    configurable: true,
  })

  // window.history — raw replaceState updates the address bar only.
  Object.defineProperty(window, 'history', {
    value: {
      state: { __nextInternal: 'tree' },
      replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
        const q = url.indexOf('?')
        setUrlAddressBarOnly(q === -1 ? '' : url.slice(q))
      }),
      pushState: vi.fn(),
    },
    writable: true,
  })

  // localStorage
  const store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((k: string) => store[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k]
      }),
      clear: vi.fn(() => {
        for (const k of Object.keys(store)) delete store[k]
      }),
    },
    writable: true,
  })
})

// Raw history.replaceState updates the address bar but NOT the router hook.
function setUrlAddressBarOnly(search: string) {
  fakeLocationSearch = search
}

// ---------------------------------------------------------------------------
// Recording fetch — records every /api/photos request and serves photos.
// ---------------------------------------------------------------------------
interface PhotoApiCall {
  url: string
  params: URLSearchParams
}
let photoApiCalls: PhotoApiCall[]

const ALL_PHOTOS = [
  { id: 'photo-1', event_id: 'event-1', photographer: 'John Doe' },
  { id: 'photo-2', event_id: 'event-2', photographer: 'Jane Smith' },
]

function makePhoto(p: { id: string; event_id: string; photographer: string }) {
  return {
    id: p.id,
    slug: `${p.id}-slug`,
    blob_url: `https://example.com/${p.id}.webp`,
    thumbnail_url: `https://example.com/${p.id}-thumb.webp`,
    event_id: p.event_id,
    band_id: 'band-1',
    event_name: 'Test Event',
    band_name: 'Test Band',
    photographer: p.photographer,
    labels: [],
    company_slug: null,
    company_name: null,
    cluster_photos: [],
  }
}

beforeEach(() => {
  photoApiCalls = []
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.startsWith('/api/photos?') || url === '/api/photos') {
      const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      const params = new URLSearchParams(qs)
      photoApiCalls.push({ url, params })

      const eventId = params.get('event')
      const photographer = params.get('photographer')
      let photos = ALL_PHOTOS
      if (eventId) photos = photos.filter((p) => p.event_id === eventId)
      if (photographer)
        photos = photos.filter((p) => p.photographer === photographer)

      return Promise.resolve({
        ok: true,
        json: async () => ({
          photos: photos.map(makePhoto),
          pagination: {
            page: 1,
            limit: 50,
            total: photos.length,
            totalPages: 1,
          },
          photographers: ['John Doe', 'Jane Smith'],
          companies: [],
          availableFilters: {
            companies: [],
            events: [
              { id: 'event-1', name: 'Test Event', count: 1 },
              { id: 'event-2', name: 'Other Event', count: 1 },
            ],
            photographers: [
              { name: 'John Doe', count: 1 },
              { name: 'Jane Smith', count: 1 },
            ],
            hasPhotosWithoutCompany: false,
          },
        }),
      }) as unknown as Promise<Response>
    }

    // Events endpoints used on mount
    return Promise.resolve({
      ok: true,
      json: async () => [],
    }) as unknown as Promise<Response>
  }) as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

const initialFilterOptions = {
  events: [
    { id: 'event-1', name: 'Test Event', date: '2024-01-01', count: 1 },
    { id: 'event-2', name: 'Other Event', date: '2024-02-01', count: 1 },
  ],
  companies: [],
  photographers: ['John Doe', 'Jane Smith'],
  totalPhotos: 2,
} as never

function lastPhotoFetch() {
  return photoApiCalls[photoApiCalls.length - 1]
}

// The FilterSelect label is not associated with its <select>, so locate the
// Event dropdown by the option it contains.
function getEventSelect(): HTMLSelectElement {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
  const eventSelect = selects.find((s) =>
    within(s).queryByRole('option', { name: 'Test Event' })
  )
  if (!eventSelect) throw new Error('Event select not found')
  return eventSelect
}

describe('Gallery filter persistence across navigation', () => {
  it('applies the initial filter fetch with no event when landing fresh', async () => {
    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialFilterOptions={initialFilterOptions}
        initialTotalPhotos={2}
      />
    )

    await waitFor(() => expect(photoApiCalls.length).toBeGreaterThan(0))
    expect(lastPhotoFetch().params.get('event')).toBeNull()
  })

  it('selecting an event filter updates the URL through the Next router (so back-nav keeps it)', async () => {
    const user = userEvent.setup()
    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialFilterOptions={initialFilterOptions}
        initialTotalPhotos={2}
      />
    )

    await waitFor(() => expect(photoApiCalls.length).toBeGreaterThan(0))

    const eventSelect = getEventSelect()
    await user.selectOptions(eventSelect, 'event-1')

    // The fetch should re-run filtered by the event.
    await waitFor(() =>
      expect(lastPhotoFetch().params.get('event')).toBe('event-1')
    )

    // The filter MUST be committed to the router-tracked URL (router.replace),
    // not a raw window.history.replaceState that Next's useSearchParams cannot
    // see. Otherwise a subsequent back-navigation restores an unfiltered URL.
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled()
      const target =
        replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0]
      expect(String(target)).toContain('event=event-1')
    })
  })

  it('never wipes Next.js router history state when writing filters', async () => {
    const user = userEvent.setup()
    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialFilterOptions={initialFilterOptions}
        initialTotalPhotos={2}
      />
    )
    await waitFor(() => expect(photoApiCalls.length).toBeGreaterThan(0))

    const eventSelect = getEventSelect()
    await user.selectOptions(eventSelect, 'event-1')
    await waitFor(() =>
      expect(lastPhotoFetch().params.get('event')).toBe('event-1')
    )

    // If replaceState is used at all, it must preserve the existing Next state
    // (never pass an empty object, which corrupts back/forward restoration).
    const replaceStateMock = window.history.replaceState as ReturnType<
      typeof vi.fn
    >
    for (const call of replaceStateMock.mock.calls) {
      expect(call[0]).toEqual({ __nextInternal: 'tree' })
    }
  })

  it('restores a filter from the URL after navigating back (searchParams reflect the filtered URL)', async () => {
    // Simulate the state after back-navigation: the browser is at
    // /photos?event=event-1 and the router hook reflects it.
    setUrl('?event=event-1')

    render(
      <PhotosContent
        initialEventId={'event-1'}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialFilterOptions={initialFilterOptions}
        initialTotalPhotos={2}
      />
    )

    await waitFor(() => expect(photoApiCalls.length).toBeGreaterThan(0))
    // Every photo fetch must be scoped to the event — no unfiltered fetch.
    for (const call of photoApiCalls) {
      expect(call.params.get('event')).toBe('event-1')
    }

    // Only the matching photo is shown.
    expect(lastPhotoFetch().params.get('event')).toBe('event-1')
  })

  it('restores a filter from localStorage on a fresh visit without ever fetching unfiltered photos', async () => {
    // User previously filtered to event-1; localStorage remembers it.
    window.localStorage.setItem(
      'photos-filters',
      JSON.stringify({ event: 'event-1' })
    )
    setUrl('') // no URL params (e.g. clicked the top-nav "Photos" link)

    render(
      <PhotosContent
        initialEventId={null}
        initialPhotographer={null}
        initialCompanySlug={null}
        initialFilterOptions={initialFilterOptions}
        initialTotalPhotos={2}
      />
    )

    await waitFor(() => expect(photoApiCalls.length).toBeGreaterThan(0))

    // The bug: an unfiltered fetch fires before/instead of the restored filter.
    for (const call of photoApiCalls) {
      expect(call.params.get('event')).toBe('event-1')
    }
  })
})
