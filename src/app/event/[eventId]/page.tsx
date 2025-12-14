"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";
import { WebLayout } from "@/components/layouts";
import { Button, Badge, Card, DateBadge } from "@/components/ui";
import { PageHeader } from "@/components/hero";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
  image_url?: string;
  info?: {
    image_url?: string;
    description?: string;
    website?: string;
    social_media?: {
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    venue_info?: string;
    [key: string]: unknown;
  };
}

interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  order: number;
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

function getStatusBadge(status: string) {
  switch (status) {
    case "voting":
      return <Badge variant="success">Voting Open</Badge>;
    case "finalized":
      return <Badge variant="accent">Results Available</Badge>;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventResponse, bandsResponse, heroResponse] = await Promise.all([
          fetch(`/api/events/${eventId}`),
          fetch(`/api/bands/${eventId}`),
          fetch(`/api/photos/heroes?label=event_hero&eventId=${eventId}`),
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
    { label: "Events", href: "/" },
    { label: event.name },
  ];

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
            <DateBadge date={event.date} size="lg" showYear />

            {/* Event Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(event.status)}
              </div>
              <h1 className="text-4xl lg:text-5xl font-semibold text-white mb-2">
                {event.name}
              </h1>
              <div className="text-text-muted text-lg">
                {formatEventDate(event.date)} • {event.location}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Section */}
      {(event.status === "voting" || event.status === "finalized") && (
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
              <Link href="/photos">
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
              Performing
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
              {bands.map((band) => (
                <Link key={band.id} href={`/band/${band.id}`}>
                  <Card
                    variant="interactive"
                    padding="none"
                    className="overflow-hidden"
                  >
                    <div className="flex items-center p-4 md:p-6 gap-4 md:gap-6">
                      {/* Order Number */}
                      <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg shrink-0">
                        <span className="text-lg font-semibold text-text-muted">
                          {band.order}
                        </span>
                      </div>

                      {/* Band Logo */}
                      <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden bg-bg-surface">
                        {band.info?.logo_url ? (
                          <Image
                            src={band.info.logo_url}
                            alt={`${band.name} logo`}
                            width={64}
                            height={64}
                            className="w-full h-full object-contain"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-text-dim text-xs">
                              No Logo
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Band Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {band.name}
                        </h3>
                        {band.description && (
                          <p className="text-text-muted text-sm truncate mt-1">
                            {band.description}
                          </p>
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
              ))}
            </div>
          )}
        </div>
      </section>
    </WebLayout>
  );
}
