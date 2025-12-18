import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicLayout } from "@/components/layouts";
import { getBaseUrl } from "@/lib/seo";
import { VideosContent } from "./videos-content";

export const metadata: Metadata = {
  title: "Videos | Battle of the Tech Bands",
  description:
    "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  alternates: {
    canonical: `${getBaseUrl()}/videos`,
  },
  openGraph: {
    title: "Videos | Battle of the Tech Bands",
    description:
      "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Videos | Battle of the Tech Bands",
    description:
      "Watch performance videos from Battle of the Tech Bands events. Relive the best moments from our tech community's bands.",
  },
};

// Loading fallback for Suspense
function VideosLoading() {
  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Videos" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-semibold text-4xl mb-2">Videos</h1>
          <p className="text-text-muted">Loading...</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-text-muted">Loading videos...</div>
        </div>
      </main>
    </PublicLayout>
  );
}

interface VideosPageProps {
  searchParams: Promise<{
    event?: string;
    band?: string;
  }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const params = await searchParams;
  const initialEventId = params.event || null;
  const initialBandId = params.band || null;

  return (
    <Suspense fallback={<VideosLoading />}>
      <VideosContent
        initialEventId={initialEventId}
        initialBandId={initialBandId}
      />
    </Suspense>
  );
}

