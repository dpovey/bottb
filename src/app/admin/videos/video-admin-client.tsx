"use client";

import { useState } from "react";
import { Video } from "@/lib/db";

interface VideoAdminClientProps {
  initialVideos: Video[];
  events: { id: string; name: string }[];
  bandsMap: Record<string, { id: string; name: string }[]>;
}

export function VideoAdminClient({
  initialVideos,
  events,
  bandsMap,
}: VideoAdminClientProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedBandId, setSelectedBandId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get bands for selected event
  const availableBands = selectedEventId ? bandsMap[selectedEventId] || [] : [];

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          title,
          eventId: selectedEventId || null,
          bandId: selectedBandId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setVideos([data.video, ...videos]);
        setYoutubeUrl("");
        setTitle("");
        setSelectedEventId("");
        setSelectedBandId("");
        setIsAddingVideo(false);
      } else if (response.status === 409) {
        const data = await response.json();
        setError(`Video already exists: ${data.video?.title || "Unknown"}`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add video");
      }
    } catch (err) {
      setError("Failed to add video");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;

    setDeletingId(videoId);
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setVideos(videos.filter((v) => v.id !== videoId));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete video");
      }
    } catch (err) {
      alert("Failed to delete video");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateVideo = async (
    videoId: string,
    title: string | null,
    eventId: string | null,
    bandId: string | null
  ) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, eventId, bandId }),
      });

      if (response.ok) {
        const data = await response.json();
        setVideos(videos.map((v) => (v.id === videoId ? { ...v, ...data.video } : v)));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update video");
      }
    } catch (err) {
      alert("Failed to update video");
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add Video Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsAddingVideo(true)}
          className="bg-accent hover:bg-accent-light text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          + Add Video
        </button>
      </div>

      {/* Add Video Form */}
      {isAddingVideo && (
        <div className="bg-elevated rounded-2xl p-6 border border-white/5">
          <h2 className="text-xl font-bold text-white mb-4">Add New Video</h2>
          <form onSubmit={handleAddVideo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                YouTube URL or Video ID *
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or VIDEO_ID"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event (optional)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setSelectedBandId(""); // Reset band when event changes
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-none"
                >
                  <option value="">Select Event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Band (optional)
                </label>
                <select
                  value={selectedBandId}
                  onChange={(e) => setSelectedBandId(e.target.value)}
                  disabled={!selectedEventId}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select Band</option>
                  {availableBands.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent hover:bg-accent-light text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add Video"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingVideo(false);
                  setError(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Videos List */}
      <div className="bg-elevated rounded-2xl p-6 border border-white/5">
        <h2 className="text-2xl font-bold text-white mb-6">
          Videos ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No videos found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first video to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                events={events}
                bandsMap={bandsMap}
                onUpdate={handleUpdateVideo}
                onDelete={handleDeleteVideo}
                isDeleting={deletingId === video.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface VideoRowProps {
  video: Video;
  events: { id: string; name: string }[];
  bandsMap: Record<string, { id: string; name: string }[]>;
  onUpdate: (videoId: string, title: string | null, eventId: string | null, bandId: string | null) => Promise<void>;
  onDelete: (videoId: string) => Promise<void>;
  isDeleting: boolean;
}

function VideoRow({
  video,
  events,
  bandsMap,
  onUpdate,
  onDelete,
  isDeleting,
}: VideoRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title);
  const [editEventId, setEditEventId] = useState(video.event_id || "");
  const [editBandId, setEditBandId] = useState(video.band_id || "");

  const availableBands = editEventId ? bandsMap[editEventId] || [] : [];

  const handleSave = async () => {
    await onUpdate(
      video.id,
      editTitle,
      editEventId || null,
      editBandId || null
    );
    setIsEditing(false);
  };

  return (
    <div className="bg-surface rounded-xl p-4 flex gap-4">
      {/* Thumbnail */}
      <a
        href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
          alt={video.title}
          className="w-32 h-20 object-cover rounded-lg hover:opacity-80 transition-opacity"
        />
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-3">
            {/* Title input */}
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Video title"
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm focus:border-accent focus:outline-none"
            />
            <p className="text-sm text-gray-400">{video.youtube_video_id}</p>

            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={editEventId}
                onChange={(e) => {
                  setEditEventId(e.target.value);
                  setEditBandId("");
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
              >
                <option value="">No Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>

              <select
                value={editBandId}
                onChange={(e) => setEditBandId(e.target.value)}
                disabled={!editEventId}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm disabled:opacity-50"
              >
                <option value="">No Band</option>
                {availableBands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(video.title);
                  setEditEventId(video.event_id || "");
                  setEditBandId(video.band_id || "");
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white truncate">{video.title}</h3>
            <p className="text-sm text-gray-400">{video.youtube_video_id}</p>
            <div className="mt-2 flex gap-2 text-sm">
              {video.event_name ? (
                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                  {video.event_name}
                </span>
              ) : (
                <span className="text-gray-500">No event</span>
              )}
              {video.band_name ? (
                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                  {video.band_name}
                </span>
              ) : (
                <span className="text-gray-500">No band</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          title="Edit video"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(video.id)}
          disabled={isDeleting}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400 disabled:opacity-50"
          title="Delete video"
        >
          {isDeleting ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

