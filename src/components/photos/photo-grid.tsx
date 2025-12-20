"use client";

import { Photo } from "@/lib/db";
import { PhotoIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui";
import { PhotoCard } from "./photo-card";

export type GridSize = "xs" | "sm" | "md" | "lg";

// Grid classes for each size - designed for mobile-first
const gridClasses: Record<GridSize, string> = {
  xs: "grid-cols-1 sm:grid-cols-2 gap-4",           // 1 col mobile, 2 tablet+
  sm: "grid-cols-2 sm:grid-cols-3 gap-3",           // 2 col mobile, 3 tablet+
  md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3",  // Default
  lg: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2",  // Compact
};

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
  loading?: boolean;
  size?: GridSize;
  showCompanyLogos?: boolean;
}

export function PhotoGrid({ photos, onPhotoClick, loading, size = "md", showCompanyLogos = true }: PhotoGridProps) {
  const gridClass = gridClasses[size];

  if (loading) {
    return (
      <div className={`grid ${gridClass}`}>
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center mb-6">
          <PhotoIcon className="w-10 h-10 text-text-dim" />
        </div>
        <h2 className="font-semibold text-2xl mb-2">No photos found</h2>
        <p className="text-text-muted mb-6">Try adjusting your filters to see more photos</p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass}`}>
      {photos.map((photo, index) => (
        <PhotoCard
          key={`${photo.id}-${photo.thumbnail_url}`}
          photo={photo}
          onClick={() => onPhotoClick(index)}
          showCompanyLogo={showCompanyLogos}
        />
      ))}
    </div>
  );
}

