import { ImageResponse } from 'next/og'
import {
  getEventById,
  getBandsForEvent,
  getPhotosByLabel,
  PHOTO_LABELS,
} from '@/lib/db'

// Image metadata
export const runtime = 'edge'
export const alt = 'Battle of the Tech Bands Event'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Generate dynamic OG image for event pages
export default async function Image({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params

  // Fetch event data
  const event = await getEventById(eventId)

  if (!event) {
    // Return default image for missing events
    return new ImageResponse(
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ color: '#ffffff', fontSize: 48 }}>Event Not Found</div>
      </div>,
      { ...size }
    )
  }

  // Fetch bands for this event
  const bands = await getBandsForEvent(eventId)

  // Try to get event hero photo
  const heroPhotos = await getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, {
    eventId,
  })
  const heroPhoto = heroPhotos.length > 0 ? heroPhotos[0] : null

  // Format date
  const eventDate = new Date(event.date)
  const dateStr = eventDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Status badge
  const statusLabel =
    event.status === 'voting'
      ? 'LIVE NOW'
      : event.status === 'finalized'
        ? 'RESULTS'
        : 'UPCOMING'
  const statusColor = event.status === 'voting' ? '#F5A623' : '#a0a0a0'

  return new ImageResponse(
    <div
      style={{
        background:
          'linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #1a1a1a 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 60,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Background image overlay if hero photo exists */}
      {heroPhoto && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${heroPhoto.blob_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
          }}
        />
      )}

      {/* Content overlay */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top bar: Logo + Status */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              color: '#F5A623',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            BATTLE OF THE TECH BANDS
          </div>
          <div
            style={{
              background: statusColor,
              color: '#0a0a0a',
              padding: '8px 20px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Event name */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {event.name}
        </div>

        {/* Date and location */}
        <div
          style={{
            color: '#a0a0a0',
            fontSize: 28,
            marginBottom: 40,
          }}
        >
          {dateStr} • {event.location}
        </div>

        {/* Bands count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              color: '#666666',
              fontSize: 20,
            }}
          >
            {bands.length} bands competing
          </div>
        </div>
      </div>

      {/* Decorative accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background:
            'linear-gradient(90deg, #F5A623 0%, #FFBE3D 50%, #F5A623 100%)',
        }}
      />
    </div>,
    { ...size }
  )
}
