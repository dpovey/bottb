import type { Metadata } from "next";
import { Suspense } from "react";
import { PhotosContent } from "./photos-content";
import { PublicLayout } from "@/components/layouts";
import { getBaseUrl } from "@/lib/seo";

// Loading fallback for Suspense
function PhotosLoading() {
  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Photos" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <h1 className="font-semibold text-4xl mb-2">Photo Gallery</h1>
            <p className="text-text-muted">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-text-muted">Loading photos...</div>
        </div>
      </main>
    </PublicLayout>
  );
}

export const metadata: Metadata = {
  title: "Photo Gallery | Battle of the Tech Bands",
  description:
    "Browse photos from Battle of the Tech Bands events. Filter by event, band, photographer, or company.",
  alternates: {
    canonical: `${getBaseUrl()}/photos`,
  },
  openGraph: {
    title: "Photo Gallery | Battle of the Tech Bands",
    description:
      "Browse photos from Battle of the Tech Bands events. Filter by event, band, photographer, or company.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Photo Gallery | Battle of the Tech Bands",
    description:
      "Browse photos from Battle of the Tech Bands events. Filter by event, band, photographer, or company.",
  },
};

interface PhotosPageProps {
  searchParams: Promise<{
    event?: string;
    eventId?: string;
    band?: string;
    bandId?: string;
    bandIds?: string;
    photographer?: string;
    company?: string;
    photo?: string;
  }>;
}

// Main page component - server component that resolves filters from URL params
export default async function PhotosPage({ searchParams }: PhotosPageProps) {
  const params = await searchParams;

  // Support both new (event, band) and legacy (eventId, bandId) param names
  const initialEventId = params.event || params.eventId || null;
  // Prefer bandIds if present, format as "bandIds:id1,id2" for client component
  const initialBandId = params.bandIds
    ? `bandIds:${params.bandIds}`
    : params.band || params.bandId || null;
  const initialPhotographer = params.photographer || null;
  const initialCompanySlug = params.company || null;
  const initialPhotoId = params.photo || null;

  return (
    <Suspense fallback={<PhotosLoading />}>
      <PhotosContent
        initialEventId={initialEventId}
        initialBandId={initialBandId}
        initialPhotographer={initialPhotographer}
        initialCompanySlug={initialCompanySlug}
        initialPhotoId={initialPhotoId}
      />
    </Suspense>
  );
}
