import Link from "next/link";
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
} from "@/lib/db";
import { formatEventDate } from "@/lib/date-utils";
import { WebLayout } from "@/components/layouts";

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

// Force dynamic rendering - don't pre-render at build time
export const dynamic = "force-dynamic";

function getRelativeDate(dateString: string): string {
  const now = new Date();
  const eventDate = new Date(dateString);
  const diffTime = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays > 1) {
    return `In ${diffDays} days`;
  } else if (diffDays === -1) {
    return "Yesterday";
  } else {
    return `${Math.abs(diffDays)} days ago`;
  }
}

export default async function HomePage() {
  const activeEvent = await getActiveEvent();
  const upcomingEvents = await getUpcomingEvents();
  const pastEvents = await getPastEvents();

  // Get past events with winners
  const pastEventsWithWinners = await Promise.all(
    pastEvents.map(async (event) => {
      const scores = (await getBandScores(event.id)) as BandScore[];
      const bandResults = scores
        .map((score) => {
          const judgeScore =
            Number(score?.avg_song_choice || 0) +
            Number(score?.avg_performance || 0) +
            Number(score?.avg_crowd_vibe || 0);
          const crowdScore =
            score.total_crowd_votes > 0
              ? (Number(score.crowd_vote_count || 0) /
                  Number(score.total_crowd_votes || 1)) *
                20
              : 0;
          const totalScore = judgeScore + crowdScore;
          return { ...score, judgeScore, crowdScore, totalScore };
        })
        .sort((a, b) => b.totalScore - a.totalScore);

      const overallWinner = bandResults.length > 0 ? bandResults[0] : null;
      return { ...event, overallWinner };
    })
  );

  return (
    <WebLayout>
      <div className="container mx-auto px-4 py-8">
        {/* TODO: Hero */}

        {/* Active Event Section */}
        {activeEvent && (
          <div className="max-w-6xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-neutral-900 via-amber-900 to-black rounded-2xl p-8 text-center">
              <h3 className="text-4xl font-bold text-white mb-4">
                {activeEvent.name}
              </h3>
              <div className="text-2xl text-blue-100 mb-4">
                {formatEventDate(activeEvent.date)} • {activeEvent.location}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/event/${activeEvent.id}`}
                  className="bg-white text-blue-600 font-bold py-3 px-8 rounded-xl text-lg hover:bg-blue-50 transition-colors"
                >
                  View Event
                </Link>
                <Link
                  href={`/vote/crowd/${activeEvent.id}`}
                  className="bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-lg hover:bg-blue-800 transition-colors"
                >
                  Vote Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events Section */}
        {upcomingEvents.length > 0 && (
          <div className="max-w-6xl mx-auto mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">
              Upcoming Events
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                return (
                  <div
                    key={event.id}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-colors"
                  >
                    <h3 className="text-2xl font-bold text-white mb-3">
                      {event.name}
                    </h3>
                    <div className="text-gray-300 mb-2">
                      {formatEventDate(event.date)}
                    </div>
                    <div className="text-gray-400 mb-4">{event.location}</div>
                    <div className="text-blue-400 font-semibold mb-4">
                      {relativeDate}
                    </div>
                    <Link
                      href={`/event/${event.id}`}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg text-center text-sm transition-colors block"
                    >
                      View Details
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past Events Section */}
        {pastEventsWithWinners.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">
              Past Events
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEventsWithWinners.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                return (
                  <div
                    key={event.id}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-colors"
                  >
                    <h3 className="text-2xl font-bold text-white mb-3">
                      {event.name}
                    </h3>
                    <div className="text-gray-300 mb-2">
                      {formatEventDate(event.date)}
                    </div>
                    <div className="text-gray-400 mb-4">{event.location}</div>
                    <div className="text-gray-500 text-sm mb-4">
                      {relativeDate}
                    </div>

                    {event.overallWinner && (
                      <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-400 rounded-lg">
                        <div className="text-yellow-400 font-semibold text-sm mb-1">
                          🏆 Winner
                        </div>
                        <div className="text-white font-bold">
                          {event.overallWinner.name}
                        </div>
                        <div className="text-yellow-300 text-sm">
                          Score: {event.overallWinner.totalScore?.toFixed(1)}
                          /100
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
    </WebLayout>
  );
}
