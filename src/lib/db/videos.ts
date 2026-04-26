import { sql } from '../sql'
import type { Video } from '../db-types'

// ============================================================
// Video Functions
// ============================================================

export interface GetVideosOptions {
  eventId?: string
  bandId?: string // For internal use (band detail page)
  companySlug?: string
  videoType?: 'video' | 'short' // Filter by video type
  limit?: number
  offset?: number
}

/**
 * Get videos with optional filters
 */
export async function getVideos(
  options: GetVideosOptions = {}
): Promise<Video[]> {
  const {
    eventId,
    bandId,
    companySlug,
    videoType,
    limit = 50,
    offset = 0,
  } = options

  try {
    const { rows } = await sql<Video>`
      SELECT v.*, 
             e.name as event_name, 
             b.name as band_name,
             c.name as company_name,
             b.company_slug as company_slug,
             c.icon_url as company_icon_url
      FROM videos v
      LEFT JOIN events e ON v.event_id = e.id
      LEFT JOIN bands b ON v.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR v.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR v.band_id = ${bandId || null})
        AND (${companySlug || null}::text IS NULL OR b.company_slug = ${companySlug || null})
        AND (${videoType || null}::text IS NULL OR v.video_type = ${videoType || null})
      ORDER BY v.published_at DESC NULLS LAST, v.created_at DESC, v.sort_order ASC
      LIMIT ${limit} OFFSET ${offset}
    `
    return rows
  } catch (error) {
    console.error('Error fetching videos:', error)
    throw error
  }
}

/**
 * Get a single video by ID
 */
export async function getVideoById(videoId: string): Promise<Video | null> {
  try {
    const { rows } = await sql<Video>`
      SELECT v.*, 
             e.name as event_name, 
             b.name as band_name,
             c.name as company_name,
             b.company_slug as company_slug,
             c.icon_url as company_icon_url
      FROM videos v
      LEFT JOIN events e ON v.event_id = e.id
      LEFT JOIN bands b ON v.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE v.id = ${videoId}
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error fetching video:', error)
    throw error
  }
}

/**
 * Get a video by YouTube video ID
 */
export async function getVideoByYoutubeId(
  youtubeVideoId: string
): Promise<Video | null> {
  try {
    const { rows } = await sql<Video>`
      SELECT v.*, 
             e.name as event_name, 
             b.name as band_name,
             c.name as company_name,
             b.company_slug as company_slug,
             c.icon_url as company_icon_url
      FROM videos v
      LEFT JOIN events e ON v.event_id = e.id
      LEFT JOIN bands b ON v.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE v.youtube_video_id = ${youtubeVideoId}
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error fetching video by YouTube ID:', error)
    throw error
  }
}

/**
 * Get video count with optional filters
 */
export async function getVideoCount(
  options: Omit<GetVideosOptions, 'limit' | 'offset'> = {}
): Promise<number> {
  const { eventId, bandId, companySlug, videoType } = options

  try {
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count 
      FROM videos v
      LEFT JOIN bands b ON v.band_id = b.id
      WHERE 
        (${eventId || null}::text IS NULL OR v.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR v.band_id = ${bandId || null})
        AND (${companySlug || null}::text IS NULL OR b.company_slug = ${companySlug || null})
        AND (${videoType || null}::text IS NULL OR v.video_type = ${videoType || null})
    `
    return parseInt(rows[0]?.count || '0', 10)
  } catch (error) {
    console.error('Error counting videos:', error)
    throw error
  }
}

/**
 * Create a new video
 */
export async function createVideo(
  video: Omit<
    Video,
    | 'id'
    | 'created_at'
    | 'event_name'
    | 'band_name'
    | 'company_name'
    | 'company_slug'
    | 'company_icon_url'
  >
): Promise<Video> {
  try {
    const { rows } = await sql<Video>`
      INSERT INTO videos (
        youtube_video_id, title, event_id, band_id, 
        duration_seconds, thumbnail_url, published_at, sort_order, video_type
      )
      VALUES (
        ${video.youtube_video_id}, ${video.title}, ${video.event_id}, ${video.band_id},
        ${video.duration_seconds}, ${video.thumbnail_url}, ${video.published_at}, ${video.sort_order},
        ${video.video_type || 'video'}
      )
      RETURNING *
    `
    return rows[0]
  } catch (error) {
    console.error('Error creating video:', error)
    throw error
  }
}

/**
 * Update an existing video
 */
export async function updateVideo(
  videoId: string,
  video: Partial<
    Omit<
      Video,
      | 'id'
      | 'created_at'
      | 'event_name'
      | 'band_name'
      | 'company_name'
      | 'company_slug'
      | 'company_icon_url'
    >
  >
): Promise<Video | null> {
  try {
    const { rows } = await sql<Video>`
      UPDATE videos SET
        title = COALESCE(${video.title || null}, title),
        event_id = ${video.event_id === undefined ? null : video.event_id},
        band_id = ${video.band_id === undefined ? null : video.band_id},
        duration_seconds = COALESCE(${video.duration_seconds || null}, duration_seconds),
        thumbnail_url = COALESCE(${video.thumbnail_url || null}, thumbnail_url),
        published_at = COALESCE(${video.published_at || null}, published_at),
        sort_order = COALESCE(${video.sort_order ?? null}, sort_order),
        video_type = COALESCE(${video.video_type || null}, video_type)
      WHERE id = ${videoId}
      RETURNING *
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error updating video:', error)
    throw error
  }
}

/**
 * Delete a video
 */
export async function deleteVideo(videoId: string): Promise<Video | null> {
  try {
    const { rows } = await sql<Video>`
      DELETE FROM videos WHERE id = ${videoId}
      RETURNING *
    `
    return rows[0] || null
  } catch (error) {
    console.error('Error deleting video:', error)
    throw error
  }
}
