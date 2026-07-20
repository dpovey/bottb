import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PHOTO_FILTERS,
  arePhotoFiltersEqual,
  buildGalleryUrl,
  groupTypesFromFilters,
  hasAnyPhotoFilterParam,
  parsePhotoFilters,
  photoFiltersToApiParams,
  reconcilePhotoFiltersFromUrl,
  serializePhotoFilters,
  type PhotoFilters,
} from '../photo-filters'

const sp = (search: string) => new URLSearchParams(search)

describe('parsePhotoFilters', () => {
  it('returns defaults for an empty URL', () => {
    expect(parsePhotoFilters(sp(''))).toEqual(DEFAULT_PHOTO_FILTERS)
  })

  it('parses every dimension from canonical params', () => {
    const filters = parsePhotoFilters(
      sp('event=e1&photographer=Jane+Doe&company=acme&shuffle=seed9')
    )
    expect(filters).toEqual({
      eventId: 'e1',
      photographer: 'Jane Doe',
      companySlug: 'acme',
      shuffle: 'seed9',
      groupDuplicates: true,
      groupScenes: true,
    })
  })

  it('supports the legacy eventId param', () => {
    expect(parsePhotoFilters(sp('eventId=e1')).eventId).toBe('e1')
  })

  it('treats grouping as on unless explicitly false', () => {
    expect(parsePhotoFilters(sp('')).groupDuplicates).toBe(true)
    expect(parsePhotoFilters(sp('groupDuplicates=false')).groupDuplicates).toBe(
      false
    )
    expect(parsePhotoFilters(sp('groupScenes=false')).groupScenes).toBe(false)
  })

  it('treats shuffle=false as disabled', () => {
    expect(parsePhotoFilters(sp('shuffle=false')).shuffle).toBeNull()
  })
})

describe('hasAnyPhotoFilterParam', () => {
  it('is false for a bare URL', () => {
    expect(hasAnyPhotoFilterParam(sp(''))).toBe(false)
    expect(hasAnyPhotoFilterParam(sp('page=2'))).toBe(false)
  })

  it('is true when any filter param is present', () => {
    expect(hasAnyPhotoFilterParam(sp('event=e1'))).toBe(true)
    expect(hasAnyPhotoFilterParam(sp('eventId=e1'))).toBe(true)
    expect(hasAnyPhotoFilterParam(sp('shuffle=true'))).toBe(true)
    expect(hasAnyPhotoFilterParam(sp('groupScenes=false'))).toBe(true)
  })
})

describe('serializePhotoFilters', () => {
  it('omits defaults entirely', () => {
    expect(serializePhotoFilters(DEFAULT_PHOTO_FILTERS)).toBe('')
  })

  it('writes only non-default dimensions', () => {
    expect(
      serializePhotoFilters({ ...DEFAULT_PHOTO_FILTERS, eventId: 'e1' })
    ).toBe('event=e1')
  })

  it('only records grouping when disabled', () => {
    expect(
      serializePhotoFilters({ ...DEFAULT_PHOTO_FILTERS, groupScenes: false })
    ).toBe('groupScenes=false')
    expect(
      serializePhotoFilters({
        ...DEFAULT_PHOTO_FILTERS,
        groupDuplicates: false,
      })
    ).toBe('groupDuplicates=false')
  })

  it('omits disabled shuffle but keeps an active seed', () => {
    expect(
      serializePhotoFilters({ ...DEFAULT_PHOTO_FILTERS, shuffle: null })
    ).toBe('')
    expect(
      serializePhotoFilters({ ...DEFAULT_PHOTO_FILTERS, shuffle: 'false' })
    ).toBe('')
    expect(
      serializePhotoFilters({ ...DEFAULT_PHOTO_FILTERS, shuffle: 'seed9' })
    ).toBe('shuffle=seed9')
  })

  it('round-trips through parse', () => {
    const filters: PhotoFilters = {
      eventId: 'e1',
      photographer: 'Jane Doe',
      companySlug: 'acme',
      shuffle: 'seed9',
      groupDuplicates: false,
      groupScenes: true,
    }
    expect(parsePhotoFilters(sp(serializePhotoFilters(filters)))).toEqual(
      filters
    )
  })
})

describe('buildGalleryUrl', () => {
  it('is a bare /photos with no filters', () => {
    expect(buildGalleryUrl(DEFAULT_PHOTO_FILTERS)).toBe('/photos')
  })

  it('appends a query when filters are present', () => {
    expect(buildGalleryUrl({ ...DEFAULT_PHOTO_FILTERS, eventId: 'e1' })).toBe(
      '/photos?event=e1'
    )
  })
})

describe('reconcilePhotoFiltersFromUrl', () => {
  const persisted: PhotoFilters = {
    ...DEFAULT_PHOTO_FILTERS,
    eventId: 'stored-event',
    photographer: 'Stored Photographer',
  }

  it('keeps current values when the URL carries no params', () => {
    expect(reconcilePhotoFiltersFromUrl(persisted, sp(''))).toBe(persisted)
  })

  it('only overrides the dimensions the URL specifies', () => {
    const result = reconcilePhotoFiltersFromUrl(
      persisted,
      sp('event=url-event')
    )
    expect(result.eventId).toBe('url-event')
    // photographer is not in the URL, so the persisted value survives.
    expect(result.photographer).toBe('Stored Photographer')
  })

  it('returns the same reference when nothing changes', () => {
    const result = reconcilePhotoFiltersFromUrl(
      persisted,
      sp('event=stored-event')
    )
    expect(result).toBe(persisted)
  })
})

describe('groupTypesFromFilters', () => {
  it('returns false when both toggles are off', () => {
    expect(
      groupTypesFromFilters({ groupDuplicates: false, groupScenes: false })
    ).toBe(false)
  })

  it('joins enabled cluster types', () => {
    expect(
      groupTypesFromFilters({ groupDuplicates: true, groupScenes: true })
    ).toBe('near_duplicate,scene')
    expect(
      groupTypesFromFilters({ groupDuplicates: true, groupScenes: false })
    ).toBe('near_duplicate')
    expect(
      groupTypesFromFilters({ groupDuplicates: false, groupScenes: true })
    ).toBe('scene')
  })
})

describe('photoFiltersToApiParams', () => {
  it('maps filters and order (chronological when shuffle off)', () => {
    const params = photoFiltersToApiParams(
      { ...DEFAULT_PHOTO_FILTERS, eventId: 'e1', photographer: 'Jane Doe' },
      { page: 1, limit: 50 }
    )
    expect(params.get('event')).toBe('e1')
    expect(params.get('photographer')).toBe('Jane Doe')
    expect(params.get('order')).toBe('date')
    expect(params.get('shuffle')).toBeNull()
    expect(params.get('page')).toBe('1')
    expect(params.get('limit')).toBe('50')
    expect(params.get('groupTypes')).toBe('near_duplicate,scene')
  })

  it('uses shuffle instead of order when enabled', () => {
    const params = photoFiltersToApiParams({
      ...DEFAULT_PHOTO_FILTERS,
      shuffle: 'seed9',
    })
    expect(params.get('shuffle')).toBe('seed9')
    expect(params.get('order')).toBeNull()
  })

  it('omits groupTypes entirely when grouping is disabled', () => {
    const params = photoFiltersToApiParams({
      ...DEFAULT_PHOTO_FILTERS,
      groupDuplicates: false,
      groupScenes: false,
    })
    expect(params.has('groupTypes')).toBe(false)
  })

  it('passes skipMeta through for load-more', () => {
    const params = photoFiltersToApiParams(DEFAULT_PHOTO_FILTERS, {
      skipMeta: true,
    })
    expect(params.get('skipMeta')).toBe('true')
  })
})

describe('arePhotoFiltersEqual', () => {
  it('is true for identical filters', () => {
    expect(
      arePhotoFiltersEqual(DEFAULT_PHOTO_FILTERS, { ...DEFAULT_PHOTO_FILTERS })
    ).toBe(true)
  })

  it('is false when any dimension differs', () => {
    expect(
      arePhotoFiltersEqual(DEFAULT_PHOTO_FILTERS, {
        ...DEFAULT_PHOTO_FILTERS,
        eventId: 'e1',
      })
    ).toBe(false)
  })
})
