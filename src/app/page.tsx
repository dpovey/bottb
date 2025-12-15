import Link from "next/link";
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
  getPhotosByLabel,
  PHOTO_LABELS,
} from "@/lib/db";
import { PublicLayout } from "@/components/layouts";
import { EventCard } from "@/components/event-card";
import { Hero } from "@/components/hero";
import { Button } from "@/components/ui";
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  type BandScoreData,
} from "@/lib/scoring";

// Default fallback hero image
const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=2874&auto=format&fit=crop";

interface BandScore {
  id: string;
  name: string;
  order: number;
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  avg_visuals?: number;
  avg_crowd_vote: number;
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  crowd_score?: number;
}

interface EventInfo {
  scoring_version?: string;
  winner?: string;
  [key: string]: unknown;
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

  // Fetch global hero photos
  const globalHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.GLOBAL_HERO);
  const heroPhoto = globalHeroPhotos.length > 0 ? globalHeroPhotos[0] : null;
  const heroImageUrl = heroPhoto?.blob_url ?? DEFAULT_HERO_IMAGE;
  const heroFocalPoint = heroPhoto?.hero_focal_point ?? { x: 50, y: 50 };

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
      const bands = await getBandsForEvent(event.id);
      const eventInfo = event.info as EventInfo | null;
      const scoringVersion = parseScoringVersion(eventInfo);
      const showDetailedScoring = hasDetailedBreakdown(scoringVersion);

      // For 2022.1 events, use the stored winner name
      if (!showDetailedScoring) {
        const storedWinner = eventInfo?.winner;
        if (storedWinner) {
          return {
            ...event,
            overallWinner: { name: storedWinner, totalScore: 0 },
            bands,
            scoringVersion,
          };
        }
        return { ...event, overallWinner: null, bands, scoringVersion };
      }

      // For 2025.1 and 2026.1, calculate scores
      const scores = (await getBandScores(event.id)) as BandScore[];
      
      const bandResults = scores
        .map((score) => {
          const scoreData: BandScoreData = {
            avg_song_choice: score.avg_song_choice,
            avg_performance: score.avg_performance,
            avg_crowd_vibe: score.avg_crowd_vibe,
            avg_visuals: score.avg_visuals,
            crowd_vote_count: score.crowd_vote_count,
            total_crowd_votes: score.total_crowd_votes,
            crowd_score: score.crowd_score,
          };

          const totalScore = calculateTotalScore(
            scoreData,
            scoringVersion,
            scores.map((s) => ({
              avg_song_choice: s.avg_song_choice,
              avg_performance: s.avg_performance,
              avg_crowd_vibe: s.avg_crowd_vibe,
              avg_visuals: s.avg_visuals,
              crowd_vote_count: s.crowd_vote_count,
              total_crowd_votes: s.total_crowd_votes,
              crowd_score: s.crowd_score,
            }))
          );

          return { ...score, totalScore };
        })
        .sort((a, b) => b.totalScore - a.totalScore);

      const overallWinner = bandResults.length > 0 ? bandResults[0] : null;
      return { ...event, overallWinner, bands, scoringVersion };
    })
  );

  return (
    <PublicLayout headerVariant="transparent" footerVariant="full">
      {/* Hero Section */}
      <Hero
        title="Battle of the Tech Bands"
        subtitle="Where technology meets rock 'n' roll. A community charity event supporting Youngcare."
        backgroundImage={heroImageUrl}
        focalPoint={heroFocalPoint}
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
