import { sql } from "@vercel/postgres";

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  timezone: string; // IANA timezone name (e.g., "Australia/Brisbane")
  is_active: boolean;
  status: "upcoming" | "voting" | "finalized";
  image_url?: string;
  info?: {
    image_url?: string;
    description?: string;
    website?: string;
    ticket_url?: string;
    social_media?: {
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    venue_info?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface Company {
  slug: string;
  name: string;
  logo_url?: string;
  icon_url?: string;
  website?: string;
  created_at: string;
}

export interface CompanyWithStats extends Company {
  band_count: number;
  event_count: number;
}

export interface Photographer {
  slug: string;
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  created_at: string;
}

export interface PhotographerWithStats extends Photographer {
  photo_count: number;
}

export interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  company_slug?: string;
  order: number;
  image_url?: string;
  hero_thumbnail_url?: string;
  hero_focal_point?: { x: number; y: number };
  info?: {
    logo_url?: string;
    website?: string;
    social_media?: {
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    genre?: string;
    members?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  // Joined fields
  company_name?: string;
  company_icon_url?: string;
}

export interface Vote {
  id: string;
  event_id: string;
  band_id: string;
  voter_type: "crowd" | "judge";
  song_choice?: number;
  performance?: number;
  crowd_vibe?: number;
  visuals?: number; // 2026.1 only
  crowd_vote?: number;
  // User context fields
  ip_address?: string;
  user_agent?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  device_type?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  google_click_id?: string;
  facebook_pixel_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  vote_fingerprint?: string;
  fingerprintjs_visitor_id?: string;
  fingerprintjs_confidence?: number;
  fingerprintjs_confidence_comment?: string;
  email?: string;
  name?: string;
  status?: "approved" | "pending";
  created_at: string;
}

export interface CrowdNoiseMeasurement {
  id: string;
  event_id: string;
  band_id: string;
  energy_level: number;
  peak_volume: number;
  recording_duration: number;
  crowd_score: number;
  created_at: string;
}

export interface FinalizedResult {
  id: string;
  event_id: string;
  band_id: string;
  band_name: string;
  final_rank: number;
  avg_song_choice: number | null;
  avg_performance: number | null;
  avg_crowd_vibe: number | null;
  avg_visuals: number | null; // 2026.1 scoring
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  crowd_noise_energy: number | null; // 2025.1 scoring
  crowd_noise_peak: number | null; // 2025.1 scoring
  crowd_noise_score: number | null; // 2025.1 scoring
  judge_score: number | null;
  crowd_score: number | null;
  visuals_score: number | null; // 2026.1 scoring
  total_score: number | null;
  finalized_at: string;
}

export interface Video {
  id: string;
  youtube_video_id: string;
  title: string;
  event_id: string | null;
  band_id: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  sort_order: number;
  created_at: string;
  // Joined fields
  event_name?: string;
  band_name?: string;
  company_name?: string;
  company_slug?: string;
  company_icon_url?: string;
}

export interface HeroFocalPoint {
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
}

export interface Photo {
  id: string;
  event_id: string | null;
  band_id: string | null;
  photographer: string | null;
  blob_url: string;
  blob_pathname: string;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  content_type: string | null;
  xmp_metadata: Record<string, unknown> | null;
  matched_event_name: string | null;
  matched_band_name: string | null;
  match_confidence: "exact" | "fuzzy" | "manual" | "unmatched" | null;
  uploaded_by: string | null;
  uploaded_at: string;
  created_at: string;
  // Original capture timestamp from EXIF/XMP metadata
  captured_at: string | null;
  // Labels for hero images etc.
  labels: string[];
  // Focal point for hero image display
  hero_focal_point: HeroFocalPoint;
  // Joined fields
  event_name?: string;
  band_name?: string;
  thumbnail_url?: string;
  company_name?: string;
  company_slug?: string;
  company_icon_url?: string;
}

// Photo label constants
export const PHOTO_LABELS = {
  BAND_HERO: "band_hero",
  EVENT_HERO: "event_hero",
  GLOBAL_HERO: "global_hero",
  PHOTOGRAPHER_HERO: "photographer_hero",
} as const;

export type PhotoLabel = (typeof PHOTO_LABELS)[keyof typeof PHOTO_LABELS];

export async function getEvents() {
  const { rows } = await sql<Event>`SELECT * FROM events ORDER BY date DESC`;
  return rows;
}

export async function getActiveEvent() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE is_active = true AND status = 'voting' 
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getUpcomingEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date >= NOW() 
    ORDER BY date ASC
  `;
  return rows;
}

export async function getPastEvents() {
  const { rows } = await sql<Event>`
    SELECT * FROM events 
    WHERE date < NOW() 
    ORDER BY date DESC
  `;
  return rows;
}

export interface PastEventWithWinner extends Event {
  winner_band_name?: string;
  winner_company_slug?: string;
  winner_company_name?: string;
  winner_company_icon_url?: string;
}

/**
 * Get past events with winner info in a single efficient query.
 * Joins with finalized_results and bands to get winner company info.
 */
export async function getPastEventsWithWinners(): Promise<PastEventWithWinner[]> {
  const { rows } = await sql<PastEventWithWinner>`
    SELECT 
      e.*,
      COALESCE(fr.band_name, e.info->>'winner') as winner_band_name,
      COALESCE(b.company_slug, NULL) as winner_company_slug,
      COALESCE(c.name, NULL) as winner_company_name,
      COALESCE(c.icon_url, NULL) as winner_company_icon_url
    FROM events e
    LEFT JOIN finalized_results fr ON fr.event_id = e.id AND fr.final_rank = 1
    LEFT JOIN bands b ON b.id = COALESCE(fr.band_id, e.info->>'winner_band_id')
    LEFT JOIN companies c ON c.slug = b.company_slug
    WHERE e.date < NOW()
    ORDER BY e.date DESC
  `;
  return rows;
}

export async function getBandsForEvent(eventId: string) {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url,
      (SELECT hero_focal_point FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_focal_point
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.event_id = ${eventId} 
    ORDER BY b."order"
  `;
  return rows;
}

/**
 * Get all bands across all events
 */
export async function getBands(): Promise<Band[]> {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    ORDER BY b.event_id, b."order"
  `;
  return rows;
}

export async function getBandById(bandId: string): Promise<Band | null> {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      c.name as company_name,
      c.icon_url as company_icon_url
    FROM bands b 
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `;
  return rows[0] || null;
}

export async function getVotesForEvent(eventId: string) {
  const { rows } =
    await sql<Vote>`SELECT * FROM votes WHERE event_id = ${eventId}`;
  return rows;
}

export async function hasUserVotedByEmail(
  eventId: string,
  email: string
): Promise<boolean> {
  const { rows } = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM votes 
    WHERE event_id = ${eventId} AND email = ${email} AND status = 'approved'
  `;
  return rows[0]?.count > 0;
}

export async function submitVote(vote: Omit<Vote, "id" | "created_at">) {
  const { rows } = await sql<Vote>`
            INSERT INTO votes (
              event_id, band_id, voter_type, song_choice, performance, crowd_vibe, visuals, crowd_vote,
              ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type,
              screen_resolution, timezone, language, google_click_id, facebook_pixel_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, vote_fingerprint,
              fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_confidence_comment, email, name, status
            )
            VALUES (
              ${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${
    vote.song_choice
  },
              ${vote.performance}, ${vote.crowd_vibe}, ${vote.visuals}, ${
    vote.crowd_vote
  },
              ${vote.ip_address}, ${vote.user_agent}, ${vote.browser_name}, ${
    vote.browser_version
  },
              ${vote.os_name}, ${vote.os_version}, ${vote.device_type}, ${
    vote.screen_resolution
  },
              ${vote.timezone}, ${vote.language}, ${vote.google_click_id}, ${
    vote.facebook_pixel_id
  },
              ${vote.utm_source}, ${vote.utm_medium}, ${vote.utm_campaign}, ${
    vote.utm_term
  },
              ${vote.utm_content}, ${vote.vote_fingerprint}, ${
    vote.fingerprintjs_visitor_id
  },
              ${vote.fingerprintjs_confidence}, ${
    vote.fingerprintjs_confidence_comment
  }, 
              ${vote.email}, ${vote.name}, ${vote.status || "approved"}
            )
    RETURNING *
  `;
  return rows[0];
}

export async function updateVote(vote: Omit<Vote, "id" | "created_at">) {
  const { rows } = await sql<Vote>`
    UPDATE votes SET
      band_id = ${vote.band_id},
      song_choice = ${vote.song_choice},
      performance = ${vote.performance},
      crowd_vibe = ${vote.crowd_vibe},
      crowd_vote = ${vote.crowd_vote},
      ip_address = ${vote.ip_address},
      user_agent = ${vote.user_agent},
      browser_name = ${vote.browser_name},
      browser_version = ${vote.browser_version},
      os_name = ${vote.os_name},
      os_version = ${vote.os_version},
      device_type = ${vote.device_type},
      screen_resolution = ${vote.screen_resolution},
      timezone = ${vote.timezone},
      language = ${vote.language},
      google_click_id = ${vote.google_click_id},
      facebook_pixel_id = ${vote.facebook_pixel_id},
      utm_source = ${vote.utm_source},
      utm_medium = ${vote.utm_medium},
      utm_campaign = ${vote.utm_campaign},
      utm_term = ${vote.utm_term},
      utm_content = ${vote.utm_content},
      vote_fingerprint = ${vote.vote_fingerprint},
      fingerprintjs_visitor_id = ${vote.fingerprintjs_visitor_id},
      fingerprintjs_confidence = ${vote.fingerprintjs_confidence},
      fingerprintjs_confidence_comment = ${
        vote.fingerprintjs_confidence_comment
      },
      email = ${vote.email},
      name = ${vote.name},
      status = ${vote.status || "approved"}
    WHERE event_id = ${vote.event_id} AND voter_type = ${vote.voter_type}
    RETURNING *
  `;
  return rows[0];
}

export async function getEventById(eventId: string) {
  const { rows } = await sql<Event>`
    SELECT * FROM events WHERE id = ${eventId}
  `;
  return rows[0] || null;
}

export async function updateEventStatus(
  eventId: string,
  status: "upcoming" | "voting" | "finalized"
) {
  const { rows } = await sql<Event>`
    UPDATE events 
    SET status = ${status}
    WHERE id = ${eventId}
    RETURNING *
  `;
  return rows[0] || null;
}

/**
 * Calculate band scores dynamically from votes
 * 
 * ⚠️ IMPORTANT: Do NOT use this for finalized events!
 * 
 * For finalized events, use `getFinalizedResults()` instead. This function:
 * - Runs expensive SQL queries with CTEs and aggregations
 * - Calculates scores from live vote data (which may change)
 * - Should only be used for non-finalized events or admin preview
 * 
 * @param eventId - The event ID
 * @returns Array of band scores with calculated averages
 * 
 * @see getFinalizedResults - Use this for finalized events
 * @see hasFinalizedResults - Check if finalized results exist
 */
export async function getBandScores(eventId: string) {
  const { rows } = await sql`
    WITH total_votes AS (
      SELECT COUNT(*) as total_crowd_votes
      FROM votes v
      JOIN bands b ON v.band_id = b.id
      WHERE b.event_id = ${eventId} AND v.voter_type = 'crowd'
    )
    SELECT 
      b.id,
      b.name,
      b."order",
      b.info,
      b.description,
      b.company_slug,
      c.name as company_name,
      c.icon_url as company_icon_url,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url,
      (SELECT hero_focal_point FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_focal_point,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.song_choice END) as avg_song_choice,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.performance END) as avg_performance,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.crowd_vibe END) as avg_crowd_vibe,
      AVG(CASE WHEN v.voter_type = 'judge' THEN v.visuals END) as avg_visuals,
      AVG(CASE WHEN v.voter_type = 'crowd' THEN v.crowd_vote END) as avg_crowd_vote,
      COUNT(CASE WHEN v.voter_type = 'crowd' THEN 1 END) as crowd_vote_count,
      COUNT(CASE WHEN v.voter_type = 'judge' THEN 1 END) as judge_vote_count,
      tv.total_crowd_votes,
      cnm.energy_level as crowd_noise_energy,
      cnm.peak_volume as crowd_noise_peak,
      cnm.crowd_score
    FROM bands b
    LEFT JOIN companies c ON b.company_slug = c.slug
    LEFT JOIN votes v ON b.id = v.band_id
    LEFT JOIN crowd_noise_measurements cnm ON b.id = cnm.band_id AND cnm.event_id = ${eventId}
    CROSS JOIN total_votes tv
    WHERE b.event_id = ${eventId}
    GROUP BY b.id, b.name, b."order", b.info, b.description, b.company_slug, c.name, c.icon_url, tv.total_crowd_votes, cnm.energy_level, cnm.peak_volume, cnm.crowd_score
    ORDER BY b."order"
  `;
  return rows;
}

export async function submitCrowdNoiseMeasurement(
  measurement: Omit<CrowdNoiseMeasurement, "id" | "created_at">
) {
  // First, delete any existing measurement for this event/band combination
  await sql`
    DELETE FROM crowd_noise_measurements 
    WHERE event_id = ${measurement.event_id} AND band_id = ${measurement.band_id}
  `;

  // Then insert the new measurement
  const { rows } = await sql<CrowdNoiseMeasurement>`
    INSERT INTO crowd_noise_measurements (event_id, band_id, energy_level, peak_volume, recording_duration, crowd_score)
    VALUES (${measurement.event_id}, ${measurement.band_id}, ${measurement.energy_level}, ${measurement.peak_volume}, ${measurement.recording_duration}, ${measurement.crowd_score})
    RETURNING *
  `;
  return rows[0];
}

export async function getCrowdNoiseMeasurements(eventId: string) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    SELECT cnm.*, b.name as band_name, b."order" as band_order
    FROM crowd_noise_measurements cnm
    JOIN bands b ON cnm.band_id = b.id
    WHERE cnm.event_id = ${eventId}
    ORDER BY b."order"
  `;
  return rows;
}

export async function getCrowdNoiseMeasurement(
  eventId: string,
  bandId: string
) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    SELECT * FROM crowd_noise_measurements 
    WHERE event_id = ${eventId} AND band_id = ${bandId}
  `;
  return rows[0] || null;
}

export async function deleteCrowdNoiseMeasurement(
  eventId: string,
  bandId: string
) {
  const { rows } = await sql<CrowdNoiseMeasurement>`
    DELETE FROM crowd_noise_measurements 
    WHERE event_id = ${eventId} AND band_id = ${bandId}
    RETURNING *
  `;
  return rows[0] || null;
}

// Photo functions

export type PhotoOrderBy = "random" | "date" | "uploaded";

export interface GetPhotosOptions {
  eventId?: string;
  bandId?: string;
  bandIds?: string[]; // Support multiple band IDs for deduplicated band names
  photographer?: string;
  companySlug?: string;
  limit?: number;
  offset?: number;
  orderBy?: PhotoOrderBy;
}

/**
 * Sort photos by capture date (oldest first for chronological viewing)
 * Uses filename as secondary sort for photos with the same timestamp
 * (e.g., when falling back to event date for photos without metadata)
 */
function sortByDate(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => {
    const dateA = a.captured_at ? new Date(a.captured_at).getTime() : 0;
    const dateB = b.captured_at ? new Date(b.captured_at).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // Secondary sort by filename for photos with same timestamp
    const filenameA = a.original_filename || "";
    const filenameB = b.original_filename || "";
    return filenameA.localeCompare(filenameB, undefined, { numeric: true });
  });
}

// Result type for combined photos + count query
interface PhotosWithCountResult {
  photos: Photo[];
  total: number;
}

// Extended Photo type with total_count from window function
interface PhotoWithCount extends Photo {
  total_count: string;
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
    bandIds,
    photographer,
    companySlug,
    limit = 50,
    offset = 0,
    orderBy = "uploaded",
  } = options;

  // Use bandIds if provided, otherwise fall back to bandId
  const effectiveBandIds = bandIds && bandIds.length > 0 ? bandIds : (bandId ? [bandId] : undefined);

  // For random ordering, use SQL RANDOM()
  if (orderBy === "random") {
    return getPhotosRandomWithCount({
      eventId,
      bandIds: effectiveBandIds,
      photographer,
      companySlug,
      limit,
    });
  }

  // Helper to apply date sorting after fetch
  const applyOrdering = (photos: Photo[]): Photo[] => {
    if (orderBy === "date") {
      return sortByDate(photos);
    }
    return photos;
  };

  try {
    // Use COUNT(*) OVER() to get total count in the same query
    const { rows } = await sql<PhotoWithCount>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             COUNT(*) OVER() as total_count
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (
          ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
          OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
        )
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const total = parseInt(rows[0]?.total_count || "0", 10);
    // Remove total_count from photos before returning
    const photos = rows.map(({ total_count: _total_count, ...photo }) => photo as Photo);
    
    return { photos: applyOrdering(photos), total };
  } catch (error) {
    console.error("Error fetching photos with count:", error);
    throw error;
  }
}

/**
 * Get photos in truly random order with total count using SQL RANDOM()
 * This mixes photos from all events/bands for better discovery
 * All filters are combined with AND for proper filtering
 */
async function getPhotosRandomWithCount(options: {
  eventId?: string;
  bandIds?: string[];
  photographer?: string;
  companySlug?: string;
  limit: number;
}): Promise<PhotosWithCountResult> {
  const { eventId, bandIds, photographer, companySlug, limit } = options;
  const effectiveBandIds = bandIds;

  try {
    // Use COUNT(*) OVER() to get total count in the same query
    const { rows } = await sql<PhotoWithCount>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url,
             COUNT(*) OVER() as total_count
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (
          ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
          OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
        )
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;

    const total = parseInt(rows[0]?.total_count || "0", 10);
    // Remove total_count from photos before returning
    const photos = rows.map(({ total_count: _total_count, ...photo }) => photo as Photo);
    
    return { photos, total };
  } catch (error) {
    console.error("Error fetching random photos with count:", error);
    throw error;
  }
}

/**
 * Get photos in truly random order using SQL RANDOM()
 * This mixes photos from all events/bands for better discovery
 * All filters are combined with AND for proper filtering
 * @deprecated Use getPhotosWithCount instead for better performance
 */
async function getPhotosRandom(options: {
  eventId?: string;
  bandId?: string;
  bandIds?: string[];
  photographer?: string;
  companySlug?: string;
  limit: number;
}): Promise<Photo[]> {
  const { eventId, bandId, bandIds, photographer, companySlug, limit } = options;
  // Use bandIds if provided, otherwise fall back to bandId
  const effectiveBandIds = bandIds && bandIds.length > 0 ? bandIds : (bandId ? [bandId] : undefined);

  try {
    // Use conditional SQL to combine all filters with AND
    // Each condition is: (param IS NULL OR column = param) which passes when filter not set
    // Special handling for "none" values which mean "filter for NULL"
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (
          ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
          OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
        )
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching random photos:", error);
    throw error;
  }
}

export async function getPhotos(
  options: GetPhotosOptions = {}
): Promise<Photo[]> {
  const {
    eventId,
    bandId,
    bandIds,
    photographer,
    companySlug,
    limit = 50,
    offset = 0,
    orderBy = "uploaded",
  } = options;
  
  // Use bandIds if provided, otherwise fall back to bandId
  const effectiveBandIds = bandIds && bandIds.length > 0 ? bandIds : (bandId ? [bandId] : undefined);

  // For random ordering, use SQL RANDOM() to get truly random photos across all data
  // Note: pagination with random doesn't guarantee unique results across pages,
  // but this gives better variety for discovery/browsing
  if (orderBy === "random") {
    return getPhotosRandom({
      eventId,
      bandId: effectiveBandIds?.[0], // Keep for backward compatibility
      bandIds: effectiveBandIds,
      photographer,
      companySlug,
      limit,
    });
  }

  // Helper to apply date sorting after fetch (for chronological slideshow viewing)
  const applyOrdering = (photos: Photo[]): Photo[] => {
    if (orderBy === "date") {
      return sortByDate(photos);
    }
    return photos; // Already ordered by uploaded_at DESC from SQL
  };

  try {
    // Use conditional SQL to combine all filters with AND
    // Each condition is: (param IS NULL OR column = param) which passes when filter not set
    // Special handling for "none" values which mean "filter for NULL"
    // Support multiple band IDs for deduplicated band names
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (
          ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
          OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
        )
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
      ORDER BY p.uploaded_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return applyOrdering(rows);
  } catch (error) {
    console.error("Error fetching photos:", error);
    throw error;
  }
}

export async function getPhotoById(photoId: string): Promise<Photo | null> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.id = ${photoId}
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching photo:", error);
    throw error;
  }
}

export async function getPhotoCount(
  options: Omit<GetPhotosOptions, "limit" | "offset"> = {}
): Promise<number> {
  const { eventId, bandId, bandIds, photographer, companySlug } = options;
  // Use bandIds if provided, otherwise fall back to bandId
  const effectiveBandIds = bandIds && bandIds.length > 0 ? bandIds : (bandId ? [bandId] : undefined);

  try {
    // Use conditional SQL to combine all filters with AND
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count 
      FROM photos p
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE 
        (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
        AND (
          ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
          OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
          OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
        )
        AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
        AND (
          ${companySlug || null}::text IS NULL 
          OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
          OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
        )
    `;
    return parseInt(rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("Error counting photos:", error);
    throw error;
  }
}

export async function getDistinctPhotographers(): Promise<string[]> {
  try {
    const { rows } = await sql<{ photographer: string }>`
      SELECT DISTINCT photographer FROM photos 
      WHERE photographer IS NOT NULL 
      ORDER BY photographer
    `;
    return rows.map((r) => r.photographer);
  } catch (error) {
    console.error("Error fetching photographers:", error);
    throw error;
  }
}

/**
 * Get available filter options based on current filters.
 * Returns options that have matching photos given the current filter context.
 */
export interface AvailablePhotoFilters {
  companies: { slug: string; name: string; count: number }[];
  events: { id: string; name: string; count: number }[];
  bands: { id: string; name: string; count: number }[];
  photographers: { name: string; count: number }[];
  hasPhotosWithoutBand: boolean;
  hasPhotosWithoutCompany: boolean;
}

export async function getAvailablePhotoFilters(
  options: Omit<GetPhotosOptions, "limit" | "offset"> = {}
): Promise<AvailablePhotoFilters> {
  const {
    eventId,
    bandId,
    bandIds,
    photographer,
    companySlug,
  } = options;
  // Use bandIds if provided, otherwise fall back to bandId
  const effectiveBandIds = bandIds && bandIds.length > 0 ? bandIds : (bandId ? [bandId] : undefined);

  try {
    // Run all queries in parallel for better performance
    // Filter results based on current active filters to show only available options

    const [
      companiesResult,
      eventsResult,
      bandsResult,
      photographersResult,
      noBandResult,
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
          AND (
            ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
            OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
          )
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
          (
            ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
            OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
          )
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
          )
        GROUP BY e.id, e.name
        ORDER BY e.name
      `,

      // Get bands that have photos matching current filters (excluding band filter itself)
      sql<{ id: string; name: string; count: string }>`
        SELECT b.id, b.name, COUNT(p.id)::text as count
        FROM photos p
        INNER JOIN bands b ON p.band_id = b.id
        WHERE 
          (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
          )
        GROUP BY b.id, b.name
        ORDER BY b.name
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
            ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
            OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
          )
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none' AND (b.company_slug IS NULL OR p.band_id IS NULL))
            OR (${companySlug || null} != 'none' AND b.company_slug = ${companySlug || null})
          )
        GROUP BY p.photographer
        ORDER BY p.photographer
      `,

      // Check if there are photos without a band matching current filters
      sql<{ count: string }>`
        SELECT COUNT(*)::text as count 
        FROM photos p
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          p.band_id IS NULL
          AND (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none')
          )
      `,

      // Check if there are photos without a company (via band) matching current filters
      sql<{ count: string }>`
        SELECT COUNT(*)::text as count 
        FROM photos p
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE 
          (b.company_slug IS NULL OR p.band_id IS NULL)
          AND (${eventId || null}::text IS NULL OR p.event_id = ${eventId || null})
          AND (
            ${!effectiveBandIds || effectiveBandIds.length === 0 ? null : 'filter'}::text IS NULL
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] === 'none' ? 'none' : null}::text = 'none' AND p.band_id IS NULL)
            OR (${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null}::text IS NOT NULL AND p.band_id = ${effectiveBandIds && effectiveBandIds.length === 1 && effectiveBandIds[0] !== 'none' ? effectiveBandIds[0] : null})
            OR (${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[] IS NOT NULL AND p.band_id = ANY(${effectiveBandIds && effectiveBandIds.length > 1 ? `{${effectiveBandIds.join(",")}}` : null}::text[]))
          )
          AND (${photographer || null}::text IS NULL OR p.photographer = ${photographer || null})
          AND (
            ${companySlug || null}::text IS NULL 
            OR (${companySlug || null} = 'none')
          )
      `,
    ]);

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
      bands: bandsResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      photographers: photographersResult.rows.map((r) => ({
        name: r.name,
        count: parseInt(r.count, 10),
      })),
      hasPhotosWithoutBand:
        parseInt(noBandResult.rows[0]?.count || "0", 10) > 0,
      hasPhotosWithoutCompany:
        parseInt(noCompanyResult.rows[0]?.count || "0", 10) > 0,
    };
  } catch (error) {
    console.error("Error fetching available photo filters:", error);
    throw error;
  }
}

// Photo label functions

export async function updatePhotoLabels(
  photoId: string,
  labels: string[]
): Promise<Photo | null> {
  try {
    // Convert array to PostgreSQL array literal format
    const labelsArrayLiteral = `{${labels.join(",")}}`;
    const { rows } = await sql<Photo>`
      UPDATE photos 
      SET labels = ${labelsArrayLiteral}::text[]
      WHERE id = ${photoId}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error updating photo labels:", error);
    throw error;
  }
}

export async function getPhotosByLabel(
  label: string,
  options?: { eventId?: string; bandId?: string }
): Promise<Photo[]> {
  try {
    if (options?.bandId) {
      // Get photos with this label for a specific band
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
          AND p.band_id = ${options.bandId}
        ORDER BY p.uploaded_at DESC
      `;
      return rows;
    } else if (options?.eventId) {
      // Get photos with this label for a specific event
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
          AND p.event_id = ${options.eventId}
        ORDER BY p.uploaded_at DESC
      `;
      return rows;
    } else {
      // Get all photos with this label
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, b.company_slug as company_slug, c.icon_url as company_icon_url,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        LEFT JOIN companies c ON b.company_slug = c.slug
        WHERE ${label} = ANY(p.labels)
        ORDER BY p.uploaded_at DESC
      `;
      return rows;
    }
  } catch (error) {
    console.error("Error fetching photos by label:", error);
    throw error;
  }
}

/**
 * Get all photos that have any hero label (band_hero, event_hero, global_hero, photographer_hero)
 * Used for sitemap generation - these are curated, high-quality photos worth indexing
 */
export async function getAllHeroPhotos(): Promise<Photo[]> {
  try {
    // PostgreSQL array literal format for the overlap operator
    const heroLabelsLiteral = `{${PHOTO_LABELS.BAND_HERO},${PHOTO_LABELS.EVENT_HERO},${PHOTO_LABELS.GLOBAL_HERO},${PHOTO_LABELS.PHOTOGRAPHER_HERO}}`;

    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name, c.name as company_name, 
             b.company_slug as company_slug, c.icon_url as company_icon_url,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE p.labels && ${heroLabelsLiteral}::text[]
      ORDER BY p.uploaded_at DESC
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching hero photos:", error);
    throw error;
  }
}

export async function updateHeroFocalPoint(
  photoId: string,
  focalPoint: HeroFocalPoint
): Promise<Photo | null> {
  try {
    // Validate focal point values
    const x = Math.max(0, Math.min(100, focalPoint.x));
    const y = Math.max(0, Math.min(100, focalPoint.y));
    const focalPointJson = JSON.stringify({ x, y });

    const { rows } = await sql<Photo>`
      UPDATE photos 
      SET hero_focal_point = ${focalPointJson}::jsonb
      WHERE id = ${photoId}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error updating hero focal point:", error);
    throw error;
  }
}

// ============================================================
// Finalized Results Functions
// ============================================================

interface BandScoreRow {
  id: string;
  name: string;
  order: number;
  avg_song_choice: string | null;
  avg_performance: string | null;
  avg_crowd_vibe: string | null;
  avg_visuals: string | null;
  avg_crowd_vote: string | null;
  crowd_vote_count: string;
  judge_vote_count: string;
  total_crowd_votes: string;
  crowd_noise_energy: string | null;
  crowd_noise_peak: string | null;
  crowd_score: number | null;
}

/**
 * Check if finalized results exist for an event
 */
export async function hasFinalizedResults(eventId: string): Promise<boolean> {
  const { rows } = await sql<{ count: number }>`
    SELECT COUNT(*) as count FROM finalized_results 
    WHERE event_id = ${eventId}
  `;
  return Number(rows[0]?.count) > 0;
}

/**
 * Get finalized results for an event from the finalized_results table
 * 
 * ⚠️ IMPORTANT: Always use this for finalized events instead of getBandScores()
 * 
 * Finalized results are:
 * - Pre-calculated and stored when an event is finalized
 * - Frozen at finalization time (won't change if votes are modified)
 * - Much faster to query (simple SELECT vs complex aggregations)
 * - The source of truth for finalized events
 * 
 * Pattern:
 * ```typescript
 * if (event.status === 'finalized' && await hasFinalizedResults(eventId)) {
 *   const results = await getFinalizedResults(eventId);
 *   // Use finalized results
 * } else {
 *   const scores = await getBandScores(eventId);
 *   // Calculate dynamically
 * }
 * ```
 * 
 * @param eventId - The event ID
 * @returns Array of finalized results, sorted by final_rank (winner first)
 * 
 * @see getBandScores - Use this only for non-finalized events
 * @see hasFinalizedResults - Check if finalized results exist
 * @see finalizeEventResults - Function that creates finalized results
 */
export async function getFinalizedResults(
  eventId: string
): Promise<FinalizedResult[]> {
  const { rows } = await sql<FinalizedResult>`
    SELECT * FROM finalized_results 
    WHERE event_id = ${eventId}
    ORDER BY final_rank ASC
  `;
  return rows;
}

/**
 * Calculate and store finalized results for an event
 * This should be called when an event is finalized
 */
export async function finalizeEventResults(
  eventId: string,
  scoringVersion: string = "2025.1"
): Promise<FinalizedResult[]> {
  // Get the current scores
  const scores = (await getBandScores(eventId)) as BandScoreRow[];

  if (scores.length === 0) {
    return [];
  }

  // Find the maximum vote count among all bands for normalization
  const maxVoteCount = Math.max(
    ...scores.map((s) => Number(s.crowd_vote_count || 0))
  );

  // Calculate final scores and rankings based on scoring version
  const bandResults = scores.map((score) => {
    const songChoice = Number(score.avg_song_choice || 0);
    const performance = Number(score.avg_performance || 0);
    const crowdVibe = Number(score.avg_crowd_vibe || 0);
    const visuals = Number(score.avg_visuals || 0);

    // Normalized crowd vote score (max 10 points)
    const crowdVoteScore =
      maxVoteCount > 0
        ? (Number(score.crowd_vote_count || 0) / maxVoteCount) * 10
        : 0;

    // Version-specific scoring
    let judgeScore: number;
    let totalScore: number;
    let screamOMeterScore = 0;
    let visualsScore = 0;

    if (scoringVersion === "2022.1") {
      // No scoring for 2022.1 - winner is manually set
      judgeScore = 0;
      totalScore = 0;
    } else if (scoringVersion === "2025.1") {
      // 2025.1: Song(20) + Perf(30) + Vibe(30) + Vote(10) + Scream-o-meter(10) = 100
      judgeScore = songChoice + performance + crowdVibe;
      screamOMeterScore = score.crowd_score ? Number(score.crowd_score) : 0;
      totalScore = judgeScore + crowdVoteScore + screamOMeterScore;
    } else {
      // 2026.1: Song(20) + Perf(30) + Vibe(20) + Vote(10) + Visuals(20) = 100
      judgeScore = songChoice + performance + crowdVibe + visuals;
      visualsScore = visuals;
      totalScore = judgeScore + crowdVoteScore;
    }

    return {
      ...score,
      songChoice,
      performance,
      crowdVibe,
      visuals,
      crowdVoteScore,
      judgeScore,
      screamOMeterScore,
      visualsScore,
      totalScore,
    };
  });

  // Sort by total score (descending)
  bandResults.sort((a, b) => b.totalScore - a.totalScore);

  // Delete any existing finalized results for this event
  await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`;

  // Insert the finalized results
  const results: FinalizedResult[] = [];
  for (let i = 0; i < bandResults.length; i++) {
    const band = bandResults[i];
    const finalRank = i + 1;

    const { rows } = await sql<FinalizedResult>`
      INSERT INTO finalized_results (
        event_id, band_id, band_name, final_rank,
        avg_song_choice, avg_performance, avg_crowd_vibe, avg_visuals,
        crowd_vote_count, judge_vote_count, total_crowd_votes,
        crowd_noise_energy, crowd_noise_peak, crowd_noise_score,
        judge_score, crowd_score, visuals_score, total_score
      ) VALUES (
        ${eventId}, ${band.id}, ${band.name}, ${finalRank},
        ${band.songChoice}, ${band.performance}, ${band.crowdVibe}, ${
      band.visuals || null
    },
        ${Number(band.crowd_vote_count || 0)}, ${Number(
      band.judge_vote_count || 0
    )}, ${Number(band.total_crowd_votes || 0)},
        ${band.crowd_noise_energy || null}, ${band.crowd_noise_peak || null}, ${
      band.screamOMeterScore || null
    },
        ${band.judgeScore}, ${band.crowdVoteScore}, ${
      band.visualsScore || null
    }, ${band.totalScore}
      )
      RETURNING *
    `;
    results.push(rows[0]);
  }

  return results;
}

/**
 * Delete finalized results for an event
 */
export async function deleteFinalizedResults(eventId: string): Promise<void> {
  await sql`DELETE FROM finalized_results WHERE event_id = ${eventId}`;
}

// ============================================================
// Company Functions
// ============================================================

/**
 * Get all companies with band and event counts
 */
export async function getCompanies(): Promise<CompanyWithStats[]> {
  const { rows } = await sql<CompanyWithStats>`
    SELECT 
      c.*,
      COUNT(DISTINCT b.id) as band_count,
      COUNT(DISTINCT b.event_id) as event_count
    FROM companies c
    LEFT JOIN bands b ON c.slug = b.company_slug
    GROUP BY c.slug, c.name, c.logo_url, c.website, c.created_at
    ORDER BY c.name ASC
  `;
  return rows;
}

/**
 * Get a single company by slug
 */
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const { rows } = await sql<Company>`
    SELECT * FROM companies WHERE slug = ${slug}
  `;
  return rows[0] || null;
}

/**
 * Get all bands for a company, with event info
 */
export async function getCompanyBands(
  companySlug: string
): Promise<(Band & { event_name: string; event_date: string })[]> {
  const { rows } = await sql<Band & { event_name: string; event_date: string }>`
    SELECT 
      b.*,
      e.name as event_name,
      e.date as event_date,
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b
    JOIN events e ON b.event_id = e.id
    WHERE b.company_slug = ${companySlug}
    ORDER BY e.date DESC, b."order" ASC
  `;
  return rows;
}

/**
 * Get distinct companies from bands (for filters)
 */
export async function getDistinctCompanies(): Promise<
  { slug: string; name: string }[]
> {
  const { rows } = await sql<{ slug: string; name: string }>`
    SELECT DISTINCT c.slug, c.name
    FROM companies c
    INNER JOIN bands b ON c.slug = b.company_slug
    ORDER BY c.name ASC
  `;
  return rows;
}

// ============================================================
// Photographer Functions
// ============================================================

/**
 * Get all photographers with photo counts
 */
export async function getPhotographers(): Promise<PhotographerWithStats[]> {
  const { rows } = await sql<PhotographerWithStats>`
    SELECT 
      p.*,
      COALESCE(pc.photo_count, 0)::int as photo_count
    FROM photographers p
    LEFT JOIN (
      SELECT photographer as name, COUNT(*)::int as photo_count
      FROM photos
      WHERE photographer IS NOT NULL
      GROUP BY photographer
    ) pc ON p.name = pc.name
    ORDER BY p.name ASC
  `;
  return rows;
}

/**
 * Get a single photographer by slug
 */
export async function getPhotographerBySlug(
  slug: string
): Promise<PhotographerWithStats | null> {
  const { rows } = await sql<PhotographerWithStats>`
    SELECT 
      p.*,
      COALESCE(pc.photo_count, 0)::int as photo_count
    FROM photographers p
    LEFT JOIN (
      SELECT photographer as name, COUNT(*)::int as photo_count
      FROM photos
      WHERE photographer IS NOT NULL
      GROUP BY photographer
    ) pc ON p.name = pc.name
    WHERE p.slug = ${slug}
  `;
  return rows[0] || null;
}

/**
 * Get hero photo for a photographer (by name match and label)
 */
export async function getPhotographerHeroPhoto(
  photographerName: string
): Promise<Photo | null> {
  const { rows } = await sql<Photo>`
    SELECT p.*, e.name as event_name, b.name as band_name,
           COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
    FROM photos p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    WHERE p.photographer = ${photographerName}
      AND 'photographer_hero' = ANY(p.labels)
    ORDER BY p.uploaded_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Get a random photo from a photographer (fallback for hero)
 */
export async function getPhotographerRandomPhoto(
  photographerName: string
): Promise<Photo | null> {
  const { rows } = await sql<Photo>`
    SELECT p.*, e.name as event_name, b.name as band_name,
           COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
    FROM photos p
    LEFT JOIN events e ON p.event_id = e.id
    LEFT JOIN bands b ON p.band_id = b.id
    WHERE p.photographer = ${photographerName}
    ORDER BY RANDOM()
    LIMIT 1
  `;
  return rows[0] || null;
}

// ============================================================
// Video Functions
// ============================================================

export interface GetVideosOptions {
  eventId?: string;
  bandId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get videos with optional filters
 */
export async function getVideos(options: GetVideosOptions = {}): Promise<Video[]> {
  const { eventId, bandId, limit = 50, offset = 0 } = options;

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
      ORDER BY v.sort_order ASC, v.published_at DESC NULLS LAST, v.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching videos:", error);
    throw error;
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
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching video:", error);
    throw error;
  }
}

/**
 * Get a video by YouTube video ID
 */
export async function getVideoByYoutubeId(youtubeVideoId: string): Promise<Video | null> {
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
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching video by YouTube ID:", error);
    throw error;
  }
}

/**
 * Get video count with optional filters
 */
export async function getVideoCount(
  options: Omit<GetVideosOptions, "limit" | "offset"> = {}
): Promise<number> {
  const { eventId, bandId } = options;

  try {
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count 
      FROM videos v
      WHERE 
        (${eventId || null}::text IS NULL OR v.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR v.band_id = ${bandId || null})
    `;
    return parseInt(rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("Error counting videos:", error);
    throw error;
  }
}

/**
 * Create a new video
 */
export async function createVideo(
  video: Omit<Video, "id" | "created_at" | "event_name" | "band_name" | "company_name" | "company_slug" | "company_icon_url">
): Promise<Video> {
  try {
    const { rows } = await sql<Video>`
      INSERT INTO videos (
        youtube_video_id, title, event_id, band_id, 
        duration_seconds, thumbnail_url, published_at, sort_order
      )
      VALUES (
        ${video.youtube_video_id}, ${video.title}, ${video.event_id}, ${video.band_id},
        ${video.duration_seconds}, ${video.thumbnail_url}, ${video.published_at}, ${video.sort_order}
      )
      RETURNING *
    `;
    return rows[0];
  } catch (error) {
    console.error("Error creating video:", error);
    throw error;
  }
}

/**
 * Update an existing video
 */
export async function updateVideo(
  videoId: string,
  video: Partial<Omit<Video, "id" | "created_at" | "event_name" | "band_name" | "company_name" | "company_slug" | "company_icon_url">>
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
        sort_order = COALESCE(${video.sort_order ?? null}, sort_order)
      WHERE id = ${videoId}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error updating video:", error);
    throw error;
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
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error deleting video:", error);
    throw error;
  }
}

// ============================================================
// Setlist Song Types and Functions
// ============================================================

export type SongType = "cover" | "mashup" | "medley" | "transition";
export type SetlistStatus = "pending" | "locked" | "conflict";

export interface AdditionalSong {
  title: string;
  artist: string;
}

export interface SetlistSong {
  id: string;
  band_id: string;
  position: number;
  song_type: SongType;
  title: string;
  artist: string;
  additional_songs: AdditionalSong[];
  transition_to_title: string | null;
  transition_to_artist: string | null;
  youtube_video_id: string | null;
  status: SetlistStatus;
  created_at: string;
  updated_at: string;
  // Joined fields (from band -> event)
  band_name?: string;
  event_id?: string;
  event_name?: string;
  event_date?: string;
  company_slug?: string;
  company_name?: string;
  company_icon_url?: string;
}

export interface SetlistSongInput {
  id: string; // UUIDv7 generated by caller
  band_id: string;
  position: number;
  song_type: SongType;
  title: string;
  artist: string;
  additional_songs?: AdditionalSong[];
  transition_to_title?: string;
  transition_to_artist?: string;
  youtube_video_id?: string;
  status?: SetlistStatus;
}

/**
 * Get all setlist songs for a band
 */
export async function getSetlistForBand(bandId: string): Promise<SetlistSong[]> {
  try {
    const { rows } = await sql<SetlistSong>`
      SELECT s.*, 
             b.name as band_name,
             b.event_id,
             e.name as event_name,
             e.date as event_date,
             b.company_slug,
             c.name as company_name,
             c.icon_url as company_icon_url
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      JOIN events e ON b.event_id = e.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE s.band_id = ${bandId}
      ORDER BY s.position ASC
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching setlist for band:", error);
    throw error;
  }
}

/**
 * Get all setlist songs for an event (all bands)
 */
export async function getSetlistsForEvent(eventId: string): Promise<SetlistSong[]> {
  try {
    const { rows } = await sql<SetlistSong>`
      SELECT s.*, 
             b.name as band_name,
             b.event_id,
             e.name as event_name,
             e.date as event_date,
             b.company_slug,
             c.name as company_name,
             c.icon_url as company_icon_url
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      JOIN events e ON b.event_id = e.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE b.event_id = ${eventId}
      ORDER BY b."order" ASC, s.position ASC
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching setlists for event:", error);
    throw error;
  }
}

/**
 * Get all setlist songs across all events (for the /songs page)
 */
export interface GetAllSongsOptions {
  eventId?: string;
  bandId?: string;
  songType?: SongType;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getAllSongs(options: GetAllSongsOptions = {}): Promise<SetlistSong[]> {
  const { eventId, bandId, songType, search, limit = 100, offset = 0 } = options;

  try {
    // Build search pattern if provided
    const searchPattern = search ? `%${search}%` : null;

    const { rows } = await sql<SetlistSong>`
      SELECT s.*, 
             b.name as band_name,
             b.event_id,
             e.name as event_name,
             e.date as event_date,
             b.company_slug,
             c.name as company_name,
             c.icon_url as company_icon_url
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      JOIN events e ON b.event_id = e.id
      LEFT JOIN companies c ON b.company_slug = c.slug
      WHERE 
        (${eventId || null}::text IS NULL OR b.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR s.band_id = ${bandId || null})
        AND (${songType || null}::text IS NULL OR s.song_type = ${songType || null})
        AND (
          ${searchPattern}::text IS NULL 
          OR s.title ILIKE ${searchPattern || ""}
          OR s.artist ILIKE ${searchPattern || ""}
          OR s.transition_to_title ILIKE ${searchPattern || ""}
          OR s.transition_to_artist ILIKE ${searchPattern || ""}
        )
      ORDER BY e.date DESC, b."order" ASC, s.position ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows;
  } catch (error) {
    console.error("Error fetching all songs:", error);
    throw error;
  }
}

/**
 * Get total count of songs with optional filters
 */
export async function getSongCount(options: Omit<GetAllSongsOptions, "limit" | "offset"> = {}): Promise<number> {
  const { eventId, bandId, songType, search } = options;
  const searchPattern = search ? `%${search}%` : null;

  try {
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*) as count
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      WHERE 
        (${eventId || null}::text IS NULL OR b.event_id = ${eventId || null})
        AND (${bandId || null}::text IS NULL OR s.band_id = ${bandId || null})
        AND (${songType || null}::text IS NULL OR s.song_type = ${songType || null})
        AND (
          ${searchPattern}::text IS NULL 
          OR s.title ILIKE ${searchPattern || ""}
          OR s.artist ILIKE ${searchPattern || ""}
          OR s.transition_to_title ILIKE ${searchPattern || ""}
          OR s.transition_to_artist ILIKE ${searchPattern || ""}
        )
    `;
    return parseInt(rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("Error counting songs:", error);
    throw error;
  }
}

/**
 * Create a new setlist song
 */
export async function createSetlistSong(song: SetlistSongInput): Promise<SetlistSong> {
  try {
    const additionalSongsJson = JSON.stringify(song.additional_songs || []);
    
    const { rows } = await sql<SetlistSong>`
      INSERT INTO setlist_songs (
        id, band_id, position, song_type, title, artist,
        additional_songs, transition_to_title, transition_to_artist,
        youtube_video_id, status
      )
      VALUES (
        ${song.id}, ${song.band_id}, ${song.position}, ${song.song_type},
        ${song.title}, ${song.artist}, ${additionalSongsJson}::jsonb,
        ${song.transition_to_title || null}, ${song.transition_to_artist || null},
        ${song.youtube_video_id || null}, ${song.status || "pending"}
      )
      RETURNING *
    `;
    return rows[0];
  } catch (error) {
    console.error("Error creating setlist song:", error);
    throw error;
  }
}

/**
 * Update an existing setlist song
 */
export async function updateSetlistSong(
  songId: string,
  updates: Partial<Omit<SetlistSongInput, "id" | "band_id">>
): Promise<SetlistSong | null> {
  try {
    const additionalSongsJson = updates.additional_songs 
      ? JSON.stringify(updates.additional_songs) 
      : null;

    const { rows } = await sql<SetlistSong>`
      UPDATE setlist_songs SET
        position = COALESCE(${updates.position ?? null}, position),
        song_type = COALESCE(${updates.song_type || null}, song_type),
        title = COALESCE(${updates.title || null}, title),
        artist = COALESCE(${updates.artist || null}, artist),
        additional_songs = COALESCE(${additionalSongsJson}::jsonb, additional_songs),
        transition_to_title = ${updates.transition_to_title === undefined ? null : updates.transition_to_title},
        transition_to_artist = ${updates.transition_to_artist === undefined ? null : updates.transition_to_artist},
        youtube_video_id = ${updates.youtube_video_id === undefined ? null : updates.youtube_video_id},
        status = COALESCE(${updates.status || null}, status),
        updated_at = NOW()
      WHERE id = ${songId}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error updating setlist song:", error);
    throw error;
  }
}

/**
 * Delete a setlist song
 */
export async function deleteSetlistSong(songId: string): Promise<SetlistSong | null> {
  try {
    const { rows } = await sql<SetlistSong>`
      DELETE FROM setlist_songs WHERE id = ${songId}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error deleting setlist song:", error);
    throw error;
  }
}

/**
 * Reorder setlist songs for a band
 * Takes an array of song IDs in the desired order
 */
export async function reorderSetlistSongs(
  bandId: string,
  songIds: string[]
): Promise<void> {
  try {
    // Update each song's position based on its index in the array
    for (let i = 0; i < songIds.length; i++) {
      await sql`
        UPDATE setlist_songs 
        SET position = ${i + 1}, updated_at = NOW()
        WHERE id = ${songIds[i]} AND band_id = ${bandId}
      `;
    }
  } catch (error) {
    console.error("Error reordering setlist songs:", error);
    throw error;
  }
}

/**
 * Detect song conflicts within an event
 * Returns songs that appear in multiple bands' setlists
 */
export interface SongConflict {
  title: string;
  artist: string;
  bands: { band_id: string; band_name: string; song_id: string }[];
}

export async function detectSongConflicts(eventId: string): Promise<SongConflict[]> {
  try {
    // Find songs with the same title+artist across different bands in the event
    const { rows } = await sql<{
      title: string;
      artist: string;
      band_id: string;
      band_name: string;
      song_id: string;
    }>`
      SELECT s.title, s.artist, s.band_id, b.name as band_name, s.id as song_id
      FROM setlist_songs s
      JOIN bands b ON s.band_id = b.id
      WHERE b.event_id = ${eventId}
        AND (LOWER(s.title), LOWER(s.artist)) IN (
          SELECT LOWER(s2.title), LOWER(s2.artist)
          FROM setlist_songs s2
          JOIN bands b2 ON s2.band_id = b2.id
          WHERE b2.event_id = ${eventId}
          GROUP BY LOWER(s2.title), LOWER(s2.artist)
          HAVING COUNT(DISTINCT s2.band_id) > 1
        )
      ORDER BY s.title, s.artist, b."order"
    `;

    // Group by title+artist
    const conflictMap = new Map<string, SongConflict>();
    for (const row of rows) {
      const key = `${row.title.toLowerCase()}|${row.artist.toLowerCase()}`;
      if (!conflictMap.has(key)) {
        conflictMap.set(key, {
          title: row.title,
          artist: row.artist,
          bands: [],
        });
      }
      conflictMap.get(key)!.bands.push({
        band_id: row.band_id,
        band_name: row.band_name,
        song_id: row.song_id,
      });
    }

    return Array.from(conflictMap.values());
  } catch (error) {
    console.error("Error detecting song conflicts:", error);
    throw error;
  }
}

/**
 * Update conflict status for songs in an event
 * Call this after adding/updating songs to mark conflicts
 */
export async function updateConflictStatus(eventId: string): Promise<void> {
  try {
    // First, reset all songs in the event to their non-conflict status
    await sql`
      UPDATE setlist_songs s
      SET status = CASE WHEN s.status = 'conflict' THEN 'pending' ELSE s.status END,
          updated_at = NOW()
      FROM bands b
      WHERE s.band_id = b.id AND b.event_id = ${eventId}
    `;

    // Then, mark conflicts
    const conflicts = await detectSongConflicts(eventId);
    for (const conflict of conflicts) {
      for (const band of conflict.bands) {
        await sql`
          UPDATE setlist_songs
          SET status = 'conflict', updated_at = NOW()
          WHERE id = ${band.song_id}
        `;
      }
    }
  } catch (error) {
    console.error("Error updating conflict status:", error);
    throw error;
  }
}

/**
 * Lock all songs for a band (mark as finalized)
 */
export async function lockBandSetlist(bandId: string): Promise<void> {
  try {
    await sql`
      UPDATE setlist_songs
      SET status = 'locked', updated_at = NOW()
      WHERE band_id = ${bandId} AND status != 'conflict'
    `;
  } catch (error) {
    console.error("Error locking band setlist:", error);
    throw error;
  }
}

/**
 * Unlock all songs for a band (return to pending)
 */
export async function unlockBandSetlist(bandId: string): Promise<void> {
  try {
    await sql`
      UPDATE setlist_songs
      SET status = 'pending', updated_at = NOW()
      WHERE band_id = ${bandId}
    `;
  } catch (error) {
    console.error("Error unlocking band setlist:", error);
    throw error;
  }
}
