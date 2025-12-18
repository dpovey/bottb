import type { Metadata } from "next";
import { Suspense } from "react";
import { SongsPageClient } from "./songs-page-client";
import { getEvents, getCompanies } from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "All Songs — BOTTB",
  description:
    "Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.",
  alternates: {
    canonical: `${getBaseUrl()}/songs`,
  },
  openGraph: {
    title: "All Songs | Battle of the Tech Bands",
    description:
      "Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "All Songs | Battle of the Tech Bands",
    description:
      "Every song performed across all Battle of the Tech Bands events. Filter by event, band, company, or song type.",
  },
};

export default async function SongsPage() {
  // Fetch filter options (events that are finalized, companies)
  const [events, companies] = await Promise.all([
    getEvents(),
    getCompanies(),
  ]);

  // Only show finalized events in the filter
  const finalizedEvents = events.filter((e) => e.status === "finalized");

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white text-xl">Loading songs...</div>
        </div>
      }
    >
      <SongsPageClient
        events={finalizedEvents.map((e) => ({ id: e.id, name: e.name }))}
        companies={companies.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </Suspense>
  );
}

