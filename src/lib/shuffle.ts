/**
 * Deterministic shuffle utilities using seeded PRNG
 *
 * These functions provide a way to shuffle arrays deterministically,
 * meaning the same seed will always produce the same shuffle order.
 */

/**
 * Mulberry32 seeded PRNG - deterministic random number generator
 * Same seed always produces the same sequence of numbers
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Convert a string seed to a numeric seed for the PRNG
 */
function stringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Deterministically shuffle an array using Fisher-Yates with seeded PRNG
 * Same seed always produces the same shuffled order
 */
export function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array]
  const random = mulberry32(stringToSeed(seed))

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

/**
 * Get the current time-based seed for shared shuffles
 * Changes every 15 minutes so users in the same window get the same shuffle
 */
export function getTimeBasedSeed(): string {
  const fifteenMinutesMs = 15 * 60 * 1000
  return Math.floor(Date.now() / fifteenMinutesMs).toString()
}
