import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicLayout } from "@/components/layouts";
import { PhotoStrip } from "@/components/photos/photo-strip";
import { SocialIconLink } from "@/components/ui";
import {
  getPhotographerBySlug,
  getPhotographerHeroPhoto,
  getPhotographerRandomPhoto,
} from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

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

function EmailIcon({ className }: { className?: string }) {
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
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
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

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const photographer = await getPhotographerBySlug(slug);

  if (!photographer) {
    return {
      title: "Photographer Not Found | Battle of the Tech Bands",
    };
  }

  const baseUrl = getBaseUrl();

  return {
    title: `${photographer.name} | Photographers | Battle of the Tech Bands`,
    description:
      photographer.bio ||
      `View photos by ${photographer.name} from Battle of the Tech Bands events.`,
    alternates: {
      canonical: `${baseUrl}/photographer/${slug}`,
    },
    openGraph: {
      title: `${photographer.name} | Battle of the Tech Bands`,
      description:
        photographer.bio ||
        `View photos by ${photographer.name} from Battle of the Tech Bands events.`,
      type: "profile",
    },
  };
}

export default async function PhotographerPage({ params }: Props) {
  const { slug } = await params;
  const photographer = await getPhotographerBySlug(slug);

  if (!photographer) {
    notFound();
  }

  // Get hero photo - first try labeled hero, then fall back to random
  let heroPhoto = await getPhotographerHeroPhoto(photographer.name);
  if (!heroPhoto) {
    heroPhoto = await getPhotographerRandomPhoto(photographer.name);
  }

  const heroPhotoUrl = heroPhoto?.blob_url ?? null;
  const heroFocalPoint = heroPhoto?.hero_focal_point ?? { x: 50, y: 50 };

  return (
    <PublicLayout headerVariant="transparent" footerVariant="full">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-end">
        {/* Background Image */}
        {heroPhotoUrl ? (
          <Image
            src={heroPhotoUrl}
            alt={`Photo by ${photographer.name}`}
            fill
            className="object-cover"
            style={{
              objectPosition: `${heroFocalPoint.x}% ${heroFocalPoint.y}%`,
            }}
            priority
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-bg-muted to-amber-900/20" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32">
          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Photographer Icon */}
            <div className="w-24 h-24 rounded-full bg-bg-elevated border border-white/10 flex items-center justify-center shrink-0">
              <CameraIcon className="w-12 h-12 text-accent" />
            </div>

            {/* Photographer Info */}
            <div className="flex-1">
              {/* Name */}
              <h1 className="font-semibold text-4xl sm:text-5xl md:text-6xl mb-3">
                {photographer.name}
              </h1>

              {/* Location */}
              {photographer.location && (
                <p className="text-text-muted text-lg mb-6 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {photographer.location}
                </p>
              )}

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-3xl font-bold text-accent">
                    {photographer.photo_count}
                  </div>
                  <div className="text-xs tracking-widest uppercase text-text-dim">
                    Photos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio Section */}
      {photographer.bio && (
        <section className="py-12 bg-bg border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg max-w-3xl leading-relaxed">
              {photographer.bio}
            </p>
          </div>
        </section>
      )}

      {/* Photos Section */}
      <PhotoStrip
        photographer={photographer.name}
        title="Gallery"
        viewAllLink={`/photos?photographer=${encodeURIComponent(photographer.name)}`}
        className="bg-bg"
      />

      {/* Contact & Links Section */}
      <section className="py-16 bg-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Social Links */}
            <div className="flex flex-wrap gap-3">
              {photographer.instagram && (
                <SocialIconLink
                  href={photographer.instagram}
                  platform="instagram"
                  label="Instagram"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <InstagramIcon className="w-5 h-5" />
                  Instagram
                </SocialIconLink>
              )}
              {photographer.website && (
                <SocialIconLink
                  href={photographer.website}
                  platform="website"
                  label="Website"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <WebsiteIcon className="w-5 h-5" />
                  Website
                </SocialIconLink>
              )}
              {photographer.email && (
                <SocialIconLink
                  href={`mailto:${photographer.email}`}
                  platform="email"
                  label="Contact"
                  location="photographer_page"
                  className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <EmailIcon className="w-5 h-5" />
                  Contact
                </SocialIconLink>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <Link
                href="/photographers"
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                All Photographers
              </Link>
              <Link
                href={`/photos?photographer=${encodeURIComponent(photographer.name)}`}
                className="bg-accent hover:bg-accent-light text-white px-6 py-3 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 transition-colors"
              >
                View All Photos
                <svg
                  className="w-4 h-4"
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
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

