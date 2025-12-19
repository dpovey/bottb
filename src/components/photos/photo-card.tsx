"use client";

import Image from "next/image";
import { Photo } from "@/lib/db";
import { CompanyIcon } from "@/components/ui";

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
  showCompanyLogo?: boolean;
}

export function PhotoCard({ photo, onClick, showCompanyLogo = true }: PhotoCardProps) {
  const thumbSrc = photo.thumbnail_url || photo.blob_url;
  
  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-bg-elevated transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      onClick={onClick}
    >
      {/* Thumbnail image using Next.js Image for optimized lazy loading */}
      <Image
        key={thumbSrc}
        src={thumbSrc}
        alt={photo.original_filename || "Photo"}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />

      {/* Company icon badge - always visible in top right if available */}
      {showCompanyLogo && photo.company_icon_url && (
        <div className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">
          <CompanyIcon
            iconUrl={photo.company_icon_url}
            companyName={photo.company_name || "Company"}
            size="sm"
            showFallback={false}
          />
        </div>
      )}

      {/* Hover overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {photo.band_name && (
            <div className="flex items-center gap-2">
              {/* Show company icon next to band name if no top-right icon */}
              {!photo.company_icon_url && photo.company_name && (
                <CompanyIcon
                  iconUrl={photo.company_icon_url}
                  companyName={photo.company_name}
                  size="xs"
                  showFallback={false}
                />
              )}
              <p className="text-sm font-medium text-white truncate">
                {photo.band_name}
              </p>
            </div>
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

