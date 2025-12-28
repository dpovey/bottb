import { NextRequest, NextResponse } from 'next/server'
import {
  getPhotosWithCount,
  getAvailablePhotoFilters,
  type PhotoOrderBy,
} from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    // Support both new (event) and legacy (eventId) param names
    const eventId =
      searchParams.get('event') || searchParams.get('eventId') || undefined
    const photographer = searchParams.get('photographer') || undefined
    // Support both company and companySlug for backwards compatibility
    const companySlug =
      searchParams.get('company') ||
      searchParams.get('companySlug') ||
      undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit
    // Order: random (for galleries/strips), date (for slideshows), uploaded (default)
    const orderParam = searchParams.get('order')
    const orderBy: PhotoOrderBy =
      orderParam === 'random' || orderParam === 'date' ? orderParam : 'uploaded'

    // Seed for deterministic random ordering (same seed = same order)
    const seedParam = searchParams.get('seed')
    const seed = seedParam ? parseInt(seedParam, 10) : undefined

    // skipMeta=true skips fetching filter metadata (for "load more" requests)
    const skipMeta = searchParams.get('skipMeta') === 'true'

    // Use single optimized query for photos + count (eliminates duplicate WHERE clause)
    const { photos, total } = await getPhotosWithCount({
      eventId,
      photographer,
      companySlug,
      limit,
      offset,
      orderBy,
      seed,
    })

    // Only fetch filter metadata on initial load (not "load more" requests)
    // This reduces DB queries from 11 to 1 on subsequent page loads
    let availableFilters = null
    let photographers: string[] = []
    let companies: { slug: string; name: string }[] = []

    if (!skipMeta) {
      availableFilters = await getAvailablePhotoFilters({
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
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}
