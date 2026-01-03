/**
 * Database types and constants
 *
 * This file contains only types and constants that can be safely
 * imported by both server and client components.
 *
 * For database queries, import from './db' (server-only)
 */

export interface Event {
  id: string
  name: string
  date: string
  location: string
  timezone: string // IANA timezone name (e.g., "Australia/Brisbane")
  is_active: boolean
  status: 'upcoming' | 'voting' | 'finalized'
  image_url?: string
  info?: {
    image_url?: string
    description?: string
    website?: string
    ticket_url?: string
    social_media?: {
      twitter?: string
      instagram?: string
      facebook?: string
    }
    venue_info?: string
    [key: string]: unknown
  }
  created_at: string
}

export interface Company {
  slug: string
  name: string
  logo_url?: string
  icon_url?: string
  website?: string
  created_at: string
}

export interface CompanyWithStats extends Company {
  band_count: number
  event_count: number
}

export interface Photographer {
  slug: string
  name: string
  bio: string | null
  location: string | null
  website: string | null
  instagram: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
}

export interface PhotographerWithStats extends Photographer {
  photo_count: number
}

export interface Band {
  id: string
  event_id: string
  name: string
  description?: string
  company_slug?: string
  order: number
  image_url?: string
  hero_thumbnail_url?: string
  hero_focal_point?: { x: number; y: number }
  info?: {
    logo_url?: string
    website?: string
    social_media?: {
      twitter?: string
      instagram?: string
      facebook?: string
    }
    genre?: string
    members?: string[]
    [key: string]: unknown
  }
  created_at: string
  // Joined fields
  company_name?: string
  company_icon_url?: string
}

export interface Vote {
  id: string
  event_id: string
  band_id: string
  voter_type: 'crowd' | 'judge'
  song_choice?: number
  performance?: number
  crowd_vibe?: number
  visuals?: number // 2026.1 only
  crowd_vote?: number
  // User context fields
  ip_address?: string
  user_agent?: string
  browser_name?: string
  browser_version?: string
  os_name?: string
  os_version?: string
  device_type?: string
  screen_resolution?: string
  timezone?: string
  language?: string
  google_click_id?: string
  facebook_pixel_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  vote_fingerprint?: string
  fingerprintjs_visitor_id?: string
  fingerprintjs_confidence?: number
  fingerprintjs_confidence_comment?: string
  email?: string
  name?: string
  status?: 'approved' | 'pending'
  created_at: string
}

export interface CrowdNoiseMeasurement {
  id: string
  event_id: string
  band_id: string
  energy_level: number
  peak_volume: number
  recording_duration: number
  crowd_score: number
  created_at: string
}

export interface FinalizedResult {
  id: string
  event_id: string
  band_id: string
  band_name: string
  final_rank: number
  avg_song_choice: number | null
  avg_performance: number | null
  avg_crowd_vibe: number | null
  avg_visuals: number | null // 2026.1 scoring
  crowd_vote_count: number
  judge_vote_count: number
  total_crowd_votes: number
  crowd_noise_energy: number | null // 2025.1 scoring
  crowd_noise_peak: number | null // 2025.1 scoring
  crowd_noise_score: number | null // 2025.1 scoring
  judge_score: number | null
  crowd_score: number | null
  visuals_score: number | null // 2026.1 scoring
  total_score: number | null
  finalized_at: string
}

export interface Video {
  id: string
  youtube_video_id: string
  title: string
  event_id: string | null
  band_id: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  published_at: string | null
  sort_order: number
  created_at: string
  // Joined fields
  event_name?: string
  band_name?: string
  company_name?: string
  company_slug?: string
  company_icon_url?: string
}

export interface HeroFocalPoint {
  x: number // 0-100 percentage from left
  y: number // 0-100 percentage from top
}

export interface Photo {
  id: string
  event_id: string | null
  band_id: string | null
  photographer: string | null
  blob_url: string
  blob_pathname: string
  original_filename: string | null
  width: number | null
  height: number | null
  file_size: number | null
  content_type: string | null
  xmp_metadata: Record<string, unknown> | null
  matched_event_name: string | null
  matched_band_name: string | null
  match_confidence: 'exact' | 'fuzzy' | 'manual' | 'unmatched' | null
  uploaded_by: string | null
  uploaded_at: string
  created_at: string
  // Original capture timestamp from EXIF/XMP metadata
  captured_at: string | null
  // Original full-resolution image URL (when available)
  original_blob_url: string | null
  // Labels for hero images etc.
  labels: string[]
  // Focal point for hero image display
  hero_focal_point: HeroFocalPoint
  // Whether the image is B&W or largely monochrome (null = not yet classified)
  is_monochrome: boolean | null
  // SEO-friendly slug (e.g., "the-fuggles-brisbane-2024-1")
  slug: string | null
  // Prefix for sequence grouping (e.g., "the-fuggles-brisbane-2024")
  slug_prefix: string | null
  // Joined fields
  event_name?: string
  band_name?: string
  thumbnail_url?: string
  thumbnail_2x_url?: string
  thumbnail_3x_url?: string
  medium_url?: string
  large_4k_url?: string
  company_name?: string
  company_slug?: string
  company_icon_url?: string
}

// Photo label constants
export const PHOTO_LABELS = {
  BAND_HERO: 'band_hero',
  EVENT_HERO: 'event_hero',
  GLOBAL_HERO: 'global_hero',
  PHOTOGRAPHER_HERO: 'photographer_hero',
} as const

export type PhotoLabel = (typeof PHOTO_LABELS)[keyof typeof PHOTO_LABELS]

export type PhotoOrderBy = 'random' | 'date' | 'uploaded'

// Photo intelligence types

export interface PhotoCrop {
  id: string
  photo_id: string
  aspect_ratio: string // '4:5', '16:9', '1:1', '9:16'
  crop_box: { x: number; y: number; width: number; height: number }
  confidence: number
  method: 'face' | 'person' | 'saliency' | 'manual'
  created_at: string
}

export interface PhotoCluster {
  id: string
  cluster_type: 'near_duplicate' | 'scene' | 'person'
  photo_ids: string[]
  representative_photo_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
