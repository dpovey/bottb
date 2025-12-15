"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Photo } from "@/lib/db";

interface PhotoStripProps {
  /** Filter by event ID */
  eventId?: string;
  /** Filter by band ID */
  bandId?: string;
  /** Filter by company slug */
  companySlug?: string;
  /** Custom title for the section (default: "Photos") */
  title?: string;
  /** Maximum number of photos to display (default: 4) */
  maxPhotos?: number;
  /** Link to full gallery with filters applied */
  viewAllLink?: string;
  /** Custom class for the container */
  className?: string;
}

interface PhotosResponse {
  photos: Photo[];
  pagination: {
    total: number;
  };
}

export function PhotoStrip({
  eventId,
  bandId,
  companySlug,
  title = "Photos",
  maxPhotos = 4,
  viewAllLink,
  className = "",
}: PhotoStripProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Build the view all link based on filters
  const galleryLink = viewAllLink || (() => {
    const params = new URLSearchParams();
    if (eventId) params.set("event", eventId);
    if (bandId) params.set("band", bandId);
    if (companySlug) params.set("company", companySlug);
    return `/photos${params.toString() ? `?${params.toString()}` : ''}`;
  })();

  useEffect(() => {
    async function fetchPhotos() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (eventId) params.set("event", eventId);
        if (bandId) params.set("band", bandId);
        if (companySlug) params.set("company", companySlug);
        params.set("limit", maxPhotos.toString());
        params.set("page", "1");

        const res = await fetch(`/api/photos?${params.toString()}`);
        if (res.ok) {
          const data: PhotosResponse = await res.json();
          setPhotos(data.photos);
          setTotalCount(data.pagination.total);
        }
      } catch (error) {
        console.error("Failed to fetch photos for strip:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPhotos();
  }, [eventId, bandId, companySlug, maxPhotos]);

  // Don't render anything if there are no photos
  if (!loading && photos.length === 0) {
    return null;
  }

  const remainingCount = totalCount - maxPhotos;

  return (
    <section className={`py-16 bg-bg-elevated ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-semibold text-3xl">{title}</h2>
          {totalCount > 0 && (
            <Link
              href={galleryLink}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-2 rounded-full text-xs tracking-widest uppercase flex items-center gap-2 transition-colors"
            >
              View All
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {loading ? (
          // Loading skeleton
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: maxPhotos }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-bg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Show photos up to maxPhotos-1, or all if there aren't enough to show "+N more" */}
            {photos.slice(0, remainingCount > 0 ? maxPhotos - 1 : maxPhotos).map((photo) => (
              <Link
                key={photo.id}
                href={`${galleryLink}${galleryLink.includes('?') ? '&' : '?'}photo=${photo.id}`}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnail_url || photo.blob_url?.replace('/large.webp', '/thumbnail.webp')}
                  alt={photo.original_filename || "Photo"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </Link>
            ))}
            
            {/* Last photo with "+N more" overlay if there are more photos than maxPhotos */}
            {remainingCount > 0 && photos.length >= maxPhotos && (
              <Link
                href={galleryLink}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[maxPhotos - 1].thumbnail_url || photos[maxPhotos - 1].blob_url?.replace('/large.webp', '/thumbnail.webp')}
                  alt={photos[maxPhotos - 1].original_filename || "Photo"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-2xl font-semibold">+{remainingCount}</span>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

