"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Photo, Event, Band } from "@/lib/db";
import { PhotoGrid, type GridSize } from "@/components/photos/photo-grid";
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

type OrderMode = "random" | "date";

// Inner component that uses useSearchParams
function PhotosContent() {
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [orderMode, setOrderMode] = useState<OrderMode>("random");
  const [gridSize, setGridSize] = useState<GridSize>("md");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;

  // Track if we've initialized from URL params - use state so it triggers re-render
  const [isInitialized, setIsInitialized] = useState(false);
  // Track loaded photo IDs to prevent duplicates in random mode
  const loadedPhotoIds = useRef<Set<string>>(new Set());

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

  // Track current page for ordered mode
  const currentPage = useRef(1);

  // Initialize filters from URL params on mount
  useEffect(() => {
    if (isInitialized) return;

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

    // Mark as initialized - this will trigger the fetch with correct filters
    setIsInitialized(true);
  }, [searchParams, isInitialized]);

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
      setSlideshowIndex(slideshowIndex !== null ? 0 : null); // Reset to first photo if slideshow is open
      updateUrlParams({ event: eventId, band: null });
    },
    [updateUrlParams, slideshowIndex]
  );

  const handleBandChange = useCallback(
    (bandId: string | null) => {
      setSelectedBandId(bandId);
      setSlideshowIndex(slideshowIndex !== null ? 0 : null); // Reset to first photo if slideshow is open
      updateUrlParams({ band: bandId });
    },
    [updateUrlParams, slideshowIndex]
  );

  const handlePhotographerChange = useCallback(
    (photographer: string | null) => {
      setSelectedPhotographer(photographer);
      setSlideshowIndex(slideshowIndex !== null ? 0 : null); // Reset to first photo if slideshow is open
      updateUrlParams({ photographer });
    },
    [updateUrlParams, slideshowIndex]
  );

  const handleCompanyChange = useCallback(
    (company: string | null) => {
      setSelectedCompanySlug(company);
      // Clear event/band when company changes
      setSelectedEventId(null);
      setSelectedBandId(null);
      setSlideshowIndex(slideshowIndex !== null ? 0 : null); // Reset to first photo if slideshow is open
      updateUrlParams({ company, event: null, band: null });
    },
    [updateUrlParams, slideshowIndex]
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

  // Reset photos when filters or order mode change
  useEffect(() => {
    setPhotos([]);
    loadedPhotoIds.current = new Set();
    currentPage.current = 1;
    setLoading(true);
  }, [
    selectedEventId,
    selectedBandId,
    selectedPhotographer,
    selectedCompanySlug,
    orderMode,
  ]);

  // Fetch photos - initial load or load more
  const fetchPhotos = useCallback(
    async (isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (selectedEventId) params.set("event", selectedEventId);
        if (selectedBandId) params.set("band", selectedBandId);
        if (selectedPhotographer)
          params.set("photographer", selectedPhotographer);
        if (selectedCompanySlug) params.set("company", selectedCompanySlug);
        params.set("limit", PAGE_SIZE.toString());
        params.set("order", orderMode);

        // For ordered mode, use pagination; for random, always fetch fresh
        if (orderMode === "date") {
          params.set("page", currentPage.current.toString());
        }

        const res = await fetch(`/api/photos?${params.toString()}`);
        if (res.ok) {
          const data: PhotosResponse = await res.json();
          setTotalCount(data.pagination.total);
          setPhotographers(data.photographers);
          setCompanies(data.companies || []);
          setAvailableFilters(data.availableFilters);

          if (isLoadMore) {
            // Filter out duplicates (important for random mode)
            const newPhotos = data.photos.filter(
              (p) => !loadedPhotoIds.current.has(p.id)
            );
            newPhotos.forEach((p) => loadedPhotoIds.current.add(p.id));
            setPhotos((prev) => [...prev, ...newPhotos]);
            if (orderMode === "date") {
              currentPage.current += 1;
            }
          } else {
            // Initial load
            loadedPhotoIds.current = new Set(data.photos.map((p) => p.id));
            setPhotos(data.photos);
            currentPage.current = 2; // Next load will be page 2
          }
        }
      } catch (error) {
        console.error("Failed to fetch photos:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      selectedEventId,
      selectedBandId,
      selectedPhotographer,
      selectedCompanySlug,
      orderMode,
    ]
  );

  // Initial fetch when filters change - only after URL params are initialized
  useEffect(() => {
    if (!isInitialized) return;
    fetchPhotos(false);
  }, [fetchPhotos, isInitialized]);

  // Infinite scroll - load more when reaching bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          !loading &&
          !loadingMore &&
          photos.length < totalCount
        ) {
          fetchPhotos(true);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loading, loadingMore, photos.length, totalCount, fetchPhotos]);

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
    loadedPhotoIds.current.delete(photoId);
    // Update total count
    setTotalCount((prev) => prev - 1);
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

  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Photos" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="font-semibold text-4xl mb-2">Photo Gallery</h1>
              <p className="text-text-muted">
                {photos.length} of {totalCount} photo
                {totalCount !== 1 ? "s" : ""} from {events.length} event
                {events.length !== 1 ? "s" : ""}
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

          {/* View controls - Order & Size */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Order toggle */}
            <div className="flex items-center bg-bg-elevated rounded-full p-1">
              <button
                onClick={() => setOrderMode("random")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  orderMode === "random"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Show photos in random order"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline">Random</span>
              </button>
              <button
                onClick={() => setOrderMode("date")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  orderMode === "date"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Show photos by date"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="hidden sm:inline">By Date</span>
              </button>
            </div>

            {/* Size selector */}
            <div className="flex items-center bg-bg-elevated rounded-full p-1">
              <button
                onClick={() => setGridSize("xs")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === "xs"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Extra large thumbnails (1 per row on mobile)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="2" y="2" width="12" height="12" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize("sm")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === "sm"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Large thumbnails"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize("md")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === "md"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Medium thumbnails (default)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="4" height="4" rx="0.5" />
                  <rect x="6" y="1" width="4" height="4" rx="0.5" />
                  <rect x="11" y="1" width="4" height="4" rx="0.5" />
                  <rect x="1" y="6" width="4" height="4" rx="0.5" />
                  <rect x="6" y="6" width="4" height="4" rx="0.5" />
                  <rect x="11" y="6" width="4" height="4" rx="0.5" />
                  <rect x="1" y="11" width="4" height="4" rx="0.5" />
                  <rect x="6" y="11" width="4" height="4" rx="0.5" />
                  <rect x="11" y="11" width="4" height="4" rx="0.5" />
                </svg>
              </button>
              <button
                onClick={() => setGridSize("lg")}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  gridSize === "lg"
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-white"
                }`}
                title="Small thumbnails (compact)"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect x="1" y="1" width="3" height="3" rx="0.3" />
                  <rect x="5" y="1" width="3" height="3" rx="0.3" />
                  <rect x="9" y="1" width="3" height="3" rx="0.3" />
                  <rect x="13" y="1" width="2" height="3" rx="0.3" />
                  <rect x="1" y="5" width="3" height="3" rx="0.3" />
                  <rect x="5" y="5" width="3" height="3" rx="0.3" />
                  <rect x="9" y="5" width="3" height="3" rx="0.3" />
                  <rect x="13" y="5" width="2" height="3" rx="0.3" />
                  <rect x="1" y="9" width="3" height="3" rx="0.3" />
                  <rect x="5" y="9" width="3" height="3" rx="0.3" />
                  <rect x="9" y="9" width="3" height="3" rx="0.3" />
                  <rect x="13" y="9" width="2" height="3" rx="0.3" />
                  <rect x="1" y="13" width="3" height="2" rx="0.3" />
                  <rect x="5" y="13" width="3" height="2" rx="0.3" />
                  <rect x="9" y="13" width="3" height="2" rx="0.3" />
                  <rect x="13" y="13" width="2" height="2" rx="0.3" />
                </svg>
              </button>
            </div>
          </div>
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
            size={gridSize}
          />
        </div>

        {/* Infinite scroll trigger */}
        <div
          ref={loadMoreRef}
          className="mt-12 h-20 flex items-center justify-center"
        >
          {loadingMore && (
            <div className="flex items-center gap-3 text-text-muted">
              <svg
                className="animate-spin w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">Loading more photos...</span>
            </div>
          )}
          {!loadingMore && photos.length >= totalCount && photos.length > 0 && (
            <p className="text-text-dim text-sm">
              All {totalCount} photos loaded
            </p>
          )}
        </div>
      </main>

      {/* Slideshow modal */}
      {slideshowIndex !== null && photos.length > 0 && (
        <PhotoSlideshow
          photos={photos}
          initialIndex={slideshowIndex}
          totalPhotos={totalCount}
          currentPage={1}
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

// Main page component wraps content in Suspense for useSearchParams
export default function PhotosPage() {
  return (
    <Suspense fallback={<PhotosLoading />}>
      <PhotosContent />
    </Suspense>
  );
}
