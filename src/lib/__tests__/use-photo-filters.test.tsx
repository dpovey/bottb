/**
 * Tests for usePhotoFilters — the shared filter state hook used by the gallery
 * and slideshow. These lock in the behaviour that fixes the "filters lost on
 * back-navigation" bug:
 *
 *  - filter changes are committed through the Next router (never a raw
 *    history.replaceState that useSearchParams can't see),
 *  - the URL is reconciled on back/forward,
 *  - persistence restores filters on a fresh visit.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePhotoFilters } from '../use-photo-filters'
import { DEFAULT_PHOTO_FILTERS, type PhotoFilters } from '../photo-filters'

const replaceMock = vi.fn()
let currentSearchParams: URLSearchParams

function setSearchParams(search: string) {
  currentSearchParams = new URLSearchParams(search)
}

beforeEach(() => {
  vi.clearAllMocks()
  setSearchParams('')
  ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
    push: vi.fn(),
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })
  ;(useSearchParams as ReturnType<typeof vi.fn>).mockImplementation(
    () => currentSearchParams
  )

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
      clear: vi.fn(),
    },
    writable: true,
  })
})

afterEach(() => vi.restoreAllMocks())

const initial: PhotoFilters = { ...DEFAULT_PHOTO_FILTERS }

describe('usePhotoFilters — committing changes', () => {
  it('commits a filter change to the URL through the Next router', () => {
    const { result } = renderHook(() => usePhotoFilters({ initial }))

    act(() => result.current.setFilters({ eventId: 'event-1' }))

    expect(result.current.filters.eventId).toBe('event-1')
    expect(replaceMock).toHaveBeenCalledWith('/photos?event=event-1', {
      scroll: false,
    })
  })

  it('writes to /photos with no query when a filter is cleared', () => {
    setSearchParams('event=event-1')
    const { result } = renderHook(() =>
      usePhotoFilters({ initial: { ...initial, eventId: 'event-1' } })
    )

    act(() => result.current.setFilters({ eventId: null }))

    expect(result.current.filters.eventId).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/photos', { scroll: false })
  })

  it('honours a custom basePath (slideshow keeps its photo id)', () => {
    const { result } = renderHook(() =>
      usePhotoFilters({ initial, basePath: '/slideshow/photo-9' })
    )

    act(() => result.current.setFilters({ eventId: 'event-1' }))

    expect(replaceMock).toHaveBeenCalledWith(
      '/slideshow/photo-9?event=event-1',
      { scroll: false }
    )
  })

  it('honours a per-call path override', () => {
    const { result } = renderHook(() => usePhotoFilters({ initial }))

    act(() =>
      result.current.setFilters(
        { photographer: 'Jane' },
        { path: '/slideshow/photo-3' }
      )
    )

    expect(replaceMock).toHaveBeenCalledWith(
      '/slideshow/photo-3?photographer=Jane',
      { scroll: false }
    )
  })

  it('updates state without touching the URL when commitUrl is false', () => {
    const { result } = renderHook(() =>
      usePhotoFilters({ initial: { ...initial, shuffle: 'true' } })
    )

    act(() =>
      result.current.setFilters({ shuffle: 'seed-abc' }, { commitUrl: false })
    )

    expect(result.current.filters.shuffle).toBe('seed-abc')
    expect(replaceMock).not.toHaveBeenCalled()
  })
})

describe('usePhotoFilters — reconciling with the URL (back/forward)', () => {
  it('adopts a filter that appears in the URL', () => {
    const { result, rerender } = renderHook(() => usePhotoFilters({ initial }))
    expect(result.current.filters.eventId).toBeNull()

    // Simulate the browser navigating back to a filtered URL.
    act(() => setSearchParams('event=event-7'))
    rerender()

    expect(result.current.filters.eventId).toBe('event-7')
  })

  it('preserves current filters for dimensions the URL does not mention', () => {
    const { result, rerender } = renderHook(() =>
      usePhotoFilters({
        initial: { ...initial, photographer: 'Jane' },
      })
    )

    act(() => setSearchParams('event=event-7'))
    rerender()

    expect(result.current.filters.eventId).toBe('event-7')
    expect(result.current.filters.photographer).toBe('Jane')
  })
})

describe('usePhotoFilters — persistence', () => {
  it('restores filters from localStorage on a fresh visit', async () => {
    window.localStorage.setItem(
      'photos-filters',
      JSON.stringify({ eventId: 'event-5', shuffle: 'seed-9' })
    )

    const { result } = renderHook(() =>
      usePhotoFilters({ initial, persistKey: 'photos-filters' })
    )

    await waitFor(() => expect(result.current.filters.eventId).toBe('event-5'))
    expect(result.current.filters.shuffle).toBe('seed-9')
    expect(result.current.hydrated).toBe(true)
  })

  it('supports the legacy persisted key names (event/company)', async () => {
    window.localStorage.setItem(
      'photos-filters',
      JSON.stringify({ event: 'event-5', company: 'acme' })
    )

    const { result } = renderHook(() =>
      usePhotoFilters({ initial, persistKey: 'photos-filters' })
    )

    await waitFor(() => expect(result.current.filters.eventId).toBe('event-5'))
    expect(result.current.filters.companySlug).toBe('acme')
  })

  it('lets the URL win over persisted filters', async () => {
    window.localStorage.setItem(
      'photos-filters',
      JSON.stringify({ eventId: 'stored-event' })
    )
    setSearchParams('event=url-event')

    const { result } = renderHook(() =>
      usePhotoFilters({
        initial: { ...initial, eventId: 'url-event' },
        persistKey: 'photos-filters',
      })
    )

    // Hydrated immediately (no restore needed) and keeps the URL's event.
    expect(result.current.hydrated).toBe(true)
    await waitFor(() =>
      expect(result.current.filters.eventId).toBe('url-event')
    )
  })

  it('saves filters to localStorage when they change', async () => {
    const { result } = renderHook(() =>
      usePhotoFilters({ initial, persistKey: 'photos-filters' })
    )

    act(() => result.current.setFilters({ eventId: 'event-2' }))

    await waitFor(() => {
      const saved = window.localStorage.getItem('photos-filters')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved as string).eventId).toBe('event-2')
    })
  })

  it('does not persist when no persistKey is given (slideshow)', () => {
    const { result } = renderHook(() => usePhotoFilters({ initial }))
    act(() => result.current.setFilters({ eventId: 'event-2' }))
    expect(window.localStorage.setItem).not.toHaveBeenCalled()
    expect(result.current.hydrated).toBe(true)
  })
})
