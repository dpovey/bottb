"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface HeroImage {
  url: string;
  focalPoint?: { x: number; y: number };
}

interface HeroCarouselProps {
  images: HeroImage[];
  interval?: number; // in milliseconds
  fallbackImage?: string;
  children?: React.ReactNode;
}

export function HeroCarousel({
  images,
  interval = 10000,
  fallbackImage = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80",
  children,
}: HeroCarouselProps) {
  // Start with a random image
  const [currentIndex, setCurrentIndex] = useState(() =>
    images.length > 0 ? Math.floor(Math.random() * images.length) : 0
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const effectiveImages = images.length > 0 ? images : [{ url: fallbackImage }];

  const nextImage = useCallback(() => {
    if (effectiveImages.length <= 1) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % effectiveImages.length);
      setIsTransitioning(false);
    }, 500); // Half of the CSS transition duration
  }, [effectiveImages.length]);

  useEffect(() => {
    if (effectiveImages.length <= 1) return;

    const timer = setInterval(nextImage, interval);
    return () => clearInterval(timer);
  }, [effectiveImages.length, interval, nextImage]);

  return (
    <section className="relative min-h-[70vh] flex items-end">
      {/* Background Images with crossfade */}
      <div className="absolute inset-0">
        {effectiveImages.map((image, index) => (
          <div
            key={image.url}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex && !isTransitioning
                ? "opacity-100"
                : "opacity-0"
            }`}
          >
            <Image
              src={image.url}
              alt="Battle of the Tech Bands event"
              fill
              className="object-cover"
              style={{
                objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%`,
              }}
              sizes="100vw"
              priority={index === currentIndex}
            />
          </div>
        ))}
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/40" />
        <div className="absolute inset-0 bg-linear-to-r from-purple-900/30 via-transparent to-indigo-900/20" />
      </div>

      {/* Content */}
      {children}
    </section>
  );
}

