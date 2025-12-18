import { Suspense } from "react";
import Link from "next/link";
import {
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandScores,
  getBandsForEvent,
  getPhotosByLabel,
  hasFinalizedResults,
  getFinalizedResults,
  getPhotos,
  getPhotoCount,
  getVideos,
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
import { PhotoStrip } from "@/components/photos/photo-strip";
import { VideoStrip } from "@/components/videos/video-strip";
import { CompanyLogoMarquee } from "@/components/company-logo-marquee";
import {
  EventCardSkeleton,
  PhotoStripSkeleton,
  VideoStripSkeleton,
  CompanyLogoMarqueeSkeleton,
} from "@/components/skeletons/home-skeletons";

// Default fallback hero image
const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=2874&auto=format&fit=crop";

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

// Use ISR with 5-minute revalidation for performance
// Events are activated/finalized manually, so 5 minutes is sufficient
export const revalidate = 300;

function getRelativeDate(dateString: string): string {
  const now = new Date();
  const eventDate = new Date(dateString);
  const diffTime = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(diffDays);

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays > 1) {
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? "In 1 year" : `In ${years} years`;
    } else if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? "In 1 month" : `In ${months} months`;
    }
    return `In ${diffDays} days`;
  } else if (diffDays === -1) {
    return "Yesterday";
  } else {
    // Past dates
    if (absDays >= 365) {
      const years = Math.floor(absDays / 365);
      return years === 1 ? "1 year ago" : `${years} years ago`;
    } else if (absDays >= 30) {
      const months = Math.floor(absDays / 30);
      return months === 1 ? "1 month ago" : `${months} months ago`;
    }
    return `${absDays} days ago`;
  }
}

export default async function HomePage() {
  // Parallelize all initial queries including photos and videos for strips
  const [
    activeEvent,
    upcomingEvents,
    pastEvents,
    globalHeroPhotos,
    initialPhotosData,
    initialVideosData,
    initialPhotoCount,
  ] = await Promise.all([
    getActiveEvent(),
    getUpcomingEvents(),
    getPastEvents(),
    getPhotosByLabel(PHOTO_LABELS.GLOBAL_HERO),
    // Fetch initial photos for PhotoStrip (random order, 50 photos)
    getPhotos({ limit: 50, orderBy: "random" }),
    // Fetch initial videos for VideoStrip (20 videos)
    getVideos({ limit: 20 }),
    // Get photo count for pagination
    getPhotoCount({}),
  ]);

  // Extract hero photo data
  const heroPhoto = globalHeroPhotos.length > 0 ? globalHeroPhotos[0] : null;
  const heroImageUrl = heroPhoto?.blob_url ?? DEFAULT_HERO_IMAGE;
  const heroFocalPoint = heroPhoto?.hero_focal_point ?? { x: 50, y: 50 };

  const initialPhotos = initialPhotosData;
  const initialVideos = initialVideosData;

  // Get upcoming events with bands and hero photos
  const upcomingEventsWithBands = await Promise.all(
    upcomingEvents.map(async (event) => {
      const [bands, heroPhotos] = await Promise.all([
        getBandsForEvent(event.id),
        getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId: event.id }),
      ]);
      const heroPhoto = heroPhotos.length > 0 ? heroPhotos[0] : null;
      return { ...event, bands, heroPhoto };
    })
  );

  // Get past events with winners, bands, and hero photos
  const pastEventsWithWinners = await Promise.all(
    pastEvents.map(async (event) => {
      const [bands, heroPhotos] = await Promise.all([
        getBandsForEvent(event.id),
        getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, { eventId: event.id }),
      ]);
      const heroPhoto = heroPhotos.length > 0 ? heroPhotos[0] : null;
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
            heroPhoto,
          };
        }
        return {
          ...event,
          overallWinner: null,
          bands,
          scoringVersion,
          heroPhoto,
        };
      }

      // For 2025.1 and 2026.1, check if event is finalized and use finalized results
      const isFinalized = event.status === "finalized";
      if (isFinalized && (await hasFinalizedResults(event.id))) {
        // Use finalized results from table (already sorted by final_rank)
        const finalizedResults = await getFinalizedResults(event.id);
        const overallWinner =
          finalizedResults.length > 0
            ? {
                name: finalizedResults[0].band_name,
                totalScore: Number(finalizedResults[0].total_score || 0),
              }
            : null;
        return { ...event, overallWinner, bands, scoringVersion, heroPhoto };
      }

      // Only calculate scores for non-finalized past events
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
      return { ...event, overallWinner, bands, scoringVersion, heroPhoto };
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
                {
                  label: "Vote Now",
                  href: `/vote/crowd/${activeEvent.id}`,
                  variant: "accent" as const,
                },
                {
                  label: "View Event",
                  href: `/event/${activeEvent.id}`,
                  variant: "outline" as const,
                },
              ]
            : []),
          {
            label: "View Photos",
            href: "/photos",
            variant: "outline" as const,
          },
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
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-semibold text-3xl sm:text-4xl">
                Upcoming Events
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEventsWithBands.map((event) => {
                const relativeDate = getRelativeDate(event.date);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    relativeDate={relativeDate}
                    bands={event.bands}
                    variant="upcoming"
                    heroPhoto={event.heroPhoto}
                    visual
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Past Events Section - Wrapped in Suspense for error boundaries */}
      <Suspense
        fallback={
          <section className="py-16 bg-bg-elevated">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between mb-10">
                <h2 className="font-semibold text-3xl sm:text-4xl">
                  Past Events
                </h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </section>
        }
      >
        {pastEventsWithWinners.length > 0 && (
          <section className="py-16 bg-bg-elevated">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between mb-10">
                <h2 className="font-semibold text-3xl sm:text-4xl">
                  Past Events
                </h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      heroPhoto={event.heroPhoto}
                      visual
                    />
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </Suspense>

      {/* Random Photo Strip - Wrapped in Suspense */}
      <Suspense
        fallback={
          <section className="py-16 bg-bg-elevated">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-semibold text-3xl">From the Archives</h2>
              </div>
              <PhotoStripSkeleton />
            </div>
          </section>
        }
      >
        <PhotoStrip
          title="From the Archives"
          viewAllLink="/photos"
          initialPhotos={initialPhotos}
          initialTotalCount={initialPhotoCount}
        />
      </Suspense>

      {/* Video Strip - Wrapped in Suspense */}
      <Suspense
        fallback={
          <section className="py-16 bg-bg">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <VideoStripSkeleton />
            </div>
          </section>
        }
      >
        <VideoStrip
          title="Standout Performances"
          initialVideos={initialVideos}
          location="home_page"
        />
      </Suspense>

      {/* Company Logo Marquee - Wrapped in Suspense */}
      <Suspense
        fallback={
          <section className="py-16 bg-bg border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-10">
                <h2 className="text-sm tracking-widest uppercase text-accent mb-2">
                  Companies Who&apos;ve Competed
                </h2>
              </div>
              <CompanyLogoMarqueeSkeleton />
            </div>
          </section>
        }
      >
        <CompanyLogoMarquee />
      </Suspense>

      {/* CTA Section */}
      <section className="py-20 bg-bg-muted border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">
            Join the Movement
          </h2>
          <p className="text-text-muted mb-8">
            Battle of the Tech Bands brings together technology professionals
            for an unforgettable night of rock, competition, and charity.
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
