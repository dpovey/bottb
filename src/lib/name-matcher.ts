import { sql } from './sql'
import { Event, Band } from './db'

export interface MatchResult<T> {
  id: string | null
  name: string | null
  confidence: 'exact' | 'fuzzy' | 'unmatched'
  data?: T
}

const FUZZY_MATCH_THRESHOLD = 0.6

/**
 * Normalize a string for comparison (lowercase, remove special characters)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1)
  const s2 = normalizeString(str2)

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8
  }

  // Levenshtein distance
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  const distance = matrix[s1.length][s2.length]
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - distance / maxLength
}

/**
 * Fuzzy match an event name to existing events in the database
 */
export async function matchEventName(
  name: string
): Promise<MatchResult<Event>> {
  const normalizedName = normalizeString(name)

  const { rows: events } = await sql<Event>`SELECT id, name FROM events`

  let bestMatch: MatchResult<Event> = {
    id: null,
    name: null,
    confidence: 'unmatched',
  }
  let highestSimilarity = 0

  for (const event of events) {
    const normalizedEventName = normalizeString(event.name)

    // Check for exact match
    if (normalizedEventName === normalizedName) {
      return {
        id: event.id,
        name: event.name,
        confidence: 'exact',
        data: event,
      }
    }

    // Check for ID match (e.g., "sydney-2025")
    if (normalizeString(event.id) === normalizedName) {
      return {
        id: event.id,
        name: event.name,
        confidence: 'exact',
        data: event,
      }
    }

    const similarity = stringSimilarity(name, event.name)
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      bestMatch = {
        id: event.id,
        name: event.name,
        confidence: 'fuzzy',
        data: event,
      }
    }
  }

  if (highestSimilarity >= FUZZY_MATCH_THRESHOLD) {
    return bestMatch
  }

  return { id: null, name: name, confidence: 'unmatched' }
}

/**
 * Fuzzy match a band name (or company/description) to existing bands in the database
 */
export async function matchBandName(
  name: string,
  eventId?: string
): Promise<MatchResult<Band>> {
  const normalizedName = normalizeString(name)

  // First, try direct case-insensitive database lookup if we have an event
  if (eventId) {
    // Check both name AND description (which stores company name)
    const { rows: exactRows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands 
      WHERE event_id = ${eventId} 
      AND (LOWER(name) = LOWER(${name}) OR LOWER(description) = LOWER(${name}))
    `
    if (exactRows.length > 0) {
      return {
        id: exactRows[0].id,
        name: exactRows[0].name,
        confidence: 'exact',
        data: exactRows[0],
      }
    }

    // Try ILIKE for partial matches on name or description
    const { rows: likeRows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands 
      WHERE event_id = ${eventId} 
      AND (
        LOWER(name) LIKE LOWER(${'%' + name + '%'}) 
        OR LOWER(${name}) LIKE '%' || LOWER(name) || '%'
        OR LOWER(description) LIKE LOWER(${'%' + name + '%'})
        OR LOWER(${name}) LIKE '%' || LOWER(description) || '%'
      )
    `
    if (likeRows.length === 1) {
      // Only use if there's exactly one match to avoid ambiguity
      return {
        id: likeRows[0].id,
        name: likeRows[0].name,
        confidence: 'fuzzy',
        data: likeRows[0],
      }
    }
  }

  // Fall back to in-memory matching for fuzzy cases
  let bands: Band[]
  if (eventId) {
    const { rows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands WHERE event_id = ${eventId}
    `
    bands = rows
  } else {
    const { rows } =
      await sql<Band>`SELECT id, name, description, event_id FROM bands`
    bands = rows
  }

  let bestMatch: MatchResult<Band> = {
    id: null,
    name: null,
    confidence: 'unmatched',
  }
  let highestSimilarity = 0

  for (const band of bands) {
    const normalizedBandName = normalizeString(band.name)
    const normalizedDescription = band.description
      ? normalizeString(band.description)
      : ''

    // Check for exact match on normalized band name
    if (normalizedBandName === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
      }
    }

    // Check for exact match on normalized description (company name)
    if (normalizedDescription && normalizedDescription === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
      }
    }

    // Check for ID match
    if (normalizeString(band.id) === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
      }
    }

    // Check similarity against both name and description, take the better match
    const nameSimilarity = stringSimilarity(name, band.name)
    const descSimilarity = band.description
      ? stringSimilarity(name, band.description)
      : 0
    const similarity = Math.max(nameSimilarity, descSimilarity)

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      bestMatch = {
        id: band.id,
        name: band.name,
        confidence: 'fuzzy',
        data: band,
      }
    }
  }

  if (highestSimilarity >= FUZZY_MATCH_THRESHOLD) {
    return bestMatch
  }

  return { id: null, name: name, confidence: 'unmatched' }
}

export interface DebugMatchResult extends MatchResult<Band> {
  inputName: string
  normalizedInput: string
  bestScore: number
  candidates: Array<{ name: string; id: string; score: number }>
}

/**
 * Debug version of matchBandName that returns detailed matching info
 */
export async function debugMatchBandName(
  name: string,
  eventId?: string
): Promise<DebugMatchResult> {
  const normalizedName = normalizeString(name)

  // First, try direct case-insensitive database lookup if we have an event
  if (eventId) {
    // Check both name AND description (which stores company name)
    const { rows: exactRows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands 
      WHERE event_id = ${eventId} 
      AND (LOWER(name) = LOWER(${name}) OR LOWER(description) = LOWER(${name}))
    `
    if (exactRows.length > 0) {
      return {
        id: exactRows[0].id,
        name: exactRows[0].name,
        confidence: 'exact',
        data: exactRows[0],
        inputName: name,
        normalizedInput: normalizedName,
        bestScore: 1.0,
        candidates: [
          { name: exactRows[0].name, id: exactRows[0].id, score: 1.0 },
        ],
      }
    }

    // Try ILIKE for partial matches on name or description
    const { rows: likeRows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands 
      WHERE event_id = ${eventId} 
      AND (
        LOWER(name) LIKE LOWER(${'%' + name + '%'}) 
        OR LOWER(${name}) LIKE '%' || LOWER(name) || '%'
        OR LOWER(description) LIKE LOWER(${'%' + name + '%'})
        OR LOWER(${name}) LIKE '%' || LOWER(description) || '%'
      )
    `
    if (likeRows.length === 1) {
      return {
        id: likeRows[0].id,
        name: likeRows[0].name,
        confidence: 'fuzzy',
        data: likeRows[0],
        inputName: name,
        normalizedInput: normalizedName,
        bestScore: 0.8,
        candidates: [
          { name: likeRows[0].name, id: likeRows[0].id, score: 0.8 },
        ],
      }
    }
  }

  // Fall back to in-memory matching
  let bands: Band[]
  if (eventId) {
    const { rows } = await sql<Band>`
      SELECT id, name, description, event_id FROM bands WHERE event_id = ${eventId}
    `
    bands = rows
  } else {
    const { rows } =
      await sql<Band>`SELECT id, name, description, event_id FROM bands`
    bands = rows
  }

  const candidates: Array<{ name: string; id: string; score: number }> = []
  let bestMatch: MatchResult<Band> = {
    id: null,
    name: null,
    confidence: 'unmatched',
  }
  let highestSimilarity = 0

  for (const band of bands) {
    const normalizedBandName = normalizeString(band.name)
    const normalizedDescription = band.description
      ? normalizeString(band.description)
      : ''

    // Check for exact match on normalized band name
    if (normalizedBandName === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
        inputName: name,
        normalizedInput: normalizedName,
        bestScore: 1.0,
        candidates: [{ name: band.name, id: band.id, score: 1.0 }],
      }
    }

    // Check for exact match on normalized description (company name)
    if (normalizedDescription && normalizedDescription === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
        inputName: name,
        normalizedInput: normalizedName,
        bestScore: 1.0,
        candidates: [{ name: band.name, id: band.id, score: 1.0 }],
      }
    }

    // Check for ID match
    if (normalizeString(band.id) === normalizedName) {
      return {
        id: band.id,
        name: band.name,
        confidence: 'exact',
        data: band,
        inputName: name,
        normalizedInput: normalizedName,
        bestScore: 1.0,
        candidates: [{ name: band.name, id: band.id, score: 1.0 }],
      }
    }

    // Check similarity against both name and description, take the better match
    const nameSimilarity = stringSimilarity(name, band.name)
    const descSimilarity = band.description
      ? stringSimilarity(name, band.description)
      : 0
    const similarity = Math.max(nameSimilarity, descSimilarity)

    // Show which field matched better in candidates
    const matchedField =
      descSimilarity > nameSimilarity
        ? `${band.name} (${band.description})`
        : band.name
    candidates.push({ name: matchedField, id: band.id, score: similarity })

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      bestMatch = {
        id: band.id,
        name: band.name,
        confidence: 'fuzzy',
        data: band,
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score)

  if (highestSimilarity >= FUZZY_MATCH_THRESHOLD) {
    return {
      ...bestMatch,
      inputName: name,
      normalizedInput: normalizedName,
      bestScore: highestSimilarity,
      candidates: candidates.slice(0, 5), // Top 5
    }
  }

  return {
    id: null,
    name: name,
    confidence: 'unmatched',
    inputName: name,
    normalizedInput: normalizedName,
    bestScore: highestSimilarity,
    candidates: candidates.slice(0, 5), // Top 5
  }
}
