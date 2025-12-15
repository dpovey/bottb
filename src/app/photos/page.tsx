"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Photo, Event, Band } from "@/lib/db";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoSlideshow } from "@/components/photos/photo-slideshow";
import { PhotoFilters } from "@/components/photos/photo-filters";
import { PublicLayout } from "@/components/layouts";

interface Company {
  slug: string;
  name: string;
}

interface AvailableFilters {
  companies: { slug: string; name: string; count: number }[];
  events: { id: string; name: string; count: number }[];
  bands: { id: string; name: string; count: number }[];
  photographers: { name: string; count: number }[];
  hasPhotosWithoutBand: boolean;
  hasPhotosWithoutCompany: boolean;
}

interface PhotosResponse {
  photos: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  photographers: string[];
  companies: Company[];
  availableFilters?: AvailableFilters;
}

export default function PhotosPage() {
  const searchParams = useSearchParams();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [photographers, setPhotographers] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableFilters, setAvailableFilters] = useState<
    AvailableFilters | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Track if we've initialized from URL params
  const initializedFromUrl = useRef(false);

  // Filters - initialize from URL params
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedPhotographer, setSelectedPhotographer] = useState<
    string | null
  >(null);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(
    null
  );

  // Slideshow
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);

  // Initialize filters from URL params on mount
  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;

    // Support both new (event, band) and legacy (eventId, bandId) param names
    const eventId = searchParams.get("event") || searchParams.get("eventId");
    const bandId = searchParams.get("band") || searchParams.get("bandId");
    const photographer = searchParams.get("photographer");
    const company = searchParams.get("company");
    const photoId = searchParams.get("photo");

    if (eventId) setSelectedEventId(eventId);
    if (bandId) setSelectedBandId(bandId);
    if (photographer) setSelectedPhotographer(photographer);
    if (company) setSelectedCompanySlug(company);
    if (photoId) setPendingPhotoId(photoId);
  }, [searchParams]);

  // Update URL when filters change
  const updateUrlParams = useCallback(
    (params: {
      event?: string | null;
      band?: string | null;
      photographer?: string | null;
      company?: string | null;
    }) => {
      const url = new URL(window.location.href);

      // Update each param using new cleaner names
      if (params.event !== undefined) {
        // Remove legacy param if present
        url.searchParams.delete("eventId");
        if (params.event) {
          url.searchParams.set("event", params.event);
        } else {
          url.searchParams.delete("event");
        }
      }
      if (params.band !== undefined) {
        // Remove legacy param if present
        url.searchParams.delete("bandId");
        if (params.band) {
          url.searchParams.set("band", params.band);
        } else {
          url.searchParams.delete("band");
        }
      }
      if (params.photographer !== undefined) {
        if (params.photographer) {
          url.searchParams.set("photographer", params.photographer);
        } else {
          url.searchParams.delete("photographer");
        }
      }
      if (params.company !== undefined) {
        if (params.company) {
          url.searchParams.set("company", params.company);
        } else {
          url.searchParams.delete("company");
        }
      }

      // Use replaceState to avoid adding to browser history for filter changes
      window.history.replaceState({}, "", url.pathname + url.search);
    },
    []
  );

  // Wrapper functions that update both state and URL
  const handleEventChange = useCallback(
    (eventId: string | null) => {
      setSelectedEventId(eventId);
      setSelectedBandId(null); // Reset band when event changes
      updateUrlParams({ event: eventId, band: null });
    },
    [updateUrlParams]
  );

  const handleBandChange = useCallback(
    (bandId: string | null) => {
      setSelectedBandId(bandId);
      updateUrlParams({ band: bandId });
    },
    [updateUrlParams]
  );

  const handlePhotographerChange = useCallback(
    (photographer: string | null) => {
      setSelectedPhotographer(photographer);
      updateUrlParams({ photographer });
    },
    [updateUrlParams]
  );

  const handleCompanyChange = useCallback(
    (company: string | null) => {
      setSelectedCompanySlug(company);
      // Clear event/band when company changes
      setSelectedEventId(null);
      setSelectedBandId(null);
      updateUrlParams({ company, event: null, band: null });
    },
    [updateUrlParams]
  );

  // Open slideshow when photos load and we have a pending photo ID
  useEffect(() => {
    if (pendingPhotoId && photos.length > 0 && !loading) {
      const index = photos.findIndex((p) => p.id === pendingPhotoId);
      if (index !== -1) {
        setSlideshowIndex(index);
        setPendingPhotoId(null);
      } else {
        // Photo not found in current page - clear the pending ID
        // In a more advanced implementation, we could search for the photo
        setPendingPhotoId(null);
      }
    }
  }, [pendingPhotoId, photos, loading]);

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
        allEvents.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
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
  }, [
    selectedEventId,
    selectedBandId,
    selectedPhotographer,
    selectedCompanySlug,
  ]);

  // Fetch photos when filters or page change
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.set("event", selectedEventId);
      if (selectedBandId) params.set("band", selectedBandId);
      if (selectedPhotographer)
        params.set("photographer", selectedPhotographer);
      if (selectedCompanySlug) params.set("company", selectedCompanySlug);
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
        setCompanies(data.companies || []);
        setAvailableFilters(data.availableFilters);
      }
    } catch (error) {
      console.error("Failed to fetch photos:", error);
    } finally {
      setLoading(false);
    }
  }, [
    selectedEventId,
    selectedBandId,
    selectedPhotographer,
    selectedCompanySlug,
    pagination.page,
    pagination.limit,
  ]);

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
    // Clear the photo param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("photo");
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  // Handle photo change in slideshow (update URL)
  const handlePhotoChange = (photoId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("photo", photoId);
    window.history.replaceState({}, "", url.pathname + url.search);
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

  // Handle photo crop (called from slideshow)
  const handlePhotoCropped = (photoId: string, newThumbnailUrl: string) => {
    // Update the thumbnail URL in local state
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, thumbnail_url: newThumbnailUrl } : p
      )
    );
  };

  // Generate pagination numbers
  const getPaginationNumbers = () => {
    const pages: (number | "...")[] = [];
    const total = pagination.totalPages;
    const current = pagination.page;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      ) {
        pages.push(i);
      }
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  };

  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Photos" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-semibold text-4xl mb-2">Photo Gallery</h1>
            <p className="text-text-muted">
              {pagination.total} photo{pagination.total !== 1 ? "s" : ""} from{" "}
              {events.length} event{events.length !== 1 ? "s" : ""}
            </p>
          </div>
          {photos.length > 0 && (
            <button
              onClick={() => setSlideshowIndex(0)}
              className="border border-accent/40 text-accent hover:bg-accent/10 px-6 py-3 rounded-full text-xs tracking-widest uppercase font-medium flex items-center gap-2 self-start sm:self-auto transition-colors"
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Slideshow
            </button>
          )}
        </div>

        {/* Filters */}
        <PhotoFilters
          events={events}
          bands={bands}
          photographers={photographers}
          companies={companies}
          availableFilters={availableFilters}
          selectedEventId={selectedEventId}
          selectedBandId={selectedBandId}
          selectedPhotographer={selectedPhotographer}
          selectedCompanySlug={selectedCompanySlug}
          onEventChange={handleEventChange}
          onBandChange={handleBandChange}
          onPhotographerChange={handlePhotographerChange}
          onCompanyChange={handleCompanyChange}
          loading={loading}
        />

        {/* Photo grid */}
        <div className="mt-8">
          <PhotoGrid
            photos={photos}
            onPhotoClick={handlePhotoClick}
            loading={loading}
          />
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            {/* Previous button */}
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-2 rounded-lg text-xs tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {getPaginationNumbers().map((pageNum, idx) =>
                pageNum === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-10 h-10 flex items-center justify-center text-text-dim"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: pageNum as number }))
                    }
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      pagination.page === pageNum
                        ? "bg-accent text-white"
                        : "bg-bg-elevated text-text-muted hover:text-white hover:bg-bg-surface"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}
            </div>

            {/* Next button */}
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-2 rounded-lg text-xs tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
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
            companySlug: selectedCompanySlug,
          }}
          filterNames={{
            eventName: events.find((e) => e.id === selectedEventId)?.name,
            bandName:
              selectedBandId === "none"
                ? "No Band"
                : bands.find((b) => b.id === selectedBandId)?.name,
            photographer: selectedPhotographer,
            companyName:
              selectedCompanySlug === "none"
                ? "No Company"
                : companies.find((c) => c.slug === selectedCompanySlug)?.name,
          }}
          onFilterChange={(filterType, value) => {
            switch (filterType) {
              case "event":
                handleEventChange(value);
                break;
              case "band":
                handleBandChange(value);
                break;
              case "photographer":
                handlePhotographerChange(value);
                break;
              case "company":
                handleCompanyChange(value);
                break;
            }
          }}
          onClose={handleSlideshowClose}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoCropped={handlePhotoCropped}
          onPhotoChange={handlePhotoChange}
        />
      )}
    </PublicLayout>
  );
}
