/**
 * Video Title Matching Module
 *
 * Parses YouTube video titles and descriptions to match them to bands and events.
 * Uses fuzzy matching to handle variations in naming.
 */

import { matchEventName, matchBandName, MatchResult } from './name-matcher'
import { Event, Band } from './db'
import { YouTubeChannelVideo } from './youtube-api'

export interface VideoMatchResult {
  video: YouTubeChannelVideo
  eventMatch: MatchResult<Event>
  bandMatch: MatchResult<Band>
  suggestedTitle: string
  confidence: 'high' | 'medium' | 'low' | 'none'
}

// Common patterns in BOTTB video titles
// e.g., "Band Name - Event Name 2025"
// e.g., "Company Name at Sydney Battle of the Tech Bands 2025"
// e.g., "Sydney 2025 - Band Name Performance"
const CITY_PATTERNS = [
  'sydney',
  'melbourne',
  'brisbane',
  'perth',
  'adelaide',
  'auckland',
  'wellington',
]
const YEAR_PATTERN = /20\d{2}/
const EVENT_KEYWORDS = ['battle', 'tech bands', 'bottb']

/**
 * Extract potential event identifiers from a video title
 */
function extractEventHints(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase()
  const hints: string[] = []

  // Look for city + year combinations
  for (const city of CITY_PATTERNS) {
    if (text.includes(city)) {
      const yearMatch = text.match(YEAR_PATTERN)
      if (yearMatch) {
        // Format as event ID: "sydney-2025"
        hints.push(`${city}-${yearMatch[0]}`)
        // Also try full name format
        hints.push(`${city} ${yearMatch[0]}`)
        hints.push(`${city} battle of the tech bands ${yearMatch[0]}`)
      }
    }
  }

  return hints
}

/**
 * Extract potential band/company names from a video title
 *
 * Tries to identify the band or company name by removing common patterns
 */
function extractBandHints(title: string, description: string): string[] {
  const hints: string[] = []

  // Common title patterns:
  // "Band Name - Event Details"
  // "Company Name at Event"
  // "Event - Band Name"
  // "Band Name | Event"

  // Split by common separators
  const separators = [' - ', ' | ', ' – ', ' at ', ' from ', ' @ ']
  let parts: string[] = [title]

  for (const sep of separators) {
    if (title.includes(sep)) {
      parts = title.split(sep).map((p) => p.trim())
      break
    }
  }

  // Add each part as a potential band name hint
  for (const part of parts) {
    // Skip if it looks like an event/location
    const lowerPart = part.toLowerCase()
    const isEventLike =
      CITY_PATTERNS.some((city) => lowerPart.includes(city)) ||
      EVENT_KEYWORDS.some((kw) => lowerPart.includes(kw)) ||
      YEAR_PATTERN.test(lowerPart)

    if (!isEventLike && part.length > 2) {
      hints.push(part)
    }
  }

  // Also check description for "from Company" or "by Company" patterns
  const fromMatch = description.match(/(?:from|by)\s+([^,.]+)/i)
  if (fromMatch) {
    hints.push(fromMatch[1].trim())
  }

  // Look for company mentions like "Salesforce", "Microsoft", etc.
  const companyPatterns = [
    /(\w+)\s+(?:team|band|crew)/i,
    /(?:the\s+)?(\w+)(?:'s|s)?\s+(?:performance|set)/i,
  ]

  for (const pattern of companyPatterns) {
    const match = title.match(pattern)
    if (match) {
      hints.push(match[1])
    }
  }

  return hints
}

/**
 * Match a YouTube video to bands and events in the database
 */
export async function matchVideoToDatabase(
  video: YouTubeChannelVideo
): Promise<VideoMatchResult> {
  const { title, description } = video

  // Extract hints from title and description
  const eventHints = extractEventHints(title, description)
  const bandHints = extractBandHints(title, description)

  // Try to match event first
  let eventMatch: MatchResult<Event> = {
    id: null,
    name: null,
    confidence: 'unmatched',
  }

  for (const hint of eventHints) {
    const match = await matchEventName(hint)
    if (
      match.confidence === 'exact' ||
      (match.confidence === 'fuzzy' && eventMatch.confidence === 'unmatched')
    ) {
      eventMatch = match
      if (match.confidence === 'exact') break
    }
  }

  // Try to match band, preferring bands from the matched event
  let bandMatch: MatchResult<Band> = {
    id: null,
    name: null,
    confidence: 'unmatched',
  }

  for (const hint of bandHints) {
    // If we have an event match, prioritize bands from that event
    const match = await matchBandName(hint, eventMatch.id || undefined)
    if (
      match.confidence === 'exact' ||
      (match.confidence === 'fuzzy' && bandMatch.confidence === 'unmatched')
    ) {
      bandMatch = match
      if (match.confidence === 'exact') break
    }
  }

  // If we matched a band but not an event, try to get the event from the band
  if (bandMatch.data && !eventMatch.id && bandMatch.data.event_id) {
    eventMatch = await matchEventName(bandMatch.data.event_id)
  }

  // Determine overall confidence
  let confidence: VideoMatchResult['confidence'] = 'none'
  if (eventMatch.confidence === 'exact' && bandMatch.confidence === 'exact') {
    confidence = 'high'
  } else if (
    eventMatch.confidence !== 'unmatched' ||
    bandMatch.confidence !== 'unmatched'
  ) {
    if (eventMatch.confidence === 'exact' || bandMatch.confidence === 'exact') {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }
  }

  // Generate a suggested title (cleaned up version)
  const suggestedTitle = cleanVideoTitle(title)

  return {
    video,
    eventMatch,
    bandMatch,
    suggestedTitle,
    confidence,
  }
}

/**
 * Clean up a video title for database storage
 */
function cleanVideoTitle(title: string): string {
  return (
    title
      // Remove common YouTube suffixes
      .replace(/\s*#shorts?\s*/gi, '')
      .replace(/\s*\|\s*YouTube\s*/gi, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Match multiple videos to the database
 */
export async function matchVideosToDatabase(
  videos: YouTubeChannelVideo[]
): Promise<VideoMatchResult[]> {
  const results: VideoMatchResult[] = []

  for (const video of videos) {
    const match = await matchVideoToDatabase(video)
    results.push(match)
  }

  return results
}

/**
 * Filter videos that are already in the database
 *
 * @param videos - Videos from YouTube
 * @param existingVideoIds - Set of YouTube video IDs already in DB
 * @returns Videos that are not in the database
 */
export function filterNewVideos(
  videos: YouTubeChannelVideo[],
  existingVideoIds: Set<string>
): YouTubeChannelVideo[] {
  return videos.filter((v) => !existingVideoIds.has(v.videoId))
}
