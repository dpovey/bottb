import { NextRequest, NextResponse } from 'next/server'
import {
  getPhotosWithCount,
  getGroupedPhotosWithCount,
  type PhotoOrderBy,
  type Photo,
  type PhotoWithCluster,
} from '@/lib/db'
import { getCachedPhotos, getCachedPhotoFilters } from '@/lib/nav-data'
import { withPublicRateLimit } from '@/lib/api-protection'
import { getTimeBasedSeed } from '@/lib/shuffle'

// Convert string seed to numeric seed for database ordering
function stringToNumericSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
  }
  return Math.abs(hash)
}

export const GET = withPublicRateLimit(async function GET(
  request: NextRequest
) {
  try {
    // Use URL constructor for testability (nextUrl.searchParams is not available in tests)
    const searchParams = new URL(request.url).searchParams
    // Support both new (event) and legacy (eventId) param names
    const eventId =
      searchParams.get('event') || searchParams.get('eventId') || undefined
    const bandId = searchParams.get('band') || undefined
    const photographer = searchParams.get('photographer') || undefined
    // Support both company and companySlug for backwards compatibility
    const companySlug =
      searchParams.get('company') ||
      searchParams.get('companySlug') ||
      undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Shuffle parameter: 'true' for shared shuffle, or a specific seed
    // Takes precedence over order parameter
    const shuffle = searchParams.get('shuffle') || undefined

    // Order: date (for slideshows/chronological), uploaded (default)
    // Note: 'random' is deprecated in favor of shuffle param
    const orderParam = searchParams.get('order')
    const orderBy: PhotoOrderBy =
      orderParam === 'random' || orderParam === 'date' ? orderParam : 'uploaded'

    // skipMeta=true skips fetching filter metadata (for "load more" requests)
    const skipMeta = searchParams.get('skipMeta') === 'true'

    // unmatched=true filters to photos with missing event_id or band_id
    const unmatched = searchParams.get('unmatched') === 'true'

    // groupTypes: comma-separated list of cluster types to group by
    // e.g., groupTypes=near_duplicate,scene
    const groupTypesParam = searchParams.get('groupTypes')
    const groupTypes = groupTypesParam
      ? (groupTypesParam.split(',').filter((t) => t) as (
          | 'near_duplicate'
          | 'scene'
        )[])
      : undefined

    let photos: Photo[] | PhotoWithCluster[]
    let total: number
    let seed: string | null = null

    // When groupTypes is specified, use the grouped query
    // This returns only representative photos with embedded cluster data
    if (groupTypes && groupTypes.length > 0) {
      // Determine seed for shuffle mode
      let numericSeed: number | undefined
      if (shuffle === 'true') {
        seed = getTimeBasedSeed()
        numericSeed = stringToNumericSeed(seed)
      } else if (shuffle) {
        seed = shuffle
        numericSeed = stringToNumericSeed(shuffle)
      }

      const result = await getGroupedPhotosWithCount({
        eventId,
        bandId,
        photographer,
        companySlug,
        limit,
        offset,
        orderBy: shuffle ? 'random' : orderBy,
        seed: numericSeed,
        unmatched,
        groupTypes,
      })
      photos = result.photos
      total = result.total
    } else if (shuffle) {
      // Use cached function for shuffle requests (initial load only)
      // For "load more" (offset > 0), we still use cached but with pagination
      const result = await getCachedPhotos({
        eventId,
        photographer,
        companySlug,
        shuffle,
        limit,
        offset,
      })
      photos = result.photos
      total = result.total
      seed = result.seed
    } else if (orderParam === 'random') {
      // Legacy support: order=random still works but now uses cached shuffle
      const result = await getCachedPhotos({
        eventId,
        photographer,
        companySlug,
        shuffle: 'true', // Use shared time-based shuffle
        limit,
        offset,
      })
      photos = result.photos
      total = result.total
      seed = result.seed
    } else {
      // Non-shuffle requests: use direct DB query
      const result = await getPhotosWithCount({
        eventId,
        bandId,
        photographer,
        companySlug,
        limit,
        offset,
        orderBy,
        unmatched,
      })
      photos = result.photos
      total = result.total
    }

    // Only fetch filter metadata on initial load (not "load more" requests)
    // This reduces DB queries from 11 to 1 on subsequent page loads
    let availableFilters = null
    let photographers: string[] = []
    let companies: { slug: string; name: string }[] = []

    if (!skipMeta) {
      availableFilters = await getCachedPhotoFilters({
        eventId,
        photographer,
        companySlug,
      })
      // Extract photographers and companies from availableFilters (no separate queries needed)
      photographers = availableFilters.photographers.map((p) => p.name)
      companies = availableFilters.companies.map((c) => ({
        slug: c.slug,
        name: c.name,
      }))
    }

    return NextResponse.json({
      photos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      photographers,
      companies,
      availableFilters,
      // Include seed in response so client knows what seed was used
      ...(seed && { seed }),
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
})
