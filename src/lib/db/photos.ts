import { sql, sqlQuery } from '../sql'
import type { HeroFocalPoint, Photo, PhotoOrderBy } from '../db-types'
import { PHOTO_LABELS } from '../db-types'

// Photo functions

export interface GetPhotosOptions {
  eventId?: string
  bandId?: string
  photographer?: string
  companySlug?: string
  limit?: number
  offset?: number
  orderBy?: PhotoOrderBy
  /** Seed for deterministic random ordering (only used when orderBy='random') */
  seed?: number
  /** Filter to show only photos with missing event_id or band_id */
  unmatched?: boolean
  /** Cluster types to group by - when set, returns only representatives with cluster data */
  groupTypes?: ('near_duplicate' | 'scene')[]
}

// Photo with embedded cluster data for grouped queries
export interface PhotoWithCluster extends Photo {
  /** Array of photos in this cluster (null if not clustered) */
  cluster_photos: Photo[] | null
}

/**
 * Sort photos by capture date (oldest first for chronological viewing)
 * Uses filename as secondary sort for photos with the same timestamp
 * (e.g., when falling back to event date for photos without metadata)
 */
function sortByDate(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => {
    const dateA = a.captured_at ? new Date(a.captured_at).getTime() : 0
    const dateB = b.captured_at ? new Date(b.captured_at).getTime() : 0
    if (dateA !== dateB) {
      return dateA - dateB
    }
    // Secondary sort by filename for photos with same timestamp
    const filenameA = a.original_filename || ''
    const filenameB = b.original_filename || ''
    return filenameA.localeCompare(filenameB, undefined, { numeric: true })
  })
}

// Result type for combined photos + count query
interface PhotosWithCountResult {
  photos: Photo[]
  total: number
}

// Result type when groupTypes is specified
export interface GroupedPhotosResult {
  photos: PhotoWithCluster[]
  total: number
}

// Extended Photo type with total_count from window function
interface PhotoWithCount extends Photo {
  total_count: string
}

/**
 * Get photos with total count in a single query using COUNT(*) OVER() window function.
 * This eliminates the need for a separate count query.
 */
export async function getPhotosWithCount(
  options: GetPhotosOptions = {}
): Promise<PhotosWithCountResult> {
  const {
    eventId,
    bandId,
    photographer,
    companySlug,
    limit = 50,
    offset = 0,
    orderBy = 'uploaded',
    seed,
    unmatched,
  } = options

  // For random ordering, use deterministic hash-based ordering with seed
  if (orderBy === 'random') {
    return getPhotosRandomWithCount({
      eventId,
      photographer,
      companySlug,
      limit,
      offset,
      seed,
    })
  }

  // Helper to apply date sorting after fetch
  const applyOrdering = (photos: Photo[]): Photo[] => {
    if (orderBy === 'date') {
      return sortByDate(photos)
    }
    return photos
  }

  try {
    // Use COUNT(*) OVER() to get total count in the same query
    const { rows } = await sql<PhotoWithCount>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
             p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
             p.xmp_metadata->>'medium_url' as medium_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url,
             COUNT(*) OVER() as total_count
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR p.band_id = ${bandId || null})
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
        AND (
          ${unmatched ? 'true' : 'false'}::boolean = false
          OR (p.event_id IS NULL OR p.band_id IS NULL)
        )
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const total = parseInt(rows[0]?.total_count || '0', 10)
    // Remove total_count from photos before returning
    const photos = rows.map(
      ({ total_count: _total_count, ...photo }) => photo as Photo
    )

    return { photos: applyOrdering(photos), total }
  } catch (error) {
    console.error('Error fetching photos with count:', error)
    throw error
  }
}

/**
 * Get photos in deterministic random order with total count using hashtext()
 * When a seed is provided, the same seed produces the same order (reproducible shuffle)
 * When no seed is provided, uses true random ordering
 * This mixes photos from all events/bands for better discovery
 * All filters are combined with AND for proper filtering
 */
async function getPhotosRandomWithCount(options: {
  eventId?: string
  photographer?: string
  companySlug?: string
  limit: number
  offset?: number
  seed?: number
}): Promise<PhotosWithCountResult> {
  const {
    eventId,
    photographer,
    companySlug,
    limit,
    offset = 0,
    seed,
  } = options

  try {
    // Use COUNT(*) OVER() to get total count in the same query
    // If seed is provided, use deterministic hash-based ordering
    // hashtext() is fast (designed for hash tables) and deterministic
    // Secondary sort by id ensures stable ordering on hash collisions
    const { rows } = await sql<PhotoWithCount>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
             p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
             p.xmp_metadata->>'medium_url' as medium_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url,
             COUNT(*) OVER() as total_count
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
      ORDER BY 
        CASE WHEN ${seed ?? null}::bigint IS NOT NULL 
          THEN hashtext(p.id || ${seed ?? 0}::text)
          ELSE floor(random() * 2147483647)::int
        END,
        p.id
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const total = parseInt(rows[0]?.total_count || '0', 10)
    // Remove total_count from photos before returning
    const photos = rows.map(
      ({ total_count: _total_count, ...photo }) => photo as Photo
    )

    return { photos, total }
  } catch (error) {
    console.error('Error fetching random photos with count:', error)
    throw error
  }
}

// Extended type for grouped query results (includes cluster_photos JSON)
interface PhotoWithClusterRow extends Photo {
  total_count: string
  cluster_photos: Photo[] | null // JSON from postgres, parsed by driver
}

/**
 * Get photos with grouping - returns only representatives + non-clustered photos
 * Each row includes cluster_photos array for cycling through grouped photos
 */
export async function getGroupedPhotosWithCount(options: {
  eventId?: string
  bandId?: string
  photographer?: string
  companySlug?: string
  limit: number
  offset?: number
  orderBy?: PhotoOrderBy
  seed?: number
  unmatched?: boolean
  groupTypes: ('near_duplicate' | 'scene')[]
}): Promise<GroupedPhotosResult> {
  const {
    eventId,
    bandId,
    photographer,
    companySlug,
    limit,
    offset = 0,
    orderBy = 'uploaded',
    seed,
    unmatched,
    groupTypes,
  } = options

  try {
    // Build ORDER BY clause based on orderBy option
    // Note: seed is sanitized as an integer, safe to interpolate
    const orderClause =
      orderBy === 'random' && seed !== undefined
        ? `hashtext(vp.id::text || '${seed}'::text), vp.id`
        : orderBy === 'random'
          ? `floor(random() * 2147483647)::int, vp.id`
          : orderBy === 'date'
            ? `vp.captured_at ASC NULLS LAST, vp.original_filename ASC`
            : `vp.uploaded_at DESC`

    // Build the full query with parameterized values
    // Using sqlQuery for dynamic ORDER BY clause
    const queryText = `
      WITH visible_photos AS (
        -- Photos that should be displayed: non-clustered OR cluster representatives
        -- Using EXISTS to avoid duplicate rows from multiple cluster memberships
        SELECT DISTINCT p.*
        FROM photos p
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          (
            -- Not in any cluster of the requested types
            NOT EXISTS (
              SELECT 1 FROM photo_clusters pc 
              WHERE p.id = ANY(pc.photo_ids) 
                AND pc.cluster_type = ANY($1::text[])
            )
            OR
            -- Is the representative of at least one cluster
            EXISTS (
              SELECT 1 FROM photo_clusters pc 
              WHERE COALESCE(pc.representative_photo_id, pc.photo_ids[1]) = p.id 
                AND pc.cluster_type = ANY($1::text[])
            )
          )
          AND ($2::text IS NULL OR p.event_id = $2)
          AND ($3::text IS NULL OR p.band_id = $3)
          AND ($4::text IS NULL OR p.photographer = $4)
          AND (
            $5::text IS NULL 
            OR ($5 = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR ($5 != 'none' AND b.company_slug = $5)
          )
          AND (
            $6::boolean = false
            OR (p.event_id IS NULL OR p.band_id IS NULL)
          )
      )
      SELECT 
        vp.*,
        e.name as event_name,
        b.name as band_name,
        c.name as company_name,
        b.company_slug as company_slug,
        c.icon_url as company_icon_url,
        COALESCE(vp.xmp_metadata->>'thumbnail_url', REPLACE(vp.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
        vp.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
        vp.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
        vp.xmp_metadata->>'medium_url' as medium_url,
        vp.xmp_metadata->>'large_4k_url' as large_4k_url,
        COUNT(*) OVER() as total_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', cp.id,
              'event_id', cp.event_id,
              'band_id', cp.band_id,
              'photographer', cp.photographer,
              'blob_url', cp.blob_url,
              'blob_pathname', cp.blob_pathname,
              'original_filename', cp.original_filename,
              'width', cp.width,
              'height', cp.height,
              'file_size', cp.file_size,
              'content_type', cp.content_type,
              'xmp_metadata', cp.xmp_metadata,
              'uploaded_at', cp.uploaded_at,
              'created_at', cp.created_at,
              'captured_at', cp.captured_at,
              'labels', cp.labels,
              'hero_focal_point', cp.hero_focal_point,
              'is_monochrome', NULL::boolean,
              'thumbnail_url', COALESCE(cp.xmp_metadata->>'thumbnail_url', REPLACE(cp.blob_url, '/large.webp', '/thumbnail.webp')),
              'thumbnail_2x_url', cp.xmp_metadata->>'thumbnail_2x_url',
              'thumbnail_3x_url', cp.xmp_metadata->>'thumbnail_3x_url',
              'medium_url', cp.xmp_metadata->>'medium_url',
              'large_4k_url', cp.xmp_metadata->>'large_4k_url',
              'event_name', cp.event_name,
              'band_name', cp.band_name,
              'company_name', cp.company_name,
              'company_slug', cp.company_slug,
              'company_icon_url', cp.company_icon_url
            )
            ORDER BY cp.id
          )
          FROM (
            -- Deduplicate photos that appear in multiple clusters, with joined metadata
            SELECT DISTINCT ON (p.id) 
              p.*,
              ev.name as event_name,
              bd.name as band_name,
              co.name as company_name,
              bd.company_slug as company_slug,
              co.icon_url as company_icon_url
            FROM photo_clusters pc
            JOIN photos p ON p.id = ANY(pc.photo_ids)
            LEFT JOIN events ev ON p.event_id = ev.id
            LEFT JOIN bands bd ON p.band_id = bd.id
            LEFT JOIN companies co ON bd.company_slug = co.slug
            WHERE pc.cluster_type = ANY($1::text[])
              AND COALESCE(pc.representative_photo_id, pc.photo_ids[1]) = vp.id
            ORDER BY p.id
          ) cp
        ) as cluster_photos
      FROM visible_photos vp
      LEFT JOIN events e ON vp.event_id = e.id
      LEFT JOIN bands b ON vp.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      ORDER BY ${orderClause}
      LIMIT $7
      OFFSET $8
    `

    const values = [
      groupTypes, // $1 - array of group types
      eventId || null, // $2
      bandId || null, // $3
      photographer || null, // $4
      companySlug || null, // $5
      unmatched ?? false, // $6
      limit, // $7
      offset, // $8
    ]

    const { rows } = await sqlQuery<PhotoWithClusterRow>(queryText, values)

    const total = parseInt(rows[0]?.total_count || '0', 10)

    // Parse cluster_photos and remove total_count
    const photos: PhotoWithCluster[] = rows.map(
      ({ total_count: _total_count, cluster_photos, ...photo }) => ({
        ...photo,
        cluster_photos: cluster_photos as Photo[] | null,
      })
    )

    return { photos, total }
  } catch (error) {
    console.error('Error fetching grouped photos with count:', error)
    throw error
  }
}

/**
 * Get photos with optional filtering and ordering.
 * This is a convenience wrapper around getPhotosWithCount that returns only photos.
 */
export async function getPhotos(
  options: GetPhotosOptions = {}
): Promise<Photo[]> {
  const { photos } = await getPhotosWithCount(options)
  return photos
}

export async function getPhotoById(photoId: string): Promise<Photo | null> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'thumbnail_2x_url' as thumbnail_2x_url,
             p.xmp_metadata->>'thumbnail_3x_url' as thumbnail_3x_url,
             p.xmp_metadata->>'medium_url' as medium_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.id = ${photoId}
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error fetching photo:', error)
    throw error
  }
}

export async function getPhotoCount(
  options: Omit<GetPhotosOptions, 'limit' | 'offset'> = {}
): Promise<number> {
  const { eventId, photographer, companySlug } = options

  try {
    // Use conditional SQL to combine all filters with AND
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count 
      FROM photos p
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
    `
    return parseInt(rows[0]?.count || '0', 10)
  } catch (error) {
    console.error('Error counting photos:', error)
    throw error
  }
}

export async function getDistinctPhotographers(): Promise<string[]> {
  try {
    const { rows } = await sql<{ photographer: string }>`
      SELECT DISTINCT photographer FROM photos 
      WHERE photographer IS NOT NULL 
      ORDER BY photographer
    `
    return rows.map((r) => r.photographer)
  } catch (error) {
    console.error('Error fetching photographers:', error)
    throw error
  }
}

/**
 * Get available filter options based on current filters.
 * Returns options that have matching photos given the current filter context.
 */
export interface AvailablePhotoFilters {
  companies: { slug: string; name: string; count: number }[]
  events: { id: string; name: string; count: number }[]
  photographers: { name: string; count: number }[]
  hasPhotosWithoutCompany: boolean
}

export async function getAvailablePhotoFilters(
  options: Omit<GetPhotosOptions, 'limit' | 'offset'> = {}
): Promise<AvailablePhotoFilters> {
  const { eventId, photographer, companySlug } = options

  try {
    // Run all queries in parallel for better performance
    // Filter results based on current active filters to show only available options

    const [
      companiesResult,
      eventsResult,
      photographersResult,
      noCompanyResult,
    ] = await Promise.all([
      // Get companies that have photos matching current filters (excluding company filter itself)
      sql<{ slug: string; name: string; count: string }>`
        SELECT c.slug, c.name, COUNT(DISTINCT p.id)::text as count
        FROM photos p
        INNER JOIN bands b ON p.band_id = b.id
        INNER JOIN companies c ON b.company_slug = c.slug
        WHERE 
          (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        GROUP BY c.slug, c.name
        ORDER BY c.name
      `,

      // Get events that have photos matching current filters (excluding event filter itself)
      sql<{ id: string; name: string; count: string }>`
        SELECT e.id, e.name, COUNT(p.id)::text as count
        FROM photos p
        INNER JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
          )
        GROUP BY e.id, e.name
        ORDER BY e.name
      `,

      // Get photographers that have photos matching current filters (excluding photographer filter itself)
      sql<{ name: string; count: string }>`
        SELECT p.photographer as name, COUNT(*)::text as count
        FROM photos p
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          p.photographer IS NOT NULL
          AND (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
          )
        GROUP BY p.photographer
        ORDER BY p.photographer
      `,

      // Check if there are photos without a company (via band) matching current filters
      sql<{ count: string }>`
        SELECT COUNT(*)::text as count 
        FROM photos p
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          (b.company_slug IS NULL OR p.band_id IS NULL)
          AND (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
      `,
    ])

    return {
      companies: companiesResult.rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      events: eventsResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      photographers: photographersResult.rows.map((r) => ({
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      hasPhotosWithoutCompany:
        parseInt(noCompanyResult.rows[0]?.count || '0', 10) > 0,
    }
  } catch (error) {
    console.error('Error fetching available photo filters:', error)
    throw error
  }
}

// Photo label functions

export async function updatePhotoLabels(
  photoId: string,
  labels: string[]
): Promise<Photo | null> {
  try {
    // Convert array to PostgreSQL array literal format
    const labelsArrayLiteral = `{${labels.join(',')}}`
    const { rows } = await sql<Photo>`
      UPDATE photos 
      SET labels = ${labelsArrayLiteral}::text[]
      WHERE id = ${photoId}
      RETURNING *
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error updating photo labels:', error)
    throw error
  }
}

export async function getPhotosByLabel(
  label: string,
  options?: { eventId?: string; bandId?: string; photographerName?: string }
): Promise<Photo[]> {
  try {
    if (options?.bandId) {
      // Get photos with this label for a specific band
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
               p.xmp_metadata->>'large_4k_url' as large_4k_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
          AND p.band_id = ${options.bandId}
        ORDER BY p.uploaded_at DESC
      `
      return rows
    } else if (options?.eventId) {
      // Get photos with this label for a specific event
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
               p.xmp_metadata->>'large_4k_url' as large_4k_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
          AND p.event_id = ${options.eventId}
        ORDER BY p.uploaded_at DESC
      `
      return rows
    } else if (options?.photographerName) {
      // Get photos with this label for a specific photographer
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
               p.xmp_metadata->>'large_4k_url' as large_4k_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
          AND p.photographer = ${options.photographerName}
        ORDER BY p.uploaded_at DESC
      `
      return rows
    } else {
      // Get all photos with this label
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
               p.xmp_metadata->>'large_4k_url' as large_4k_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
        ORDER BY p.uploaded_at DESC
      `
      return rows
    }
  } catch (error) {
    console.error('Error fetching photos by label:', error)
    throw error
  }
}

/**
 * Get all photos that have any hero label (band_hero, event_hero, global_hero, photographer_hero)
 * Used for sitemap generation - these are curated, high-quality photos worth indexing
 */
export async function getAllHeroPhotos(): Promise<Photo[]> {
  try {
    // PostgreSQL array literal format for the overlap operator
    const heroLabelsLiteral = `{${PHOTO_LABELS.BAND_HERO},${PHOTO_LABELS.EVENT_HERO},${PHOTO_LABELS.GLOBAL_HERO},${PHOTO_LABELS.PHOTOGRAPHER_HERO}}`

    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, 
             b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.labels && ${heroLabelsLiteral}::text[]
      ORDER BY p.uploaded_at DESC
    `
    return rows
  } catch (error) {
    console.error('Error fetching hero photos:', error)
    throw error
  }
}

/**
 * Get all photos that should be indexed for SEO (sitemap)
 * Returns:
 * - Photos not in any cluster (unique photos)
 * - Representative photos from clusters (best photo from each group)
 * Excludes non-representative cluster members (near-duplicates)
 */
export async function getIndexablePhotos(): Promise<Photo[]> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name,
             b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             p.xmp_metadata->>'large_4k_url' as large_4k_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        -- Photo must have a slug to be indexable
        p.slug IS NOT NULL
        AND (
          -- Not in any cluster (unique photo)
          NOT EXISTS (
            SELECT 1 FROM photo_clusters pc 
            WHERE p.id = ANY(pc.photo_ids)
          )
          OR
          -- Is the representative of at least one cluster
          EXISTS (
            SELECT 1 FROM photo_clusters pc 
            WHERE COALESCE(pc.representative_photo_id, pc.photo_ids[1]) = p.id
          )
        )
      ORDER BY p.uploaded_at DESC
    `
    return rows
  } catch (error) {
    console.error('Error fetching indexable photos:', error)
    throw error
  }
}

/**
 * Get adjacent photos (previous and next) for a given photo
 * Uses slug_prefix to find photos in the same sequence (same band/event)
 * Falls back to event_id if no slug_prefix
 */
export async function getAdjacentPhotos(
  photoId: string,
  slugPrefix: string | null,
  eventId: string | null
): Promise<{ previous: Photo | null; next: Photo | null }> {
  try {
    // Get previous photo (highest slug that's less than current)
    const { rows: prevRows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE 
        p.slug IS NOT NULL
        AND p.slug < (SELECT slug FROM photos WHERE id = ${photoId})
        AND (
          (${slugPrefix}::text IS NOT NULL AND p.slug_prefix = ${slugPrefix})
          OR
          (${slugPrefix}::text IS NULL AND ${eventId}::text IS NOT NULL AND p.event_id = ${eventId})
        )
      ORDER BY p.slug DESC
      LIMIT 1
    `

    // Get next photo (lowest slug that's greater than current)
    const { rows: nextRows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE 
        p.slug IS NOT NULL
        AND p.slug > (SELECT slug FROM photos WHERE id = ${photoId})
        AND (
          (${slugPrefix}::text IS NOT NULL AND p.slug_prefix = ${slugPrefix})
          OR
          (${slugPrefix}::text IS NULL AND ${eventId}::text IS NOT NULL AND p.event_id = ${eventId})
        )
      ORDER BY p.slug ASC
      LIMIT 1
    `

    return {
      previous: prevRows[0] || null,
      next: nextRows[0] || null,
    }
  } catch (error) {
    console.error('Error fetching adjacent photos:', error)
    return { previous: null, next: null }
  }
}

/**
 * Get similar photos from the same cluster as a given photo
 * Used for "similar photos" section on photo pages
 */
export async function getSimilarPhotos(
  photoId: string,
  limit = 6
): Promise<Photo[]> {
  try {
    const { rows } = await sql<Photo>`
      SELECT DISTINCT p.*, e.name as event_name, b.name as band_name, c.name as company_name,
             b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photo_clusters pc
      JOIN photos p ON p.id = ANY(pc.photo_ids)
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        ${photoId} = ANY(pc.photo_ids)
        AND p.id != ${photoId}
        AND p.slug IS NOT NULL
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit}
    `
    return rows
  } catch (error) {
    console.error('Error fetching similar photos:', error)
    return []
  }
}

export async function updateHeroFocalPoint(
  photoId: string,
  focalPoint: HeroFocalPoint
): Promise<Photo | null> {
  try {
    // Validate focal point values
    const x = Math.max(0, Math.min(100, focalPoint.x))
    const y = Math.max(0, Math.min(100, focalPoint.y))
    const focalPointJson = JSON.stringify({ x, y })

    const { rows } = await sql<Photo>`
      UPDATE photos 
      SET hero_focal_point = ${focalPointJson}::jsonb
      WHERE id = ${photoId}
      RETURNING *
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error updating hero focal point:', error)
    throw error
  }
}
