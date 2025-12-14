import Link from "next/link";
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
} from "@/lib/db";
import { PublicLayout } from "@/components/layouts";
import { EventCard } from "@/components/event-card";
import { Hero } from "@/components/hero";
import { Button } from "@/components/ui";

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
    <PublicLayout headerVariant="transparent" footerVariant="full">
      {/* Hero Section */}
      <Hero
        title="Battle of the Tech Bands"
        subtitle="Where technology meets rock 'n' roll. A community charity event supporting Youngcare."
        backgroundImage="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=2874&auto=format&fit=crop"
        size="lg"
        overlay="heavy"
        actions={[
          ...(activeEvent
            ? [
                { label: "Vote Now", href: `/vote/crowd/${activeEvent.id}`, variant: "accent" as const },
                { label: "View Event", href: `/event/${activeEvent.id}`, variant: "outline" as const },
              ]
            : []),
          { label: "View Photos", href: "/photos", variant: "outline" as const },
        ]}
      />

      {/* Active Event Section */}
      {activeEvent && (
        <section className="py-16 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-sm tracking-widest uppercase text-accent mb-3">
                Happening Now
              </h2>
              <p className="text-text-muted text-lg">
                Cast your vote and support your favorite band
              </p>
            </div>
            
            <EventCard
              event={activeEvent}
              relativeDate="Live Now"
              bands={[]} // Could fetch bands here if needed
              variant="active"
            />
          </div>
        </section>
      )}

      {/* Upcoming Events Section */}
      {upcomingEventsWithBands.length > 0 && (
        <section className="py-16 bg-bg-muted">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-sm tracking-widest uppercase text-text-muted mb-3">
                Upcoming Events
              </h2>
              <p className="text-2xl font-semibold text-white">
                Mark Your Calendar
              </p>
            </div>

            <div className="space-y-6">
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
        </section>
      )}

      {/* Past Events Section */}
      {pastEventsWithWinners.length > 0 && (
        <section className="py-16 bg-bg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-sm tracking-widest uppercase text-text-muted mb-3">
                Past Events
              </h2>
              <p className="text-2xl font-semibold text-white">
                Hall of Champions
              </p>
            </div>

            <div className="space-y-6">
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
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-bg-muted border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">
            Join the Movement
          </h2>
          <p className="text-text-muted mb-8">
            Battle of the Tech Bands brings together technology professionals for
            an unforgettable night of rock, competition, and charity.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/about">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
            <Link href="/photos">
              <Button variant="ghost" size="lg">
                View Gallery
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
