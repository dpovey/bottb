/**
 * Client-side API utilities with rate limit handling
 *
 * Provides a fetch wrapper that:
 * - Automatically retries on 429 with exponential backoff
 * - Respects Retry-After headers
 * - Provides callbacks for rate limit events (for UI feedback)
 */

export interface FetchOptions extends RequestInit {
  /** Maximum number of retry attempts for 429 responses (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number
  /** Callback when rate limited (for showing toast/notification) */
  onRateLimited?: (retryAfter: number, attempt: number) => void
  /** Callback when retry is about to happen */
  onRetry?: (attempt: number, delay: number) => void
}

export interface ApiError extends Error {
  status: number
  retryAfter?: number
}

/**
 * Enhanced fetch that handles rate limiting gracefully
 *
 * @example
 * ```ts
 * // Basic usage
 * const data = await apiFetch('/api/photos')
 *
 * // With rate limit notification
 * const data = await apiFetch('/api/photos', {
 *   onRateLimited: (retryAfter) => {
 *     toast.info(`Too many requests. Retrying in ${retryAfter}s...`)
 *   }
 * })
 * ```
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    onRateLimited,
    onRetry,
    ...fetchOptions
  } = options

  let lastError: ApiError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)

      if (response.ok) {
        return await response.json()
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response)
        const delay = retryAfter
          ? retryAfter * 1000
          : baseDelay * Math.pow(2, attempt)

        // Create error for potential throw
        const error = new Error('Too many requests') as ApiError
        error.status = 429
        error.retryAfter = retryAfter || Math.ceil(delay / 1000)
        lastError = error

        // If we have retries left, wait and retry
        if (attempt < maxRetries) {
          onRateLimited?.(error.retryAfter, attempt + 1)
          onRetry?.(attempt + 1, delay)
          await sleep(delay)
          continue
        }

        // No more retries
        throw error
      }

      // Other errors - don't retry
      const errorData = await response.json().catch(() => ({}))
      const error = new Error(
        errorData.error || `Request failed with status ${response.status}`
      ) as ApiError
      error.status = response.status
      throw error
    } catch (err) {
      // Network errors - could retry but for now just throw
      if (err instanceof Error && !('status' in err)) {
        const error = err as ApiError
        error.status = 0
        throw error
      }
      throw err
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError || new Error('Request failed')
}

/**
 * Parse Retry-After header (supports both seconds and HTTP-date formats)
 */
function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get('Retry-After')
  if (!header) return null

  // Try parsing as number (seconds)
  const seconds = parseInt(header, 10)
  if (!isNaN(seconds)) return seconds

  // Try parsing as HTTP-date
  const date = new Date(header)
  if (!isNaN(date.getTime())) {
    const delay = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000))
    return delay
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    'status' in error &&
    (error as ApiError).status === 429
  )
}

/**
 * Get rate limit info from response headers
 */
export function getRateLimitInfo(response: Response): {
  limit: number | null
  remaining: number | null
  reset: Date | null
} {
  const limit = response.headers.get('X-RateLimit-Limit')
  const remaining = response.headers.get('X-RateLimit-Remaining')
  const reset = response.headers.get('X-RateLimit-Reset')

  return {
    limit: limit ? parseInt(limit, 10) : null,
    remaining: remaining ? parseInt(remaining, 10) : null,
    reset: reset ? new Date(parseInt(reset, 10)) : null,
  }
}
