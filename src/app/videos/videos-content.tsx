"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicLayout } from "@/components/layouts";
import { Video } from "@/lib/db";
import { CompanyIcon, FilterSelect } from "@/components/ui";
import { CloseIcon, PlayIcon } from "@/components/icons";
import { trackVideoClick } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";

interface Event {
  id: string;
  name: string;
}

interface Band {
  id: string;
  name: string;
  event_id: string;
}

interface VideosContentProps {
  initialEventId: string | null;
  initialBandId: string | null;
}

/**
 * Format duration in seconds to MM:SS or H:MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get YouTube thumbnail URL with fallback
 */
function getThumbnailUrl(video: Video): string {
  if (video.thumbnail_url) {
    return video.thumbnail_url;
  }
  return `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;
}

export function VideosContent({
  initialEventId,
  initialBandId,
}: VideosContentProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(initialBandId);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch events and bands for filters
  useEffect(() => {
    async function fetchFilters() {
      try {
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
        allEvents.sort(
          (a, b) => new Date(b.name).getTime() - new Date(a.name).getTime()
        );
        setEvents(allEvents);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }

      try {
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

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.set("event", selectedEventId);
      if (selectedBandId) params.set("band", selectedBandId);
      params.set("limit", "100");

      const res = await fetch(`/api/videos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        setTotalCount(data.pagination?.total || data.videos?.length || 0);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, selectedBandId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedEventId) params.set("event", selectedEventId);
    if (selectedBandId) params.set("band", selectedBandId);
    const newUrl = params.toString() ? `?${params.toString()}` : "/videos";
    window.history.replaceState(null, "", newUrl);
  }, [selectedEventId, selectedBandId]);

  // Filter bands by selected event
  const filteredBands = selectedEventId
    ? bands.filter((b) => b.event_id === selectedEventId)
    : bands;

  // Clear band selection when event changes and band is not in event
  useEffect(() => {
    if (selectedEventId && selectedBandId) {
      const bandInEvent = bands.find(
        (b) => b.id === selectedBandId && b.event_id === selectedEventId
      );
      if (!bandInEvent) {
        setSelectedBandId(null);
      }
    }
  }, [selectedEventId, selectedBandId, bands]);

  const handleVideoClick = (video: Video) => {
    trackVideoClick({
      video_id: video.id,
      video_title: video.title,
      youtube_video_id: video.youtube_video_id,
      event_id: video.event_id,
      band_id: video.band_id,
      event_name: video.event_name,
      band_name: video.band_name,
      company_name: video.company_name,
      location: "videos_page",
    });
    setSelectedVideo(video);
  };

  const clearFilters = () => {
    setSelectedEventId(null);
    setSelectedBandId(null);
  };

  const hasActiveFilters = selectedEventId || selectedBandId;

  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Videos" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-semibold text-4xl mb-2">Videos</h1>
          <p className="text-text-muted">
            {loading
              ? "Loading..."
              : `${totalCount} video${totalCount !== 1 ? "s" : ""} from Battle of the Tech Bands events`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 items-end">
          {/* Event Filter */}
          <FilterSelect
            value={selectedEventId || ""}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            label="Event"
            containerClassName="min-w-[180px] flex-none"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </FilterSelect>

          {/* Band Filter */}
          <FilterSelect
            value={selectedBandId || ""}
            onChange={(e) => setSelectedBandId(e.target.value || null)}
            label="Band"
            containerClassName="min-w-[180px] flex-none"
          >
            <option value="">All Bands</option>
            {filteredBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </FilterSelect>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-text-muted hover:text-white text-sm flex items-center gap-1 transition-colors pb-3"
            >
              <CloseIcon className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>

        {/* Videos Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-video bg-bg-elevated rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">No videos found</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-accent hover:text-accent-light transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <button
                key={video.id}
                onClick={() => handleVideoClick(video)}
                className="group relative aspect-video rounded-lg overflow-hidden bg-bg-elevated text-left"
              >
                {/* Thumbnail */}
                <img
                  src={getThumbnailUrl(video)}
                  alt={video.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <PlayIcon className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>

                {/* Duration badge */}
                {video.duration_seconds && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {formatDuration(video.duration_seconds)}
                  </div>
                )}

                {/* Video info */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-medium line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  {video.band_name && (
                    <div className="flex items-center gap-2 text-text-muted text-sm">
                      {video.company_icon_url && (
                        <CompanyIcon
                          iconUrl={video.company_icon_url}
                          companyName={video.company_name || ""}
                          size="sm"
                        />
                      )}
                      <span>{video.band_name}</span>
                      {video.event_name && (
                        <>
                          <span className="text-text-dim">•</span>
                          <span className="text-text-dim">{video.event_name}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              >
                <CloseIcon className="w-8 h-8" />
              </button>

              {/* YouTube embed */}
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.youtube_video_id}?autoplay=1`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              />

              {/* Video title */}
              <div className="mt-4 text-center">
                <h3 className="text-white font-medium text-lg">
                  {selectedVideo.title}
                </h3>
                {selectedVideo.band_name && (
                  <p className="text-text-muted">
                    {selectedVideo.band_name}
                    {selectedVideo.event_name && ` • ${selectedVideo.event_name}`}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PublicLayout>
  );
}

