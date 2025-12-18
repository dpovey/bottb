import type { Metadata } from "next";
import { getEventById, getBandsForEvent, getPhotosByLabel, PHOTO_LABELS } from "@/lib/db";
import { formatEventDate } from "@/lib/date-utils";
import { parseScoringVersion, hasDetailedBreakdown } from "@/lib/scoring";
import { getBaseUrl } from "@/lib/seo";
import { EventPageClient } from "./event-page-client";
import { EventJsonLd } from "@/components/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const baseUrl = getBaseUrl();
  const event = await getEventById(eventId);

  if (!event) {
    return {
      title: "Event Not Found | Battle of the Tech Bands",
    };
  }

  const eventInfo = event.info as { [key: string]: unknown } | null;
  const scoringVersion = parseScoringVersion(eventInfo);
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion);
  const storedWinner = eventInfo?.winner as string | undefined;
  const isFinalized = event.status === "finalized";
  const show2022Winner = isFinalized && !showDetailedBreakdown && storedWinner;

  // Get bands count
  const bands = await getBandsForEvent(eventId);
  const bandCount = bands.length;

  // Build title
  let title = event.name;
  if (show2022Winner) {
    title += ` - ${storedWinner} Wins`;
  }
  title += " | Battle of the Tech Bands";

  // Build description
  let description = `${event.name} - ${formatEventDate(event.date, event.timezone)} at ${event.location}`;
  if (bandCount > 0) {
    description += `. ${bandCount} band${bandCount !== 1 ? "s" : ""} ${isFinalized ? "competed" : "performing"}`;
  }
  if (event.info?.description) {
    description += `. ${event.info.description}`;
  }
  if (show2022Winner) {
    description += `. Winner: ${storedWinner}`;
  }

  // Get event hero image
  const eventHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, {
    eventId,
  });
  const heroPhoto = eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null;
  const ogImage = heroPhoto?.blob_url || (event.info?.image_url as string | undefined);

  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/event/${eventId}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: `${event.name} - Battle of the Tech Bands`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  
  if (!event) {
    return <EventPageClient eventId={eventId} />;
  }

  const bands = await getBandsForEvent(eventId);
  const eventHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.EVENT_HERO, {
    eventId,
  });
  const heroPhoto = eventHeroPhotos.length > 0 ? eventHeroPhotos[0] : null;

  return (
    <>
      <EventJsonLd
        event={event}
        bands={bands}
        heroImageUrl={heroPhoto?.blob_url || (event.info?.image_url as string | undefined)}
      />
      <EventPageClient eventId={eventId} />
    </>
  );
}
