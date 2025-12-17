"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";
import { WebLayout } from "@/components/layouts";
import { Button, Badge, Card, DateBadge, BandThumbnail, CompanyBadge, NumberedIndicator } from "@/components/ui";
import { PhotoStrip } from "@/components/photos/photo-strip";
import { VideoCarousel } from "@/components/video-carousel";
import { Video } from "@/lib/db";
import {
  parseScoringVersion,
  hasDetailedBreakdown,
} from "@/lib/scoring";

interface EventInfo {
  image_url?: string;
  description?: string;
  website?: string;
  social_media?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
  };
  venue_info?: string;
  scoring_version?: string;
  winner?: string;
  [key: string]: unknown;
}

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  timezone: string; // IANA timezone name (e.g., "Australia/Brisbane")
  status: string;
  image_url?: string;
  info?: EventInfo;
}

interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  company_slug?: string;
  company_name?: string;
  company_icon_url?: string;
  order: number;
  hero_thumbnail_url?: string;
  info?: {
    logo_url?: string;
    website?: string;
    social_media?: {
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    genre?: string;
    members?: string[];
    [key: string]: unknown;
  };
  created_at: string;
}

interface HeroPhoto {
  id: string;
  blob_url: string;
  hero_focal_point?: { x: number; y: number };
}

function getStatusBadge(status: string, hasWinner: boolean) {
  switch (status) {
    case "voting":
      return <Badge variant="success">Voting Open</Badge>;
    case "finalized":
      return hasWinner ? (
        <Badge variant="warning">Completed</Badge>
      ) : (
        <Badge variant="accent">Results Available</Badge>
      );
    case "upcoming":
      return <Badge variant="info">Upcoming</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function EventPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [heroPhoto, setHeroPhoto] = useState<HeroPhoto | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventResponse, bandsResponse, heroResponse, videosResponse] = await Promise.all([
          fetch(`/api/events/${eventId}`),
          fetch(`/api/bands/${eventId}`),
          fetch(`/api/photos/heroes?label=event_hero&eventId=${eventId}`),
          fetch(`/api/videos?event=${eventId}`),
        ]);

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          setEvent(eventData);
        }

        if (bandsResponse.ok) {
          const bandsData = await bandsResponse.json();
          setBands(bandsData);
        }

        if (heroResponse.ok) {
          const heroData = await heroResponse.json();
          if (heroData.photos && heroData.photos.length > 0) {
            setHeroPhoto(heroData.photos[0]);
          }
        }

        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          setVideos(videosData.videos || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  if (isLoading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-text-muted text-xl">Loading...</div>
        </div>
      </WebLayout>
    );
  }

  if (!event) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-text-muted text-xl">Event not found</div>
        </div>
      </WebLayout>
    );
  }

  const breadcrumbs = [
    { label: "Events", href: "/events" },
    { label: event.name },
  ];

  // Get scoring version and winner info
  const scoringVersion = parseScoringVersion(event.info);
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion);
  const storedWinner = event.info?.winner;
  const isFinalized = event.status === "finalized";

  // For 2022.1 events, we show the stored winner prominently
  const show2022Winner = isFinalized && !showDetailedBreakdown && storedWinner;

  return (
    <WebLayout breadcrumbs={breadcrumbs}>
      {/* Hero Section with Event Image */}
      <section className="relative min-h-[40vh] flex items-end">
        {/* Background Image - prefer hero photo, fall back to event image_url */}
        {heroPhoto ? (
          <Image
            src={heroPhoto.blob_url}
            alt={`${event.name} event`}
            fill
            className="object-cover"
            style={{ 
              objectPosition: `${heroPhoto.hero_focal_point?.x ?? 50}% ${heroPhoto.hero_focal_point?.y ?? 50}%` 
            }}
            priority
            unoptimized
          />
        ) : event.info?.image_url ? (
          <Image
            src={event.info.image_url}
            alt={`${event.name} event`}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bg-surface to-bg" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Date Badge */}
            <DateBadge date={event.date} timezone={event.timezone} size="lg" showYear />

            {/* Event Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(event.status, !!show2022Winner)}
              </div>
              <h1 className="text-4xl lg:text-5xl font-semibold text-white mb-2">
                {event.name}
              </h1>
              <div className="text-text-muted text-lg">
                {formatEventDate(event.date, event.timezone)} • {event.location}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Winner Section - For 2022.1 finalized events */}
      {show2022Winner && (
        <section className="py-8 bg-gradient-to-r from-warning/10 via-warning/5 to-warning/10 border-b border-warning/20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🏆</span>
                <div>
                  <p className="text-sm text-warning uppercase tracking-widest">Champion</p>
                  <p className="text-2xl font-semibold text-white">{storedWinner}</p>
                </div>
              </div>
              <Link href={`/results/${eventId}`}>
                <Button variant="outline" size="sm">
                  View Results
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Action Section */}
      {(event.status === "voting" || (event.status === "finalized" && !show2022Winner)) && (
        <section className="py-8 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-wrap gap-4">
              {event.status === "voting" && (
                <Link href={`/vote/crowd/${eventId}`}>
                  <Button variant="accent" size="lg">
                    Vote for Bands
                  </Button>
                </Link>
              )}
              {event.status === "finalized" && (
                <Link href={`/results/${eventId}`}>
                  <Button variant="accent" size="lg">
                    View Results
                  </Button>
                </Link>
              )}
              <Link href={`/photos?event=${eventId}`}>
                <Button variant="outline" size="lg">
                  View Photos
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Description Section */}
      {event.info?.description && (
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl">
              {event.info.description}
            </p>
          </div>
        </section>
      )}

      {/* Bands Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-sm tracking-widest uppercase text-text-muted mb-2">
              {isFinalized ? "Competed" : "Performing"}
            </h2>
            <p className="text-2xl font-semibold text-white">
              {bands.length} Band{bands.length !== 1 ? "s" : ""}
            </p>
          </div>

          {bands.length === 0 ? (
            <Card variant="elevated" className="text-center py-12">
              <p className="text-text-muted">
                No bands registered for this event yet.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bands.map((band) => {
                const isWinner = show2022Winner && band.name === storedWinner;
                
                return (
                  <Link key={band.id} href={`/band/${band.id}`}>
                    <Card
                      variant="interactive"
                      padding="none"
                      className={`overflow-hidden ${
                        isWinner ? "border-warning/30 bg-warning/5" : ""
                      }`}
                    >
                      <div className="flex items-center p-4 md:p-6 gap-4 md:gap-6">
                        {/* Order Number or Trophy */}
                        {isWinner ? (
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg shrink-0 bg-warning/20">
                            <span className="text-lg">🏆</span>
                          </div>
                        ) : (
                          <NumberedIndicator
                            number={band.order}
                            shape="square"
                            size="lg"
                            variant="muted"
                          />
                        )}

                        {/* Band Logo */}
                        <BandThumbnail
                          logoUrl={band.info?.logo_url}
                          heroThumbnailUrl={band.hero_thumbnail_url}
                          bandName={band.name}
                          size="md"
                        />

                        {/* Band Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-lg font-semibold truncate ${
                              isWinner ? "text-warning" : "text-white"
                            }`}>
                              {band.name}
                            </h3>
                            {isWinner && (
                              <Badge variant="warning" className="shrink-0">Champion</Badge>
                            )}
                          </div>
                          {/* Company badge - asLink=false to avoid nested <a> tags */}
                          {band.company_slug && band.company_name && (
                            <div className="mt-1">
                              <CompanyBadge
                                slug={band.company_slug}
                                name={band.company_name}
                                iconUrl={band.company_icon_url}
                                variant="default"
                                size="sm"
                                asLink={false}
                              />
                            </div>
                          )}
                          {band.info?.genre && (
                            <p className="text-text-dim text-xs mt-1">
                              {band.info.genre}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="shrink-0 text-text-dim">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Photos Section */}
      <PhotoStrip eventId={eventId as string} />

      {/* Videos Section */}
      {videos.length > 0 && (
        <section className="py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <VideoCarousel videos={videos} title="Videos" showBandInfo={true} />
          </div>
        </section>
      )}
    </WebLayout>
  );
}
