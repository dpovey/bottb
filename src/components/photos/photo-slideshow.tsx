"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Photo } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import Cropper, { Area } from "react-easy-crop";

interface PhotoSlideshowProps {
  photos: Photo[];
  initialIndex: number;
  totalPhotos: number;
  currentPage: number;
  filters: {
    eventId?: string | null;
    bandId?: string | null;
    photographer?: string | null;
  };
  onClose: () => void;
  onPhotoDeleted?: (photoId: string) => void;
  onPhotoCropped?: (photoId: string, newThumbnailUrl: string) => void;
  onPhotoChange?: (photoId: string) => void;
}

const PAGE_SIZE = 50;
const PREFETCH_THRESHOLD = 5; // Prefetch when within 5 photos of edge

export function PhotoSlideshow({
  photos: initialPhotos,
  initialIndex,
  totalPhotos,
  currentPage,
  filters,
  onClose,
  onPhotoDeleted,
  onPhotoCropped,
  onPhotoChange,
}: PhotoSlideshowProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  // Internal state for all loaded photos
  const [allPhotos, setAllPhotos] = useState<Photo[]>(initialPhotos);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([currentPage]));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(totalPhotos);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track the most recently cropped photo to ensure immediate update
  const [lastCroppedPhoto, setLastCroppedPhoto] = useState<{id: string, url: string} | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Crop state
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);

  // Link copy state
  const [linkCopied, setLinkCopied] = useState(false);

  // Generate cropped preview when crop area changes
  const generateCropPreview = useCallback(async (pixelCrop: Area, imageSrc: string) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    
    return new Promise<string>((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Set canvas size to 80x80 for preview
        canvas.width = 80;
        canvas.height = 80;

        // Draw the cropped region scaled to 80x80
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          80,
          80
        );

        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = imageSrc;
    });
  }, []);

  // Update preview when crop changes (debounced)
  useEffect(() => {
    if (!showCropModal || !croppedAreaPixels) return;
    
    const currentPhoto = allPhotos[currentIndex];
    if (!currentPhoto) return;

    const timeoutId = setTimeout(async () => {
      try {
        const previewUrl = await generateCropPreview(croppedAreaPixels, currentPhoto.blob_url);
        setCropPreviewUrl(previewUrl);
      } catch (_error) {
        // Preview generation failed - not critical
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [croppedAreaPixels, showCropModal, currentIndex, allPhotos, generateCropPreview]);

  // Clear preview when modal closes
  useEffect(() => {
    if (!showCropModal) {
      setCropPreviewUrl(null);
    }
  }, [showCropModal]);

  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch a specific page of photos
  const fetchPage = useCallback(async (page: number): Promise<Photo[]> => {
    const params = new URLSearchParams();
    if (filters.eventId) params.set("eventId", filters.eventId);
    if (filters.bandId) params.set("bandId", filters.bandId);
    if (filters.photographer) params.set("photographer", filters.photographer);
    params.set("page", page.toString());
    params.set("limit", PAGE_SIZE.toString());

    const res = await fetch(`/api/photos?${params.toString()}`);
    if (!res.ok) return [];

    const data = await res.json();
    setTotalCount(data.pagination.total);
    return data.photos;
  }, [filters]);

  // Load next page
  const loadNextPage = useCallback(async () => {
    const nextPage = Math.max(...Array.from(loadedPages)) + 1;
    const maxPage = Math.ceil(totalCount / PAGE_SIZE);

    if (nextPage > maxPage || loadedPages.has(nextPage) || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const newPhotos = await fetchPage(nextPage);
      if (newPhotos.length > 0) {
        setAllPhotos((prev) => [...prev, ...newPhotos]);
        setLoadedPages((prev) => new Set([...prev, nextPage]));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadedPages, totalCount, isLoadingMore, fetchPage]);

  // Load previous page
  const loadPrevPage = useCallback(async () => {
    const prevPage = Math.min(...Array.from(loadedPages)) - 1;

    if (prevPage < 1 || loadedPages.has(prevPage) || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const newPhotos = await fetchPage(prevPage);
      if (newPhotos.length > 0) {
        setAllPhotos((prev) => [...newPhotos, ...prev]);
        setLoadedPages((prev) => new Set([...prev, prevPage]));
        // Adjust current index since we prepended photos
        setCurrentIndex((prev) => prev + newPhotos.length);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadedPages, isLoadingMore, fetchPage]);

  // Check if we need to prefetch
  useEffect(() => {
    // Near the end - load next page
    if (currentIndex >= allPhotos.length - PREFETCH_THRESHOLD) {
      loadNextPage();
    }
    // Near the beginning - load previous page
    if (currentIndex < PREFETCH_THRESHOLD) {
      loadPrevPage();
    }
  }, [currentIndex, allPhotos.length, loadNextPage, loadPrevPage]);

  const goToIndex = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < allPhotos.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    } else if (currentIndex === allPhotos.length - 1 && allPhotos.length < totalCount) {
      // At the end but more photos exist - they're loading
      // Could show a loading indicator
    }
  }, [currentIndex, allPhotos.length, totalCount]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDeleteConfirm || showCropModal) return; // Don't navigate while modals are open
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToPrevious, goToNext, showDeleteConfirm, showCropModal]);

  // Auto-scroll thumbnail strip to keep current photo visible
  useEffect(() => {
    const thumbnail = thumbnailRefs.current[currentIndex];
    if (thumbnail && thumbnailStripRef.current) {
      thumbnail.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  // Notify parent when current photo changes (for URL updates)
  useEffect(() => {
    const photo = allPhotos[currentIndex];
    if (photo && onPhotoChange) {
      onPhotoChange(photo.id);
    }
  }, [currentIndex, allPhotos, onPhotoChange]);

  // Handle photo deletion
  const handleDelete = async () => {
    const photoToDelete = allPhotos[currentIndex];
    if (!photoToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/photos/${photoToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete photo");
      }

      // Remove from local state
      setAllPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      setTotalCount((prev) => prev - 1);

      // Notify parent component
      onPhotoDeleted?.(photoToDelete.id);

      // Close confirmation dialog
      setShowDeleteConfirm(false);

      // If this was the last photo, close the slideshow
      if (allPhotos.length <= 1) {
        onClose();
      } else if (currentIndex >= allPhotos.length - 1) {
        // If we deleted the last photo, go to previous
        setCurrentIndex(currentIndex - 1);
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle copying link to clipboard
  const handleCopyLink = async () => {
    try {
      // Copy current URL (which already has the photo param from URL sync)
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  // Handle downloading high-res image
  const handleDownload = async () => {
    const photo = allPhotos[currentIndex];
    if (!photo) return;

    try {
      // Fetch the image and trigger download
      const response = await fetch(photo.blob_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.original_filename || `photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  // Handle crop completion callback
  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handle saving the crop
  const handleSaveCrop = async () => {
    const photoToCrop = allPhotos[currentIndex];
    if (!photoToCrop || !croppedAreaPixels) return;

    setIsSavingCrop(true);
    setCropError(null);

    try {
      // Get the image dimensions to calculate percentages
      const img = new Image();
      img.src = photoToCrop.blob_url;
      await new Promise((resolve) => { img.onload = resolve; });

      // Convert pixel coordinates to percentages
      const cropArea = {
        x: (croppedAreaPixels.x / img.naturalWidth) * 100,
        y: (croppedAreaPixels.y / img.naturalHeight) * 100,
        width: (croppedAreaPixels.width / img.naturalWidth) * 100,
        height: (croppedAreaPixels.height / img.naturalHeight) * 100,
      };

      const response = await fetch(`/api/photos/${photoToCrop.id}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropArea }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save crop");
      }

      const result = await response.json();
      const newUrl = result.thumbnailUrl; // This is a NEW unique URL, not the same path
      const photoId = photoToCrop.id;

      // Update the thumbnail URL in local state
      setAllPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, thumbnail_url: newUrl } : p
        )
      );

      // Track the just-cropped photo for immediate update
      setLastCroppedPhoto({ id: photoId, url: newUrl });

      // Notify parent to update gallery view
      onPhotoCropped?.(photoId, newUrl);

      // Close crop modal and reset state
      setShowCropModal(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (error) {
      setCropError(error instanceof Error ? error.message : "Failed to save crop");
    } finally {
      setIsSavingCrop(false);
    }
  };

  const currentPhoto = allPhotos[currentIndex];

  // Safety check
  if (!currentPhoto) {
    return null;
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  // Calculate display position accounting for potentially loaded previous pages
  const minLoadedPage = Math.min(...Array.from(loadedPages));
  const displayPosition = (minLoadedPage - 1) * PAGE_SIZE + currentIndex + 1;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-bg/80 backdrop-blur-lg border-b border-white/5">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Photo Info */}
          <div>
            {currentPhoto.band_name && (
              <h2 className="font-medium text-lg">{currentPhoto.band_name}</h2>
            )}
            <p className="text-sm text-text-muted">
              {currentPhoto.event_name && <span>{currentPhoto.event_name}</span>}
              {currentPhoto.event_name && currentPhoto.photographer && <span> • </span>}
              {currentPhoto.photographer && <span>Photo by {currentPhoto.photographer}</span>}
            </p>
          </div>

          {/* Counter & Controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">
              <span className="text-white font-medium">{displayPosition}</span> / {totalCount}
              {isLoadingMore && (
                <svg className="inline-block ml-2 animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </span>

            {/* Public Controls - available to everyone */}
            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors relative"
                aria-label="Copy link to photo"
                title="Copy link"
              >
                {linkCopied ? (
                  <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
                aria-label="Download high-resolution image"
                title="Download"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>

            {/* Admin Controls - accent colored to indicate admin-only */}
            {isAdmin && (
              <div className="flex items-center gap-2 pl-4 border-l border-accent/30">
                <button
                  onClick={() => setShowCropModal(true)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors"
                  aria-label="Adjust thumbnail crop (Admin)"
                  title="Edit crop (Admin)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {/* Corner brackets */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M4 16v2a2 2 0 002 2h2M16 20h2a2 2 0 002-2v-2" />
                    {/* Centered + sign */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6M12 9v6" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg hover:bg-error/10 text-error/70 hover:text-error transition-colors"
                  aria-label="Delete photo (Admin)"
                  title="Delete photo (Admin)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors ml-2"
              aria-label="Close slideshow"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Image Area */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-20 pt-24 pb-8 md:pb-28">
        {/* Previous Button */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0 && minLoadedPage === 1}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-bg/80 backdrop-blur-lg border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous photo"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Image */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={currentPhoto.id}
            src={currentPhoto.blob_url}
            alt={currentPhoto.original_filename || "Photo"}
            className="max-w-[90vw] max-h-[calc(100vh-12rem)] md:max-h-[calc(100vh-16rem)] object-contain rounded-lg shadow-2xl"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 80, damping: 20 },
              opacity: { duration: 0.4 },
            }}
          />
        </AnimatePresence>

        {/* Next Button */}
        <button
          onClick={goToNext}
          disabled={displayPosition >= totalCount}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-bg/80 backdrop-blur-lg border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next photo"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail Strip - hidden on mobile, shown on desktop */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 bg-bg/90 backdrop-blur-lg border-t border-white/5 py-3 px-6">
        <div
          ref={thumbnailStripRef}
          className="flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {allPhotos.map((photo, index) => {
            // Use freshly cropped URL if available, otherwise use stored thumbnail
            const thumbSrc = lastCroppedPhoto?.id === photo.id 
              ? lastCroppedPhoto.url 
              : (photo.thumbnail_url || photo.blob_url);
            return (
              <button
                key={`${photo.id}-${thumbSrc}`}
                ref={(el) => { thumbnailRefs.current[index] = el; }}
                onClick={() => goToIndex(index)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-opacity ${
                  index === currentIndex
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-black"
                    : "opacity-50 hover:opacity-75"
                }`}
                aria-label={`Go to photo ${index + 1}`}
              >
                <img
                  src={thumbSrc}
                  alt={photo.original_filename || `Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
          {/* Loading indicator at the end if more photos exist */}
          {allPhotos.length < totalCount && (
            <div className="shrink-0 w-16 h-16 rounded-lg bg-bg-elevated flex items-center justify-center">
              <svg className="animate-spin w-5 h-5 text-text-dim" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6">
          <div className="bg-bg-elevated rounded-xl p-6 max-w-md w-full border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-1">Delete Photo?</h3>
                <p className="text-text-muted text-sm">This action cannot be undone. The photo will be permanently removed from the gallery.</p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-lg text-sm bg-error text-white hover:bg-error-light transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete Photo"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {showCropModal && currentPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
          {/* Crop Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="font-semibold text-xl">Adjust Thumbnail Crop</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setCropError(null);
                }}
                disabled={isSavingCrop}
                className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                disabled={isSavingCrop || !croppedAreaPixels}
                className="bg-accent hover:bg-accent-light px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingCrop ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Crop"
                )}
              </button>
            </div>
          </div>

          {/* Crop Area */}
          <div className="flex-1 relative">
            <Cropper
              image={currentPhoto.blob_url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={true}
              cropShape="rect"
              objectFit="contain"
            />
          </div>

          {/* Crop Preview */}
          <div className="flex items-center justify-center gap-8 px-6 py-4 border-t border-white/10">
            <div className="text-center">
              <p className="text-xs tracking-widest uppercase text-text-dim mb-2">Preview</p>
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10">
                {cropPreviewUrl ? (
                  <img
                    src={cropPreviewUrl}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-bg-elevated flex items-center justify-center">
                    <span className="text-xs text-text-dim">...</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-text-dim mb-2">Zoom</p>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32 accent-accent"
              />
            </div>
            {cropError && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {cropError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
