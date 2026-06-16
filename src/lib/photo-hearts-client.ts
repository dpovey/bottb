import { getFingerprintJSData } from './user-context-client'

/**
 * Client-side helpers for photo hearts (likes).
 *
 * The server (photo_hearts table + per-visitor fingerprint) is the source of
 * truth for dedup. localStorage here only remembers which photos this browser
 * has hearted so the UI can show the filled state instantly across pages
 * without a round-trip.
 */

const STORAGE_KEY = 'hearted_photos'

export interface HeartToggleResponse {
  hearted: boolean
  heart_count: number
}

function readHeartedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeHeartedSet(set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

/** Whether this browser has recorded a heart for the photo (UI hint only). */
export function isPhotoHeartedLocally(photoId: string): boolean {
  return readHeartedSet().has(photoId)
}

/** Remember (or forget) a photo's hearted state for this browser. */
export function setPhotoHeartedLocally(
  photoId: string,
  hearted: boolean
): void {
  const set = readHeartedSet()
  if (hearted) {
    set.add(photoId)
  } else {
    set.delete(photoId)
  }
  writeHeartedSet(set)
}

/**
 * Toggle the heart for a photo on the server and sync local state.
 * Attaches the FingerprintJS visitor id (when available) for dedup.
 */
export async function togglePhotoHeartRequest(
  photoId: string
): Promise<HeartToggleResponse> {
  const fingerprint = await getFingerprintJSData()

  const response = await fetch(`/api/photos/${photoId}/heart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fingerprintjs_visitor_id: fingerprint?.visitorId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to toggle heart: ${response.status}`)
  }

  const result = (await response.json()) as HeartToggleResponse
  setPhotoHeartedLocally(photoId, result.hearted)
  return result
}

/**
 * Record a download against the photo's persistent counter. Fire-and-forget:
 * never throws, so it can't block the actual file download.
 */
export function recordPhotoDownload(photoId: string): void {
  if (typeof window === 'undefined') return
  void fetch(`/api/photos/${photoId}/download`, { method: 'POST' }).catch(
    () => {
      // Best-effort metric — ignore failures.
    }
  )
}
