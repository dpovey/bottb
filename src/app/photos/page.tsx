"use client";

import { useEffect, useState, useCallback } from "react";
import { Photo, Event, Band } from "@/lib/db";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoSlideshow } from "@/components/photos/photo-slideshow";
import { PhotoFilters } from "@/components/photos/photo-filters";

interface PhotosResponse {
  photos: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  photographers: string[];
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [photographers, setPhotographers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedPhotographer, setSelectedPhotographer] = useState<string | null>(null);

  // Slideshow
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  // Fetch events and bands on mount
  useEffect(() => {
    async function fetchFilters() {
      try {
        // Fetch both past and upcoming events (public endpoints)
        const [pastRes, upcomingRes] = await Promise.all([
          fetch("/api/events/past"),
          fetch("/api/events/upcoming"),
        ]);

        const allEvents: Event[] = [];
        if (pastRes.ok) {
          const pastData = await pastRes.json();
          allEvents.push(...(Array.isArray(pastData) ? pastData : []));
        }
        if (upcomingRes.ok) {
          const upcomingData = await upcomingRes.json();
          allEvents.push(...(Array.isArray(upcomingData) ? upcomingData : []));
        }
        // Sort by date descending
        allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEvents(allEvents);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }

      try {
        // Fetch all bands
        const bandsRes = await fetch("/api/bands");
        if (bandsRes.ok) {
          const bandsData = await bandsRes.json();
          setBands(bandsData.bands || bandsData || []);
        }
      } catch (error) {
        console.error("Failed to fetch bands:", error);
      }
    }

    fetchFilters();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [selectedEventId, selectedBandId, selectedPhotographer]);

  // Fetch photos when filters or page change
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.set("eventId", selectedEventId);
      if (selectedBandId) params.set("bandId", selectedBandId);
      if (selectedPhotographer) params.set("photographer", selectedPhotographer);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const res = await fetch(`/api/photos?${params.toString()}`);
      if (res.ok) {
        const data: PhotosResponse = await res.json();
        setPhotos(data.photos);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
        setPhotographers(data.photographers);
      }
    } catch (error) {
      console.error("Failed to fetch photos:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, selectedBandId, selectedPhotographer, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Handle photo click
  const handlePhotoClick = (index: number) => {
    setSlideshowIndex(index);
  };

  // Handle slideshow close
  const handleSlideshowClose = () => {
    setSlideshowIndex(null);
  };

  // Handle photo deletion (called from slideshow)
  const handlePhotoDeleted = (photoId: string) => {
    // Remove the photo from local state
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    // Update pagination count
    setPagination((prev) => ({
      ...prev,
      total: prev.total - 1,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-gray-950/80 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Photo Gallery
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {pagination.total} photo{pagination.total !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Slideshow button */}
            {photos.length > 0 && (
              <button
                onClick={() => setSlideshowIndex(0)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Slideshow
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <PhotoFilters
          events={events}
          bands={bands}
          photographers={photographers}
          selectedEventId={selectedEventId}
          selectedBandId={selectedBandId}
          selectedPhotographer={selectedPhotographer}
          onEventChange={setSelectedEventId}
          onBandChange={setSelectedBandId}
          onPhotographerChange={setSelectedPhotographer}
          loading={loading}
        />

        {/* Photo grid */}
        <div className="mt-6">
          <PhotoGrid
            photos={photos}
            onPhotoClick={handlePhotoClick}
            loading={loading}
          />
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Slideshow modal */}
      {slideshowIndex !== null && photos.length > 0 && (
        <PhotoSlideshow
          photos={photos}
          initialIndex={slideshowIndex}
          totalPhotos={pagination.total}
          currentPage={pagination.page}
          filters={{
            eventId: selectedEventId,
            bandId: selectedBandId,
            photographer: selectedPhotographer,
          }}
          onClose={handleSlideshowClose}
          onPhotoDeleted={handlePhotoDeleted}
        />
      )}
    </div>
  );
}

