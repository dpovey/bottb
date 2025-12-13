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
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close slideshow"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Photo counter - shows position in total */}
      <div className="absolute top-4 left-4 z-50 px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-2">
        <span>{displayPosition} / {totalCount}</span>
        {isLoadingMore && (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
      </div>

      {/* Admin buttons */}
      {isAdmin && (
        <div className="absolute top-4 right-16 z-50 flex gap-2">
          {/* Crop button */}
          <button
            onClick={() => setShowCropModal(true)}
            className="p-2 rounded-full bg-blue-600/80 text-white hover:bg-blue-600 transition-colors"
            aria-label="Adjust thumbnail crop"
            title="Adjust thumbnail crop"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M4 8V6a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M9 12h6M12 9v6" />
            </svg>
          </button>
          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-full bg-red-600/80 text-white hover:bg-red-600 transition-colors"
            aria-label="Delete photo"
            title="Delete photo"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Main image area - adjusted for thumbnail strip on desktop */}
      <div className="absolute inset-0 bottom-0 md:bottom-28 flex items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={currentPhoto.id}
            src={currentPhoto.blob_url}
            alt={currentPhoto.original_filename || "Photo"}
            className="absolute max-h-[75vh] md:max-h-[70vh] max-w-[90vw] object-contain"
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
      </div>

      {/* Navigation buttons */}
      <button
        onClick={goToPrevious}
        disabled={currentIndex === 0 && minLoadedPage === 1}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous photo"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={goToNext}
        disabled={displayPosition >= totalCount}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next photo"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Metadata overlay - shown on mobile, moved up on desktop */}
      <div className="absolute bottom-0 md:bottom-28 left-0 right-0 z-40 p-4 md:p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-3xl mx-auto">
          {currentPhoto.band_name && (
            <h2 className="text-xl md:text-2xl font-bold text-white">{currentPhoto.band_name}</h2>
          )}
          <div className="flex flex-wrap gap-3 md:gap-4 mt-1 md:mt-2 text-gray-300 text-xs md:text-sm">
            {currentPhoto.event_name && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {currentPhoto.event_name}
              </span>
            )}
            {currentPhoto.photographer && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {currentPhoto.photographer}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail strip - hidden on mobile, shown on desktop */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 z-50 bg-black/90 border-t border-gray-800">
        <div
          ref={thumbnailStripRef}
          className="flex gap-1 p-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
                className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden transition-all duration-200 ${
                  index === currentIndex
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-105"
                    : "opacity-60 hover:opacity-100"
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
            <div className="flex-shrink-0 w-20 h-20 rounded bg-gray-800 flex items-center justify-center">
              <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-600/20 rounded-full">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Delete Photo?</h3>
            </div>

            <p className="text-gray-300 mb-2">
              Are you sure you want to delete this photo?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              <strong>File:</strong> {currentPhoto?.original_filename || "Unknown"}
            </p>
            <p className="text-sm text-red-400 mb-6">
              This action cannot be undone. The photo will be permanently removed from storage and the database.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
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
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
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
        <div className="fixed inset-0 z-[60] bg-black">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <h3 className="text-lg font-semibold text-white">Adjust Thumbnail Crop</h3>
            <button
              onClick={() => {
                setShowCropModal(false);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCropError(null);
              }}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cropper */}
          <div className="absolute inset-0 top-16 bottom-32">
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

          {/* Preview & Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent">
            <div className="max-w-xl mx-auto">
              {/* Thumbnail previews */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-1">Current:</p>
                  <img
                    key={lastCroppedPhoto?.id === currentPhoto.id ? lastCroppedPhoto.url : currentPhoto.thumbnail_url}
                    src={lastCroppedPhoto?.id === currentPhoto.id 
                      ? lastCroppedPhoto.url 
                      : (currentPhoto.thumbnail_url || currentPhoto.blob_url)}
                    alt="Current thumbnail"
                    className="w-20 h-20 rounded object-cover border border-gray-600"
                  />
                </div>
                <div className="flex-shrink-0 flex flex-col items-center">
                  <span className="text-gray-500 text-xl">→</span>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs text-gray-400 mb-1">New preview:</p>
                  {cropPreviewUrl ? (
                    <img
                      src={cropPreviewUrl}
                      alt="Crop preview"
                      className="w-20 h-20 rounded object-cover border-2 border-blue-500"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded border border-gray-600 bg-gray-800 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Loading...</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 ml-2">
                  <p className="text-sm text-gray-300">
                    Drag to reposition the crop area.
                  </p>
                </div>
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-gray-400">Zoom:</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-400 w-12">{zoom.toFixed(1)}x</span>
              </div>

              {cropError && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {cropError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                    setCropError(null);
                  }}
                  disabled={isSavingCrop}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCrop}
                  disabled={isSavingCrop || !croppedAreaPixels}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
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
          </div>
        </div>
      )}
    </div>
  );
}
