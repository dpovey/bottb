"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BandThumbnailProps {
  logoUrl?: string;
  heroThumbnailUrl?: string;
  bandName: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  className?: string;
}

const sizeConfig = {
  xs: {
    container: "w-8 h-8",
    image: 32,
    placeholder: "text-[10px]",
  },
  sm: {
    container: "w-12 h-12",
    image: 48,
    placeholder: "text-xs",
  },
  md: {
    container: "w-14 h-14 md:w-16 md:h-16",
    image: 64,
    placeholder: "text-xs",
  },
  lg: {
    container: "w-16 h-16",
    image: 64,
    placeholder: "text-xs",
  },
  xl: {
    container: "w-24 h-24 md:w-32 md:h-32",
    image: 128,
    placeholder: "text-sm",
  },
  xxl: {
    container: "w-40 h-40 sm:w-48 sm:h-48",
    image: 200,
    placeholder: "text-lg",
  },
};

export function BandThumbnail({
  logoUrl,
  heroThumbnailUrl,
  bandName,
  size = "md",
  className,
}: BandThumbnailProps) {
  const config = sizeConfig[size];
  const imageUrl = logoUrl || heroThumbnailUrl;
  const isHeroImage = !logoUrl && !!heroThumbnailUrl;

  if (imageUrl) {
    return (
      <div
        className={cn(
          config.container,
          "shrink-0 rounded-lg overflow-hidden bg-bg-surface transition-transform duration-200 hover:scale-105",
          className
        )}
      >
        <Image
          src={imageUrl}
          alt={`${bandName} ${logoUrl ? "logo" : "photo"}`}
          width={config.image}
          height={config.image}
          className={cn(
            "w-full h-full",
            isHeroImage ? "object-cover" : "object-contain"
          )}
          unoptimized
        />
      </div>
    );
  }

  // Placeholder when no image available
  return (
    <div
      className={cn(
        config.container,
        "shrink-0 rounded-lg overflow-hidden bg-bg-surface flex items-center justify-center",
        className
      )}
    >
      <span className={cn("text-text-dim", config.placeholder)}>
        {size === "xs" ? "?" : "No Logo"}
      </span>
    </div>
  );
}

