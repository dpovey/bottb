import type { Video } from '@/lib/db'

interface VideoObjectJsonLdProps {
  videos: Video[]
}

/**
 * JSON-LD structured data for video content.
 * Generates VideoObject schema for YouTube videos to enable rich snippets.
 *
 * @see https://schema.org/VideoObject
 * @see https://developers.google.com/search/docs/appearance/structured-data/video
 */
export function VideoObjectJsonLd({ videos }: VideoObjectJsonLdProps) {
  // Filter to videos that have required fields for valid VideoObject schema
  const validVideos = videos.filter(
    (video) => video.youtube_video_id && video.title
  )

  if (validVideos.length === 0) {
    return null
  }

  const schema = validVideos.map((video) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.title, // Videos may not have separate description
    thumbnailUrl:
      video.thumbnail_url ||
      `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`,
    uploadDate: video.published_at || video.created_at,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
    embedUrl: `https://www.youtube.com/embed/${video.youtube_video_id}`,
    ...(video.duration_seconds && {
      duration: formatIsoDuration(video.duration_seconds),
    }),
  }))

  return (
    <script
      id="videos-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  )
}

/**
 * Convert seconds to ISO 8601 duration format (PT#H#M#S)
 * @example formatIsoDuration(3661) => "PT1H1M1S"
 */
function formatIsoDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  let duration = 'PT'
  if (hours > 0) duration += `${hours}H`
  if (minutes > 0) duration += `${minutes}M`
  if (secs > 0 || duration === 'PT') duration += `${secs}S`

  return duration
}
