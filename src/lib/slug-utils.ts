/**
 * Convert a human-readable name into a URL-friendly slug.
 *
 * Lowercase, strip characters outside [a-z0-9 -], collapse whitespace
 * runs to single hyphens, then collapse repeated hyphens.
 *
 *   nameToSlug("Cool Band Name!") === "cool-band-name"
 *
 * This implementation matches the previous duplicates byte-for-byte to
 * avoid any churn in slugs already persisted in the database.
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
