import Link from 'next/link'
import { formatEventDate } from '@/lib/date-utils'
import {
  Badge,
  DateBadge,
  Button,
  CompanyBadge,
  CompanyIcon,
  EventCountdownBadge,
  TrackedTicketLink,
} from '@/components/ui'
import { TicketIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { buildHeroSrcSet, type PhotoImageUrls } from '@/lib/photo-srcset'

/**
 * Get object-position for the focal point.
 * For cards (roughly square aspect ratio), we use both X and Y.
 */
function getObjectPosition(focalPoint?: { x: number; y: number }) {
  if (!focalPoint) return undefined
  return `${focalPoint.x}% ${focalPoint.y}%`
}

interface HeroPhoto extends Partial<PhotoImageUrls> {
  blob_url: string
  hero_focal_point?: { x: number; y: number }
}

interface EventCardProps {
  event: {
    id: string
    name: string
    date: string
    location: string
    timezone: string // IANA timezone name (e.g., "Australia/Brisbane")
    info?: {
      image_url?: string
      ticket_url?: string
    }
    status?: string
  }
  relativeDate: string
  showWinner?: boolean
  winner?: {
    name: string
    totalScore?: number
    companySlug?: string
    companyName?: string
    companyIconUrl?: string
  } | null
  bands?: {
    id: string
    name: string
    order: number
    company_slug?: string
    company_name?: string
    company_icon_url?: string
    company_logo_url?: string
  }[]
  variant?: 'upcoming' | 'past' | 'active'
  heroPhoto?: HeroPhoto | null
  /**
   * Card shape.
   * - `'horizontal'` (default): wide row-style card with date / content /
   *   side image — used for the featured "next event" slot.
   * - `'tile'`: square 4:3 tile with image-as-background, ideal for grids
   *   of multiple events.
   */
  layout?: 'horizontal' | 'tile'
}

// Gradient presets for visual variety
const GRADIENT_PRESETS = [
  'from-purple-900/30 via-bg-muted to-amber-900/20',
  'from-cyan-900/20 via-bg-muted to-purple-900/20',
  'from-emerald-900/20 via-bg-muted to-cyan-900/20',
  'from-amber-900/20 via-bg-muted to-purple-900/10',
  'from-rose-900/20 via-bg-muted to-indigo-900/20',
  'from-blue-900/20 via-bg-muted to-emerald-900/20',
]

export function EventCard({
  event,
  relativeDate,
  showWinner = false,
  winner,
  bands = [],
  variant = 'upcoming',
  heroPhoto,
  layout = 'horizontal',
}: EventCardProps) {
  const isPast = variant === 'past'
  const isActive = variant === 'active'

  // Prefer heroPhoto over event.info.image_url
  const imageUrl = heroPhoto?.blob_url ?? event.info?.image_url
  const focalPoint = heroPhoto?.hero_focal_point

  // Get a consistent gradient based on event id
  const gradientIndex =
    event.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    GRADIENT_PRESETS.length
  const gradient = GRADIENT_PRESETS[gradientIndex]

  // Tile layout (square 4:3 with image-as-background — for grid placement)
  if (layout === 'tile') {
    const showTickets = variant === 'upcoming' && !!event.info?.ticket_url

    return (
      <div
        className={cn(
          'group relative rounded-lg overflow-hidden bg-bg-elevated aspect-4/3',
          'border border-white/5 hover:border-accent/30 transition-colors duration-300'
        )}
      >
        {/* Background gradient */}
        <div className={cn('absolute inset-0 bg-linear-to-br', gradient)} />

        {/* Image if available - zooms on hover */}
        {imageUrl && (
          <div className="absolute inset-0 overflow-hidden motion-safe:group-hover:scale-105 transition-transform duration-500 ease-out">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              srcSet={heroPhoto ? buildHeroSrcSet(heroPhoto) : undefined}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              alt={`${event.name} event image`}
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
              style={{ objectPosition: getObjectPosition(focalPoint) }}
              loading="lazy"
            />
          </div>
        )}

        {/* Gradient overlay for content readability - lighter to show more image */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/30 to-transparent" />

        {/* Stretched link covers the card; interactive elements below use z-20 to sit above it */}
        <Link
          href={`/event/${event.id}`}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={`${event.name} details`}
        />

        {/* Date Badge - Top Left */}
        <div className="absolute top-4 left-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          <DateBadge
            date={event.date}
            timezone={event.timezone}
            size="sm"
            showYear
          />
        </div>

        {/* Status/Winner Badge - Top Right */}
        <div className="absolute top-4 right-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
          {isActive ? (
            <span className="bg-accent/20 border border-accent/30 text-accent rounded-sm px-3 py-1 text-xs tracking-wider uppercase">
              🎸 Live Now
            </span>
          ) : showWinner && winner ? (
            <span className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 text-accent rounded-sm px-3 py-1 text-xs">
              <span>🏆 {winner.name}</span>
              {winner.companySlug && winner.companyName && (
                <CompanyBadge
                  slug={winner.companySlug}
                  name={winner.companyName}
                  iconUrl={winner.companyIconUrl}
                  variant="muted"
                  size="sm"
                  asLink={false}
                />
              )}
            </span>
          ) : !isPast ? (
            <EventCountdownBadge date={event.date} timezone={event.timezone} />
          ) : null}
        </div>

        {/* Content - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="font-medium text-xl mb-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {event.name}
          </h3>
          <p className="text-white/80 text-sm mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            {event.location}
          </p>
          {!isPast && bands.length === 0 && (
            <p className="text-white/60 text-sm line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Bands TBA ·{' '}
              <a
                href="mailto:info@bottb.com"
                className="relative z-20 text-accent hover:underline"
              >
                Want to participate?
              </a>
            </p>
          )}
        </div>

        {/* Tickets button - bottom right corner */}
        {showTickets && (
          <TrackedTicketLink
            ticketUrl={event.info!.ticket_url!}
            eventId={event.id}
            eventName={event.name}
            location="event_card_visual"
            className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 bg-accent text-bg px-3 py-1.5 rounded-full font-medium text-xs tracking-wide hover:bg-accent-light transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          >
            <TicketIcon className="w-3.5 h-3.5" />
            Tickets
          </TrackedTicketLink>
        )}
      </div>
    )
  }

  // Horizontal layout — page-width hero card with image-as-background.
  // Same visual pattern as the tile (image fills the card, content overlays
  // with a gradient for readability) but landscape so it can act as the
  // featured "next event" banner. Replaces the prior side-image layout that
  // hid the image entirely on mobile and felt cramped on tablet.
  //
  // Bands are surfaced as deduped company icons rather than name pills —
  // the company logos are the social-proof signal that actually drives
  // recognition ("oh, my employer's in this").
  const uniqueCompanies = bands.reduce<
    Array<{
      slug: string
      name: string
      iconUrl?: string
      logoUrl?: string
    }>
  >((acc, band) => {
    if (!band.company_slug) return acc
    if (acc.some((c) => c.slug === band.company_slug)) return acc
    acc.push({
      slug: band.company_slug,
      name: band.company_name || band.company_slug,
      iconUrl: band.company_icon_url,
      logoUrl: band.company_logo_url,
    })
    return acc
  }, [])

  return (
    <div
      className={cn(
        'group relative rounded-lg overflow-hidden bg-bg-elevated mb-6',
        'border border-white/5 hover:border-accent/30 transition-colors duration-300',
        isActive && 'border-accent/30 shadow-glow'
      )}
    >
      {/* Background gradient — visible if no image, also bleeds at edges */}
      <div className={cn('absolute inset-0 bg-linear-to-br', gradient)} />

      {/* Image as background — zooms on hover, same treatment as tile */}
      {imageUrl && (
        <div className="absolute inset-0 overflow-hidden motion-safe:group-hover:scale-105 transition-transform duration-500 ease-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            srcSet={heroPhoto ? buildHeroSrcSet(heroPhoto) : undefined}
            sizes="100vw"
            alt={`${event.name} event image`}
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity duration-500"
            style={{ objectPosition: getObjectPosition(focalPoint) }}
            loading="lazy"
          />
        </div>
      )}

      {/* Readability overlay — darker from the left where text sits */}
      <div className="absolute inset-0 bg-linear-to-r from-bg via-bg/70 to-bg/20" />
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/30 to-transparent" />

      {/* Content — aspect ratio gives consistent height across viewports */}
      <div className="relative aspect-[16/10] sm:aspect-[16/7] lg:aspect-[21/8] flex flex-col justify-between p-6 md:p-8">
        {/* Top row: date badge + status/countdown badge */}
        <div className="flex items-start justify-between gap-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          <DateBadge
            date={event.date}
            timezone={event.timezone}
            size="sm"
            showYear
          />
          <div>
            {isActive ? (
              <Badge variant="accent">Live Now</Badge>
            ) : isPast ? (
              <Badge variant="default">{relativeDate}</Badge>
            ) : (
              <EventCountdownBadge
                date={event.date}
                timezone={event.timezone}
                fallback={<Badge variant="info">{relativeDate}</Badge>}
              />
            )}
          </div>
        </div>

        {/* Bottom: title, date/location, companies, actions */}
        <div className="space-y-3">
          <div className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            <h3 className="text-2xl md:text-3xl font-semibold text-white mb-1">
              {event.name}
            </h3>
            <p className="text-white/80 text-sm md:text-base">
              {formatEventDate(event.date, event.timezone)} • {event.location}
            </p>
          </div>

          {/* Winner inline (past events) */}
          {showWinner && winner && (
            <div className="inline-flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-md px-3 py-1.5 text-warning text-sm">
              <span>
                🏆{' '}
                <span className="text-white font-semibold">{winner.name}</span>
              </span>
              {winner.companySlug && winner.companyName && (
                <CompanyBadge
                  slug={winner.companySlug}
                  name={winner.companyName}
                  iconUrl={winner.companyIconUrl}
                  variant="muted"
                  size="sm"
                  asLink={false}
                />
              )}
            </div>
          )}

          {/* Company icons — deduped, with a +N overflow tile */}
          {uniqueCompanies.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {uniqueCompanies.slice(0, 6).map((c) => (
                <CompanyIcon
                  key={c.slug}
                  iconUrl={c.iconUrl}
                  logoUrl={c.logoUrl}
                  companyName={c.name}
                  size="md"
                  className="bg-white/5 border border-white/10 p-1 rounded-md"
                />
              ))}
              {uniqueCompanies.length > 6 && (
                <span className="bg-white/5 border border-white/10 text-text-dim text-xs px-2 py-1 rounded-md">
                  +{uniqueCompanies.length - 6} more
                </span>
              )}
            </div>
          ) : (
            !isPast &&
            bands.length === 0 && (
              <p className="text-text-muted text-sm">
                Bands TBA ·{' '}
                <a
                  href="mailto:info@bottb.com"
                  className="relative z-20 text-accent hover:underline"
                >
                  Want to participate?
                </a>
              </p>
            )
          )}

          {/* Action buttons — sit above the stretched link via z-20 */}
          <div className="flex flex-wrap gap-3 pt-1 relative z-20">
            <Link href={`/event/${event.id}`}>
              <Button variant="outline-solid" size="sm">
                {isPast ? 'Event' : 'Details'}
              </Button>
            </Link>

            {!isPast && !isActive && event.info?.ticket_url && (
              <TrackedTicketLink
                ticketUrl={event.info.ticket_url}
                eventId={event.id}
                eventName={event.name}
                location="event_card"
                className="inline-flex items-center gap-1.5 bg-accent text-bg px-4 py-1.5 rounded-full font-medium text-sm tracking-wide hover:bg-accent-light transition-colors"
              >
                <TicketIcon className="w-4 h-4" />
                Tickets
              </TrackedTicketLink>
            )}

            {isActive && (
              <Link href={`/vote/crowd/${event.id}`}>
                <Button variant="accent" size="sm">
                  Vote Now
                </Button>
              </Link>
            )}

            {isPast && event.status === 'finalized' && (
              <Link href={`/results/${event.id}`}>
                <Button variant="outline-solid" size="sm">
                  Results
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
