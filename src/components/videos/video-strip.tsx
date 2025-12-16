"use client";

import { useEffect, useState } from "react";
import { Video } from "@/lib/db";
import { VideoCarousel } from "@/components/video-carousel";

interface VideoStripProps {
  /** Filter by event ID */
  eventId?: string;
  /** Filter by band ID */
  bandId?: string;
  /** Custom title for the section */
  title?: string;
  /** Custom class for the container */
  className?: string;
  /** Maximum number of videos to show */
  limit?: number;
}

interface VideosResponse {
  videos: Video[];
  total: number;
}

export function VideoStrip({
  eventId,
  bandId,
  title = "Videos",
  className = "",
  limit = 20,
}: VideoStripProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideos() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (eventId) params.set("event", eventId);
        if (bandId) params.set("band", bandId);
        params.set("limit", limit.toString());

        const res = await fetch(`/api/videos?${params.toString()}`);
        if (!res.ok) {
          setVideos([]);
          return;
        }

        const data: VideosResponse = await res.json();
        setVideos(data.videos || []);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, [eventId, bandId, limit]);

  // Don't render anything if there are no videos
  if (!loading && videos.length === 0) {
    return null;
  }

  return (
    <section className={`py-16 bg-bg ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {loading ? (
          // Loading skeleton - video aspect ratio (16:9)
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[280px] sm:w-[320px] shrink-0 rounded-lg bg-bg-elevated animate-pulse"
                  style={{ aspectRatio: "16/9" }}
                />
              ))}
            </div>
          </>
        ) : (
          <VideoCarousel videos={videos} title={title} showBandInfo={true} />
        )}
      </div>
    </section>
  );
}

