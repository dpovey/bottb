/**
 * YouTube Data API v3 integration for fetching video metadata.
 *
 * Used to get video publish dates for proper chronological sorting.
 */

export interface YouTubeVideoMetadata {
  title: string
  publishedAt: string | null
  durationSeconds: number | null
  thumbnailUrl: string | null
}

/**
 * Parse ISO 8601 duration to seconds (e.g., PT3M33S -> 213)
 */
function parseDuration(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Fetch video metadata from YouTube Data API v3.
 *
 * Returns null if the API key is not configured or the video is not found.
 * Fails gracefully - videos can still be created without metadata.
 *
 * @param videoId - YouTube video ID (11 characters)
 * @returns Video metadata or null if unavailable
 */
export async function fetchYouTubeVideoMetadata(
  videoId: string
): Promise<YouTubeVideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    console.warn(
      'YOUTUBE_API_KEY not configured - video metadata will not be fetched'
    )
    return null
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('id', videoId)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.error(
        `YouTube API error: ${response.status} ${response.statusText}`
      )
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.warn(`YouTube video not found: ${videoId}`)
      return null
    }

    const item = data.items[0]
    const snippet = item.snippet
    const contentDetails = item.contentDetails

    // Get the best available thumbnail
    // Priority: maxres > standard > high > medium > default
    const thumbnails = snippet.thumbnails || {}
    const thumbnailUrl =
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      null

    return {
      title: snippet.title || '',
      publishedAt: snippet.publishedAt || null,
      durationSeconds: contentDetails?.duration
        ? parseDuration(contentDetails.duration)
        : null,
      thumbnailUrl,
    }
  } catch (error) {
    console.error('Failed to fetch YouTube video metadata:', error)
    return null
  }
}
