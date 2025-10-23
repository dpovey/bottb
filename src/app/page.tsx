import Link from "next/link";
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
} from "@/lib/db";
import { formatEventDate } from "@/lib/date-utils";
import { WebLayout } from "@/components/layouts";
import { EventCard } from "@/components/event-card";

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

  // Get upcoming events with bands
  const upcomingEventsWithBands = await Promise.all(
    upcomingEvents.map(async (event) => {
      const bands = await getBandsForEvent(event.id);
      return { ...event, bands };
    })
  );

  // Get past events with winners and bands
  const pastEventsWithWinners = await Promise.all(
    pastEvents.map(async (event) => {
      const scores = (await getBandScores(event.id)) as BandScore[];
      const bands = await getBandsForEvent(event.id);
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
      return { ...event, overallWinner, bands };
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
        {upcomingEventsWithBands.length > 0 && (
          <div className="max-w-[calc(100vw-2rem)] mx-auto mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">
              Upcoming Events
            </h2>
            <div className="">
              {upcomingEventsWithBands.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    relativeDate={relativeDate}
                    bands={event.bands}
                    variant="upcoming"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Past Events Section */}
        {pastEventsWithWinners.length > 0 && (
          <div className="max-w-[calc(100vw-2rem)] mx-auto">
            <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">
              Past Events
            </h2>
            <div className="">
              {pastEventsWithWinners.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    relativeDate={relativeDate}
                    variant="past"
                    showWinner={!!event.overallWinner}
                    winner={event.overallWinner || undefined}
                    bands={event.bands}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WebLayout>
  );
}
