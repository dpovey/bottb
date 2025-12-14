"use client";

import { Photo } from "@/lib/db";

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const thumbSrc = photo.thumbnail_url || photo.blob_url;
  
  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-bg-elevated transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      onClick={onClick}
    >
      {/* Thumbnail image - key forces re-render when URL changes */}
      <img
        key={thumbSrc}
        src={thumbSrc}
        alt={photo.original_filename || "Photo"}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />

      {/* Hover overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {photo.band_name && (
            <p className="text-sm font-medium text-white truncate">
              {photo.band_name}
            </p>
          )}
          {photo.event_name && (
            <p className="text-xs text-text-muted truncate">{photo.event_name}</p>
          )}
        </div>
      </div>

      {/* Accent border on hover */}
      <div className="absolute inset-0 rounded-lg border-2 border-accent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

