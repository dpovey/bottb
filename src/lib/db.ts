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

export interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  order: number;
  image_url?: string;
  hero_thumbnail_url?: string;
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
}

export interface Vote {
  id: string;
  event_id: string;
  band_id: string;
  voter_type: "crowd" | "judge";
  song_choice?: number;
  performance?: number;
  crowd_vibe?: number;
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
  avg_visuals: number | null;  // 2026.1 scoring
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  crowd_noise_energy: number | null;  // 2025.1 scoring
  crowd_noise_peak: number | null;    // 2025.1 scoring
  crowd_noise_score: number | null;   // 2025.1 scoring
  judge_score: number | null;
  crowd_score: number | null;
  visuals_score: number | null;  // 2026.1 scoring
  total_score: number | null;
  finalized_at: string;
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
  // Labels for hero images etc.
  labels: string[];
  // Focal point for hero image display
  hero_focal_point: HeroFocalPoint;
  // Joined fields
  event_name?: string;
  band_name?: string;
  thumbnail_url?: string;
}

// Photo label constants
export const PHOTO_LABELS = {
  BAND_HERO: "band_hero",
  EVENT_HERO: "event_hero",
  GLOBAL_HERO: "global_hero",
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

export async function getBandsForEvent(eventId: string) {
  const { rows } = await sql<Band>`
    SELECT b.*, 
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url
    FROM bands b 
    WHERE event_id = ${eventId} 
    ORDER BY "order"
  `;
  return rows;
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
              event_id, band_id, voter_type, song_choice, performance, crowd_vibe, crowd_vote,
              ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type,
              screen_resolution, timezone, language, google_click_id, facebook_pixel_id,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, vote_fingerprint,
              fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_confidence_comment, email, name, status
            )
            VALUES (
              ${vote.event_id}, ${vote.band_id}, ${vote.voter_type}, ${
    vote.song_choice
  },
              ${vote.performance}, ${vote.crowd_vibe}, ${vote.crowd_vote},
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
  }, ${vote.email}, ${vote.name}, ${vote.status || "approved"}
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
      (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_thumbnail_url,
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
    LEFT JOIN votes v ON b.id = v.band_id
    LEFT JOIN crowd_noise_measurements cnm ON b.id = cnm.band_id AND cnm.event_id = ${eventId}
    CROSS JOIN total_votes tv
    WHERE b.event_id = ${eventId}
    GROUP BY b.id, b.name, b."order", b.info, b.description, tv.total_crowd_votes, cnm.energy_level, cnm.peak_volume, cnm.crowd_score
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

export interface GetPhotosOptions {
  eventId?: string;
  bandId?: string;
  photographer?: string;
  limit?: number;
  offset?: number;
}

export async function getPhotos(options: GetPhotosOptions = {}): Promise<Photo[]> {
  const { eventId, bandId, photographer, limit = 50, offset = 0 } = options;

  try {
    // Build query based on filters
    // Note: @vercel/postgres doesn't support query chaining, so we use separate queries
    if (eventId && bandId) {
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE p.event_id = ${eventId} AND p.band_id = ${bandId}
        ORDER BY p.uploaded_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    } else if (eventId) {
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE p.event_id = ${eventId}
        ORDER BY p.uploaded_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    } else if (bandId) {
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE p.band_id = ${bandId}
        ORDER BY p.uploaded_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    } else if (photographer) {
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE p.photographer = ${photographer}
        ORDER BY p.uploaded_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    } else {
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        ORDER BY p.uploaded_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    }
  } catch (error) {
    console.error("Error fetching photos:", error);
    throw error;
  }
}

export async function getPhotoById(photoId: string): Promise<Photo | null> {
  try {
    const { rows } = await sql<Photo>`
      SELECT p.*, e.name as event_name, b.name as band_name,
             COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
      FROM photos p
      LEFT JOIN events e ON p.event_id = e.id
      LEFT JOIN bands b ON p.band_id = b.id
      WHERE p.id = ${photoId}
    `;
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching photo:", error);
    throw error;
  }
}

export async function getPhotoCount(options: Omit<GetPhotosOptions, 'limit' | 'offset'> = {}): Promise<number> {
  const { eventId, bandId, photographer } = options;

  try {
    if (eventId && bandId) {
      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*) as count FROM photos WHERE event_id = ${eventId} AND band_id = ${bandId}
      `;
      return parseInt(rows[0]?.count || "0", 10);
    } else if (eventId) {
      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*) as count FROM photos WHERE event_id = ${eventId}
      `;
      return parseInt(rows[0]?.count || "0", 10);
    } else if (bandId) {
      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*) as count FROM photos WHERE band_id = ${bandId}
      `;
      return parseInt(rows[0]?.count || "0", 10);
    } else if (photographer) {
      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*) as count FROM photos WHERE photographer = ${photographer}
      `;
      return parseInt(rows[0]?.count || "0", 10);
    } else {
      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*) as count FROM photos
      `;
      return parseInt(rows[0]?.count || "0", 10);
    }
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
    return rows.map(r => r.photographer);
  } catch (error) {
    console.error("Error fetching photographers:", error);
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
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE ${label} = ANY(p.labels)
          AND p.band_id = ${options.bandId}
        ORDER BY p.uploaded_at DESC
      `;
      return rows;
    } else if (options?.eventId) {
      // Get photos with this label for a specific event
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
        WHERE ${label} = ANY(p.labels)
          AND p.event_id = ${options.eventId}
        ORDER BY p.uploaded_at DESC
      `;
      return rows;
    } else {
      // Get all photos with this label
      const { rows } = await sql<Photo>`
        SELECT p.*, e.name as event_name, b.name as band_name,
               COALESCE(p.xmp_metadata->>'thumbnail_url', REPLACE(p.blob_url, '/large.webp', '/thumbnail.webp')) as thumbnail_url
        FROM photos p
        LEFT JOIN events e ON p.event_id = e.id
        LEFT JOIN bands b ON p.band_id = b.id
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
 * Get finalized results for an event
 */
export async function getFinalizedResults(eventId: string): Promise<FinalizedResult[]> {
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
        ${band.songChoice}, ${band.performance}, ${band.crowdVibe}, ${band.visuals || null},
        ${Number(band.crowd_vote_count || 0)}, ${Number(band.judge_vote_count || 0)}, ${Number(band.total_crowd_votes || 0)},
        ${band.crowd_noise_energy || null}, ${band.crowd_noise_peak || null}, ${band.screamOMeterScore || null},
        ${band.judgeScore}, ${band.crowdVoteScore}, ${band.visualsScore || null}, ${band.totalScore}
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
