import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layouts";
import { Card } from "@/components/ui";
import { getPhotographers } from "@/lib/db";

export const metadata: Metadata = {
  title: "Photographers | Battle of the Tech Bands",
  description:
    "Meet the talented photographers who capture the energy and excitement of Battle of the Tech Bands events.",
  openGraph: {
    title: "Photographers | Battle of the Tech Bands",
    description:
      "Meet the talented photographers who capture the energy and excitement of Battle of the Tech Bands events.",
    type: "website",
  },
};

// Social icons
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  );
}

function WebsiteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

interface Photographer {
  slug: string;
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  photo_count: number;
}

export default async function PhotographersPage() {
  const photographers = await getPhotographers();

  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Photographers" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="font-semibold text-4xl mb-3">Photographers</h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Meet the talented photographers who capture the energy and
            excitement of Battle of the Tech Bands events.
          </p>
        </div>

        {/* Photographers Grid */}
        {photographers.length === 0 ? (
          <Card variant="elevated" className="text-center py-12">
            <CameraIcon className="w-12 h-12 mx-auto mb-4 text-text-dim" />
            <p className="text-text-muted">
              No photographers have been added yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {photographers.map((photographer: Photographer) => (
              <PhotographerCard
                key={photographer.slug}
                photographer={photographer}
              />
            ))}
          </div>
        )}
      </main>
    </PublicLayout>
  );
}

function PhotographerCard({ photographer }: { photographer: Photographer }) {
  return (
    <Link href={`/photographer/${photographer.slug}`}>
      <Card variant="interactive" padding="none" className="overflow-hidden group">
        {/* Card content */}
        <div className="p-6">
          {/* Header with icon */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <CameraIcon className="w-7 h-7 text-text-muted group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-white truncate group-hover:text-accent transition-colors">
                {photographer.name}
              </h3>
              {photographer.location && (
                <p className="text-text-dim text-sm">{photographer.location}</p>
              )}
            </div>
          </div>

          {/* Bio preview */}
          {photographer.bio && (
            <p className="text-text-muted text-sm line-clamp-2 mb-4">
              {photographer.bio}
            </p>
          )}

          {/* Stats and links */}
          <div className="flex items-center justify-between">
            {/* Photo count */}
            <span className="text-text-dim text-sm">
              {photographer.photo_count}{" "}
              {photographer.photo_count === 1 ? "photo" : "photos"}
            </span>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {photographer.instagram && (
                <span className="text-text-muted hover:text-accent transition-colors">
                  <InstagramIcon className="w-4 h-4" />
                </span>
              )}
              {photographer.website && (
                <span className="text-text-muted hover:text-accent transition-colors">
                  <WebsiteIcon className="w-4 h-4" />
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}



