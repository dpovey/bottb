import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";
import { Card, Badge, DateBadge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: {
    id: string;
    name: string;
    date: string;
    location: string;
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
}

export function EventCard({
  event,
  relativeDate,
  showWinner = false,
  winner,
  bands = [],
  variant = "upcoming",
}: EventCardProps) {
  const isPast = variant === "past";
  const isActive = variant === "active";

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
          <DateBadge date={event.date} size="lg" showYear />
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
                  {formatEventDate(event.date)} • {event.location}
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
        {event.info?.image_url && (
          <div className="hidden lg:block relative w-64 min-h-[200px]">
            <Image
              src={event.info.image_url}
              alt={`${event.name} event image`}
              fill
              className="object-cover"
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
