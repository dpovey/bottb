import { ImageResponse } from 'next/og'
import { sql } from '@vercel/postgres'

// Image metadata
export const runtime = 'edge'
export const alt = 'Battle of the Tech Bands - Band'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Fetch band data directly to avoid importing heavy db.ts in edge runtime
async function getBandData(bandId: string) {
  try {
    const result = await sql`
      SELECT 
        b.id, b.name, b.company_name, b.order,
        e.name as event_name, e.date as event_date, e.status as event_status,
        (SELECT blob_url FROM photos WHERE band_id = b.id AND 'band_hero' = ANY(labels) LIMIT 1) as hero_url
      FROM bands b
      JOIN events e ON b.event_id = e.id
      WHERE b.id = ${bandId}
    `
    return result.rows[0] || null
  } catch {
    return null
  }
}

// Generate dynamic OG image for band pages
export default async function Image({
  params,
}: {
  params: Promise<{ bandId: string }>
}) {
  const { bandId } = await params

  // Fetch band data
  const band = await getBandData(bandId)

  if (!band) {
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
        <div style={{ color: '#ffffff', fontSize: 48 }}>Band Not Found</div>
      </div>,
      { ...size }
    )
  }

  // Format event date
  const eventDate = band.event_date
    ? new Date(band.event_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return new ImageResponse(
    <div
      style={{
        background:
          'linear-gradient(135deg, #0a0a0a 0%, #141414 50%, #1a1a1a 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* Background image if hero exists */}
      {band.hero_url && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${band.hero_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.2,
          }}
        />
      )}

      {/* Left side - Band info */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: 60,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            color: '#F5A623',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.1em',
            marginBottom: 40,
          }}
        >
          BATTLE OF THE TECH BANDS
        </div>

        {/* Band name */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          {band.name}
        </div>

        {/* Company */}
        {band.company_name && (
          <div
            style={{
              color: '#a0a0a0',
              fontSize: 32,
              marginBottom: 40,
            }}
          >
            {band.company_name}
          </div>
        )}

        {/* Event info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              color: '#666666',
              fontSize: 22,
            }}
          >
            {band.event_name}
          </div>
          {eventDate && (
            <div
              style={{
                color: '#666666',
                fontSize: 18,
              }}
            >
              {eventDate}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Band order badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              color: '#666666',
              fontSize: 16,
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            BAND
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: 72,
              fontWeight: 700,
            }}
          >
            #{band.order}
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
