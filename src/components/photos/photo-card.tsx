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
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-900"
      onClick={onClick}
    >
      {/* Thumbnail image - key forces re-render when URL changes */}
      <img
        key={thumbSrc}
        src={thumbSrc}
        alt={photo.original_filename || "Photo"}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {photo.band_name && (
            <p className="text-sm font-semibold text-white truncate">
              {photo.band_name}
            </p>
          )}
          {photo.event_name && (
            <p className="text-xs text-gray-300 truncate">{photo.event_name}</p>
          )}
          {photo.photographer && (
            <p className="text-xs text-gray-400 truncate mt-1">
              📷 {photo.photographer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

