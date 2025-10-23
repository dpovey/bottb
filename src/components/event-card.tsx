import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";

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
  variant?: "upcoming" | "past";
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

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden hover:bg-white/20 transition-colors max-w-4xl mx-auto p-6">
      <div className="flex flex-row gap-6 items-start">
        <div className="flex flex-col gap-6 md:flex-row min-h-64">
          {/* Content */}
          <div className="min-w-80 flex-shrink-0 flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-3">{event.name}</h3>
            <div className="text-gray-300 mb-2">
              {formatEventDate(event.date)}
            </div>
            <div className="text-gray-400 mb-4">{event.location}</div>
            <div
              className={`font-semibold mb-4 ${
                isPast ? "text-gray-500 text-sm" : "text-blue-400"
              }`}
            >
              {relativeDate}
            </div>

            {/* Winner section for past events */}
            {showWinner && winner && (
              <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-400 rounded-lg">
                <div className="text-yellow-400 font-semibold text-sm">
                  <span>🏆 Winner:</span>{" "}
                  <span className="text-white font-bold">{winner.name}</span>
                </div>
              </div>
            )}

            {/* Bands list */}
            {bands.length > 0 && (
              <div className="mb-4">
                <div className="text-gray-300 text-sm mb-2">
                  {bands.length === 1 ? "Band:" : "Bands:"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {bands.slice(0, 3).map((band) => (
                    <span
                      key={band.id}
                      className="bg-white/10 text-white text-xs px-2 py-1 rounded"
                    >
                      {band.name}
                    </span>
                  ))}
                  {bands.length > 3 && (
                    <span className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded">
                      +{bands.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <Link
                href={`/event/${event.id}`}
                className={`font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors ${
                  isPast
                    ? "bg-slate-600 hover:bg-slate-700 text-white"
                    : "bg-slate-600 hover:bg-slate-700 text-white"
                }`}
              >
                {isPast ? "📅 View Event" : "View Details"}
              </Link>
              {isPast && event.status === "finalized" && (
                <Link
                  href={`/results/${event.id}`}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors"
                >
                  📊 View Results
                </Link>
              )}
            </div>
          </div>
          {/* Event Image - Desktop only */}
          {event.info?.image_url && (
            <div className="hidden md:block relative flex-1 min-w-0 self-start align-top">
              <Image
                src={event.info.image_url}
                alt={`${event.name} event image`}
                width={0}
                height={0}
                sizes="100vw"
                className="object-scale-down object-top rounded-r-xl w-full h-full"
                unoptimized
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
