import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";
import { Card, Badge, DateBadge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface HeroPhoto {
  blob_url: string;
  hero_focal_point?: { x: number; y: number };
}

interface EventCardProps {
  event: {
    id: string;
    name: string;
    date: string;
    location: string;
    timezone: string; // IANA timezone name (e.g., "Australia/Brisbane")
    info?: {
      image_url?: string;
    };
    status?: string;
  };
  relativeDate: string;
  showWinner?: boolean;
  winner?: {
    name: string;
    totalScore?: number;
  } | null;
  bands?: {
    id: string;
    name: string;
    order: number;
  }[];
  variant?: "upcoming" | "past" | "active";
  heroPhoto?: HeroPhoto | null;
  /** Use visual card style (4:3 aspect ratio with gradient background) */
  visual?: boolean;
}

// Gradient presets for visual variety
const GRADIENT_PRESETS = [
  "from-purple-900/30 via-bg-muted to-amber-900/20",
  "from-cyan-900/20 via-bg-muted to-purple-900/20",
  "from-emerald-900/20 via-bg-muted to-cyan-900/20",
  "from-amber-900/20 via-bg-muted to-purple-900/10",
  "from-rose-900/20 via-bg-muted to-indigo-900/20",
  "from-blue-900/20 via-bg-muted to-emerald-900/20",
];

export function EventCard({
  event,
  relativeDate,
  showWinner = false,
  winner,
  bands = [],
  variant = "upcoming",
  heroPhoto,
  visual = false,
}: EventCardProps) {
  const isPast = variant === "past";
  const isActive = variant === "active";
  
  // Prefer heroPhoto over event.info.image_url
  const imageUrl = heroPhoto?.blob_url ?? event.info?.image_url;
  const focalPoint = heroPhoto?.hero_focal_point;

  // Get a consistent gradient based on event id
  const gradientIndex = event.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % GRADIENT_PRESETS.length;
  const gradient = GRADIENT_PRESETS[gradientIndex];

  // Visual card style (matches design mockups)
  if (visual) {
    return (
      <Link href={`/event/${event.id}`}>
        <div 
          className={cn(
            "group relative rounded-lg overflow-hidden bg-bg-elevated aspect-[4/3] cursor-pointer",
            "border border-white/5 hover:border-accent/30 transition-colors duration-300"
          )}
        >
          {/* Background gradient */}
          <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
          
          {/* Image if available - zooms on hover */}
          {imageUrl && (
            <div className="absolute inset-0 overflow-hidden">
              <Image
                src={imageUrl}
                alt={`${event.name} event image`}
                fill
                className="object-cover opacity-80 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:opacity-100"
                style={focalPoint ? { objectPosition: `${focalPoint.x}% ${focalPoint.y}%` } : undefined}
                unoptimized
              />
            </div>
          )}
          
          {/* Gradient overlay for content readability - lighter to show more image */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          
          {/* Date Badge - Top Left */}
          <div className="absolute top-4 left-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            <DateBadge date={event.date} timezone={event.timezone} size="sm" showYear />
          </div>
          
          {/* Status/Winner Badge - Top Right */}
          <div className="absolute top-4 right-4">
            {isActive ? (
              <span className="bg-accent/20 border border-accent/30 text-accent rounded px-3 py-1 text-xs tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                🎸 Live Now
              </span>
            ) : showWinner && winner ? (
              <span className="bg-accent/20 border border-accent/30 text-accent rounded px-3 py-1 text-xs tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                🏆 {winner.name}
              </span>
            ) : null}
          </div>
          
          {/* Content - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="font-medium text-xl mb-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{event.name}</h3>
            <p className="text-white/80 text-sm mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{event.location}</p>
            {!isPast && bands.length === 0 && (
              <p className="text-white/60 text-sm line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {formatEventDate(event.date, event.timezone)}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Original horizontal card style
  return (
    <Card
      variant="interactive"
      padding="none"
      className={cn(
        "max-w-4xl mx-auto mb-6 overflow-hidden",
        isActive && "border-accent/30 shadow-glow"
      )}
    >
      <div className="flex flex-col md:flex-row">
        {/* Date Badge Column */}
        <div className="hidden md:flex items-start p-6 border-r border-white/5">
          <DateBadge date={event.date} timezone={event.timezone} size="lg" showYear />
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  {event.name}
                </h3>
                <div className="text-text-muted text-sm">
                  {formatEventDate(event.date, event.timezone)} • {event.location}
                </div>
              </div>
              
              {/* Status Badge */}
              {isActive ? (
                <Badge variant="accent">Live Now</Badge>
              ) : isPast ? (
                <Badge variant="default">{relativeDate}</Badge>
              ) : (
                <Badge variant="info">{relativeDate}</Badge>
              )}
            </div>

            {/* Winner section for past events */}
            {showWinner && winner && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="text-warning text-sm">
                  <span className="font-medium">Winner:</span>{" "}
                  <span className="text-white font-semibold">{winner.name}</span>
                </div>
              </div>
            )}

            {/* Bands list */}
            {bands.length > 0 && (
              <div className="mb-4">
                <div className="text-text-dim text-xs tracking-wider uppercase mb-2">
                  {bands.length === 1 ? "Band" : "Bands"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {bands.slice(0, 3).map((band) => (
                    <span
                      key={band.id}
                      className="bg-white/5 border border-white/10 text-text-muted text-xs px-2 py-1 rounded"
                    >
                      {band.name}
                    </span>
                  ))}
                  {bands.length > 3 && (
                    <span className="bg-white/5 border border-white/10 text-text-dim text-xs px-2 py-1 rounded">
                      +{bands.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-auto pt-4">
              <Link href={`/event/${event.id}`}>
                <Button variant="outline" size="sm">
                  {isPast ? "View Event" : "View Details"}
                </Button>
              </Link>
              
              {isActive && (
                <Link href={`/vote/crowd/${event.id}`}>
                  <Button variant="accent" size="sm">
                    Vote Now
                  </Button>
                </Link>
              )}
              
              {isPast && event.status === "finalized" && (
                <Link href={`/results/${event.id}`}>
                  <Button variant="outline" size="sm">
                    View Results
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Event Image - Desktop only */}
        {imageUrl && (
          <div className="hidden lg:block relative w-64 min-h-[200px]">
            <Image
              src={imageUrl}
              alt={`${event.name} event image`}
              fill
              className="object-cover"
              style={focalPoint ? { objectPosition: `${focalPoint.x}% ${focalPoint.y}%` } : undefined}
              unoptimized
            />
            {/* Gradient overlay to blend with card */}
            <div className="absolute inset-0 bg-gradient-to-r from-bg-elevated to-transparent" />
          </div>
        )}
      </div>
    </Card>
  );
}
