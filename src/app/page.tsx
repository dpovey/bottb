import Link from "next/link";
import {
  getActiveEvent,
  getBandsForEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
} from "@/lib/db";
import { formatEventDate } from "@/lib/date-utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  is_active: boolean;
  status: "upcoming" | "voting" | "finalized";
  created_at: string;
}

interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  order: number;
  created_at: string;
}

interface BandScore {
  id: string;
  name: string;
  order: number;
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  avg_crowd_vote: number;
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  judgeScore?: number;
  crowdScore?: number;
  totalScore?: number;
}

interface ScoreData {
  avg_song_choice: number | null;
  avg_performance: number | null;
  avg_crowd_vibe: number | null;
  avg_crowd_vote: number | null;
  [key: string]: unknown;
}

// Force dynamic rendering - don't pre-render at build time
export const dynamic = "force-dynamic";

function getRelativeDate(dateString: string): string {
  const eventDate = new Date(dateString);
  const now = new Date();
  const diffTime = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Past event";
  } else if (diffDays === 0) {
    return "Today!";
  } else if (diffDays === 1) {
    return "Tomorrow!";
  } else if (diffDays <= 7) {
    return `In ${diffDays} days`;
  } else if (diffDays <= 14) {
    return "In 2 weeks";
  } else if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return `In ${weeks} week${weeks > 1 ? "s" : ""}`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `In ${months} month${months > 1 ? "s" : ""}`;
  }
}

export default async function HomePage() {
  const activeEvent = await getActiveEvent();
  const upcomingEvents = await getUpcomingEvents();
  const pastEvents = await getPastEvents();
  const bands = activeEvent ? await getBandsForEvent(activeEvent.id) : [];

  // Get overall winners for past events (only if finalized)
  const pastEventsWithWinners = await Promise.all(
    pastEvents
      .filter((event) => event.status === "finalized")
      .map(async (event) => {
        const scores = await getBandScores(event.id);
        const bandResults: BandScore[] = scores
          .map((score) => {
            const judgeScore =
              Number(score.avg_song_choice || 0) +
              Number(score.avg_performance || 0) +
              Number(score.avg_crowd_vibe || 0);
            const crowdScore = Number(score.avg_crowd_vote || 0);
            const totalScore = judgeScore + crowdScore;

            return {
              ...score,
              judgeScore,
              crowdScore,
              totalScore,
            } as BandScore;
          })
          .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

        const overallWinner: BandScore | null =
          bandResults.length > 0 ? bandResults[0] : null;
        return { ...event, overallWinner };
      })
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            Battle of the Tech Bands
          </h1>
          <p className="text-xl text-gray-300">Where technology meets music</p>
        </div>

        {/* Upcoming Events Section */}
        {upcomingEvents.length > 0 ? (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Upcoming Events
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {upcomingEvents.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                const isActive = activeEvent?.id === event.id;
                const eventBands = isActive ? bands : [];

                return (
                  <div
                    key={event.id}
                    className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 ${
                      isActive ? "ring-2 ring-green-400" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-white">
                        {event.name}
                      </h3>
                      {isActive && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="text-gray-300 space-y-2 mb-4">
                      <p>
                        <strong>Date:</strong> {formatEventDate(event.date)}
                      </p>
                      <p>
                        <strong>Location:</strong> {event.location}
                      </p>
                      <p
                        className={`font-semibold ${
                          relativeDate.includes("Today") ||
                          relativeDate.includes("Tomorrow")
                            ? "text-yellow-400"
                            : "text-blue-400"
                        }`}
                      >
                        {relativeDate}
                      </p>
                    </div>

                    {isActive && eventBands.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-300 mb-2">
                          <strong>{eventBands.length} bands competing:</strong>
                        </p>
                        <div className="text-sm text-gray-400">
                          {eventBands
                            .slice(0, 3)
                            .map((band) => band.name)
                            .join(", ")}
                          {eventBands.length > 3 &&
                            ` +${eventBands.length - 3} more`}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/event/${event.id}`}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors"
                      >
                        📅 View Event
                      </Link>
                      {event.status === "voting" && (
                        <Link
                          href={`/vote/crowd/${event.id}`}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors"
                        >
                          🎵 Vote Now
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeEvent ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">
                {activeEvent.name}
              </h2>
              <div className="text-gray-300 space-y-2">
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(activeEvent.date).toLocaleDateString()}
                </p>
                <p>
                  <strong>Location:</strong> {activeEvent.location}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                No Upcoming Events
              </h2>
              <p className="text-gray-300 text-lg">
                Check back later for the next Battle of the Tech Bands event!
              </p>
            </div>
          </div>
        )}

        {/* Past Events Section */}
        {pastEventsWithWinners.length > 0 && (
          <div className="max-w-6xl mx-auto mt-16">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Past Events
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEventsWithWinners.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                const isActive = activeEvent?.id === event.id;

                return (
                  <div
                    key={event.id}
                    className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-white">
                        {event.name}
                      </h3>
                      {isActive && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="text-gray-400 space-y-2 mb-4">
                      <p>
                        <strong>Date:</strong> {formatEventDate(event.date)}
                      </p>
                      <p>
                        <strong>Location:</strong> {event.location}
                      </p>
                      {event.overallWinner && (
                        <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-3 mt-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">🏆</span>
                            <span className="text-yellow-300 font-semibold text-sm">
                              Winner
                            </span>
                          </div>
                          <p className="text-white font-bold text-lg">
                            {event.overallWinner.name}
                          </p>
                          <p className="text-yellow-200 text-sm">
                            {(event.overallWinner.totalScore || 0).toFixed(1)}{" "}
                            points
                          </p>
                        </div>
                      )}
                      <p className="text-gray-500 text-sm">{relativeDate}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/event/${event.id}`}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors"
                      >
                        📅 View Event
                      </Link>
                      {event.status === "finalized" && (
                        <Link
                          href={`/results/${event.id}`}
                          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors"
                        >
                          📊 View Results
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
