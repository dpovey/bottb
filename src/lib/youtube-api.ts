/**
 * YouTube Data API v3 integration for fetching video metadata.
 *
 * Used to get video publish dates for proper chronological sorting,
 * and to scan channels for new videos.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// Default channel handle - can be overridden via env var
const DEFAULT_CHANNEL_HANDLE = 'battleofthetechbands'

export interface YouTubeVideoMetadata {
  title: string
  publishedAt: string | null
  durationSeconds: number | null
  thumbnailUrl: string | null
}

export interface YouTubeChannelVideo {
  videoId: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string | null
  channelTitle: string
  isShort: boolean // Determined by duration (<= 60s and vertical aspect ratio hint)
}

export interface ChannelScanResult {
  channelId: string
  channelTitle: string
  videos: YouTubeChannelVideo[]
  totalResults: number
  nextPageToken?: string
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

// ============================================================================
// Channel Scanning Functions
// ============================================================================

/**
 * Get the YouTube API key from environment
 */
function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null
}

/**
 * Get the configured channel handle
 */
export function getChannelHandle(): string {
  return process.env.YOUTUBE_CHANNEL_HANDLE || DEFAULT_CHANNEL_HANDLE
}

/**
 * Look up a YouTube channel ID from a handle (e.g., @battleofthetechbands)
 *
 * @param handle - Channel handle without the @ symbol
 * @returns Channel ID or null if not found
 */
export async function fetchChannelId(
  handle?: string
): Promise<{ channelId: string; title: string } | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY not configured')
    return null
  }

  const channelHandle = handle || getChannelHandle()

  try {
    // Use the channels.list endpoint with forHandle parameter
    const url = new URL(`${YOUTUBE_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('forHandle', channelHandle)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const error = await response.text()
      console.error(`YouTube API error: ${response.status} - ${error}`)
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.warn(`YouTube channel not found: @${channelHandle}`)
      return null
    }

    return {
      channelId: data.items[0].id,
      title: data.items[0].snippet.title,
    }
  } catch (error) {
    console.error('Failed to fetch YouTube channel ID:', error)
    return null
  }
}

/**
 * Fetch all videos from a YouTube channel's uploads playlist
 *
 * @param channelId - YouTube channel ID (or null to use default handle)
 * @param maxResults - Maximum number of videos to fetch (default 50, max 50 per request)
 * @param pageToken - Pagination token for fetching more results
 * @returns Channel videos with metadata
 */
export async function fetchChannelVideos(
  channelId?: string,
  maxResults: number = 50,
  pageToken?: string
): Promise<ChannelScanResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY not configured')
    return null
  }

  try {
    // If no channel ID provided, look it up from the handle
    let resolvedChannelId = channelId
    let channelTitle = ''

    if (!resolvedChannelId) {
      const channelInfo = await fetchChannelId()
      if (!channelInfo) {
        return null
      }
      resolvedChannelId = channelInfo.channelId
      channelTitle = channelInfo.title
    }

    // First, get the uploads playlist ID
    const channelUrl = new URL(`${YOUTUBE_API_BASE}/channels`)
    channelUrl.searchParams.set('part', 'contentDetails,snippet')
    channelUrl.searchParams.set('id', resolvedChannelId)
    channelUrl.searchParams.set('key', apiKey)

    const channelResponse = await fetch(channelUrl.toString())
    if (!channelResponse.ok) {
      const error = await channelResponse.text()
      console.error(`YouTube API error fetching channel: ${error}`)
      return null
    }

    const channelData = await channelResponse.json()
    if (!channelData.items || channelData.items.length === 0) {
      console.warn(`Channel not found: ${resolvedChannelId}`)
      return null
    }

    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads
    channelTitle = channelTitle || channelData.items[0].snippet.title

    // Now fetch videos from the uploads playlist
    const playlistUrl = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
    playlistUrl.searchParams.set('part', 'snippet,contentDetails')
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
    playlistUrl.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
    playlistUrl.searchParams.set('key', apiKey)

    if (pageToken) {
      playlistUrl.searchParams.set('pageToken', pageToken)
    }

    const playlistResponse = await fetch(playlistUrl.toString())
    if (!playlistResponse.ok) {
      const error = await playlistResponse.text()
      console.error(`YouTube API error fetching playlist: ${error}`)
      return null
    }

    const playlistData = await playlistResponse.json()

    // Get video IDs to fetch duration info
    const videoIds = playlistData.items.map(
      (item: { contentDetails: { videoId: string } }) =>
        item.contentDetails.videoId
    )

    // Fetch video details for duration
    const videoDurations = await fetchVideosDuration(videoIds)

    // Map playlist items to our format
    const videos: YouTubeChannelVideo[] = playlistData.items.map(
      (item: {
        snippet: {
          title: string
          description: string
          publishedAt: string
          channelTitle: string
          thumbnails?: {
            maxres?: { url: string }
            standard?: { url: string }
            high?: { url: string }
            medium?: { url: string }
            default?: { url: string }
          }
        }
        contentDetails: { videoId: string }
      }) => {
        const thumbnails = item.snippet.thumbnails || {}
        const videoId = item.contentDetails.videoId
        const duration = videoDurations[videoId] || 0

        // Shorts are typically <= 60 seconds
        // We can also check if the title contains #shorts
        const isShort =
          duration > 0 &&
          duration <= 60 &&
          (item.snippet.title.toLowerCase().includes('#shorts') ||
            item.snippet.title.toLowerCase().includes('#short') ||
            item.snippet.description.toLowerCase().includes('#shorts'))

        return {
          videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt: item.snippet.publishedAt,
          thumbnailUrl:
            thumbnails.maxres?.url ||
            thumbnails.standard?.url ||
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default?.url ||
            null,
          channelTitle: item.snippet.channelTitle,
          isShort,
        }
      }
    )

    return {
      channelId: resolvedChannelId,
      channelTitle,
      videos,
      totalResults: playlistData.pageInfo.totalResults,
      nextPageToken: playlistData.nextPageToken,
    }
  } catch (error) {
    console.error('Failed to fetch channel videos:', error)
    return null
  }
}

/**
 * Fetch video durations for a list of video IDs
 *
 * @param videoIds - Array of video IDs
 * @returns Map of video ID to duration in seconds
 */
async function fetchVideosDuration(
  videoIds: string[]
): Promise<Record<string, number>> {
  const apiKey = getApiKey()
  if (!apiKey || videoIds.length === 0) {
    return {}
  }

  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) {
      return {}
    }

    const data = await response.json()
    const durations: Record<string, number> = {}

    for (const item of data.items || []) {
      const duration = parseDuration(item.contentDetails.duration)
      if (duration !== null) {
        durations[item.id] = duration
      }
    }

    return durations
  } catch (error) {
    console.error('Failed to fetch video durations:', error)
    return {}
  }
}

/**
 * Fetch all videos from a channel (handles pagination)
 *
 * @param channelId - YouTube channel ID (optional, uses default handle if not provided)
 * @param maxTotal - Maximum total videos to fetch (default 200)
 * @returns All channel videos
 */
export async function fetchAllChannelVideos(
  channelId?: string,
  maxTotal: number = 200
): Promise<ChannelScanResult | null> {
  const allVideos: YouTubeChannelVideo[] = []
  let pageToken: string | undefined
  let result: ChannelScanResult | null = null

  while (allVideos.length < maxTotal) {
    const pageResult = await fetchChannelVideos(channelId, 50, pageToken)
    if (!pageResult) {
      break
    }

    result = pageResult
    allVideos.push(...pageResult.videos)

    if (!pageResult.nextPageToken) {
      break
    }
    pageToken = pageResult.nextPageToken
  }

  if (!result) {
    return null
  }

  return {
    ...result,
    videos: allVideos.slice(0, maxTotal),
    nextPageToken: undefined,
  }
}
