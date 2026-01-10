'use client'

import { useCallback, useEffect, useState, useRef, memo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Autoplay, Navigation, Keyboard } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'
import { Photo } from '@/lib/db-types'
import { PhotoWithCluster } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { buildHeroSrcSet } from '@/lib/photo-srcset'
import { PhotoImage } from './photo-image'
import { CompanyIcon, VinylSpinner } from '@/components/ui'
import { ShareComposerModal } from './share-composer-modal'
import { HeroSettingsModal } from './hero-settings-modal'
import { EditMetadataModal } from './edit-metadata-modal'
import {
  trackPhotoDownload,
  trackPhotoShare,
  trackPhotoView,
} from '@/lib/analytics'
import {
  CameraIcon,
  CheckIcon,
  LinkIcon,
  DownloadIcon,
  ShareIcon,
  StarIcon,
  DeleteIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WarningIcon,
  PlayIcon,
  PauseIcon,
  EditIcon,
  LayersIcon,
} from '@/components/icons'
import { ShuffleButton } from './shuffle-button'
import { buildPhotoApiParams } from '@/lib/shuffle-types'

interface FilterNames {
  eventName?: string | null
  bandName?: string | null
  photographer?: string | null
  companyName?: string | null
}

interface PhotoSlideshowProps {
  photos: PhotoWithCluster[]
  initialIndex: number
  totalPhotos: number
  currentPage: number
  filters: {
    eventId?: string | null
    bandId?: string | null
    photographer?: string | null
    companySlug?: string | null
    shuffle?: string | null
  }
  filterNames?: FilterNames
  onClose: () => void
  onPhotoDeleted?: (photoId: string) => void
  onPhotoChange?: (photoId: string) => void
  onFilterChange?: (
    filterType: 'event' | 'band' | 'photographer' | 'company' | 'shuffle',
    value: string | null
  ) => void
  /** Display mode: 'modal' (fixed overlay) or 'page' (full page route) */
  mode?: 'modal' | 'page'
  /**
   * Initial cluster indexes to set on mount.
   * Map of representative photo ID -> cluster index.
   * Used when deep linking to a non-representative photo.
   */
  initialClusterIndexes?: Map<string, number>
}

const PAGE_SIZE = 50
const PREFETCH_THRESHOLD = 15 // Prefetch when within 15 photos of edge (gives time for network)
const PLAY_INTERVAL_MS = 3000 // 3 seconds between photos in play mode
const _SWIPE_THRESHOLD = 50 // Minimum horizontal swipe distance in pixels (reserved for future touch handling)

// Memoized thumbnail to prevent re-renders when other thumbnails' selection changes
const Thumbnail = memo(function Thumbnail({
  photo,
  index,
  isSelected,
  onClick,
}: {
  photo: Photo
  index: number
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-opacity ${
        isSelected
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg/90 opacity-100'
          : 'opacity-50 hover:opacity-75'
      }`}
      aria-label={`Go to photo ${index + 1}`}
    >
      <PhotoImage
        photo={photo}
        variant="thumbnail"
        sizes="64px"
        alt={photo.original_filename || `Photo ${index + 1}`}
        className="w-full h-full transition-transform duration-200 motion-safe:group-hover:scale-110"
        loading="eager"
      />
    </button>
  )
})

// Memoized slide with native lazy loading and responsive images
const Slide = memo(function Slide({
  photo,
  index,
  isPlaying,
  isMobile,
  clusterSize,
  clusterIndex,
  onCycleCluster,
}: {
  photo: Photo
  index: number
  isPlaying: boolean
  isMobile: boolean
  /** Total number of photos in the cluster (1 if not clustered) */
  clusterSize: number
  /** Current index within the cluster */
  clusterIndex: number
  /** Callback to cycle to next photo in cluster */
  onCycleCluster?: () => void
}) {
  const srcSet = buildHeroSrcSet(photo)
  const showClusterBadge = clusterSize > 1

  // On mobile (portrait or landscape) or during play mode: full bleed, no decorations
  // On tablet/desktop: constrained size with rounded corners and shadow
  const isMobileOrPlaying = isMobile || isPlaying

  // Track the image element to calculate rendered image bounds for badge positioning
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [badgePosition, setBadgePosition] = useState<{
    bottom: number
    right: number
  } | null>(null)

  // Calculate the actual rendered image bounds within the object-contain element
  const updateBadgePosition = useCallback(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return

    // Get the natural dimensions
    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    if (!naturalWidth || !naturalHeight) return

    // Get the element dimensions
    const elementWidth = img.clientWidth
    const elementHeight = img.clientHeight
    const containerRect = container.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()

    // Calculate the aspect ratios
    const naturalAspect = naturalWidth / naturalHeight
    const elementAspect = elementWidth / elementHeight

    // Calculate rendered image dimensions within object-contain
    let renderedWidth: number
    let renderedHeight: number
    if (naturalAspect > elementAspect) {
      // Image is wider - constrained by width
      renderedWidth = elementWidth
      renderedHeight = elementWidth / naturalAspect
    } else {
      // Image is taller - constrained by height
      renderedHeight = elementHeight
      renderedWidth = elementHeight * naturalAspect
    }

    // Calculate the offset from the element bounds to the rendered image bounds
    const horizontalPadding = (elementWidth - renderedWidth) / 2
    const verticalPadding = (elementHeight - renderedHeight) / 2

    // Calculate position relative to container
    const imgOffsetLeft = imgRect.left - containerRect.left
    const imgOffsetTop = imgRect.top - containerRect.top

    // Badge position: offset from container bottom-right to image bottom-right
    const right =
      containerRect.width - (imgOffsetLeft + elementWidth - horizontalPadding)
    const bottom =
      containerRect.height - (imgOffsetTop + elementHeight - verticalPadding)

    // Add a small margin from the edge (12px on mobile, 16px on desktop)
    const margin = window.innerWidth < 640 ? 12 : 16
    setBadgePosition({ bottom: bottom + margin, right: right + margin })
  }, [])

  // Update badge position when image loads or resizes
  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    // Update when image loads
    const handleLoad = () => updateBadgePosition()
    img.addEventListener('load', handleLoad)

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBadgePosition)
    resizeObserver.observe(img)

    // Initial calculation if image is already loaded
    if (img.complete) updateBadgePosition()

    return () => {
      img.removeEventListener('load', handleLoad)
      resizeObserver.disconnect()
    }
  }, [updateBadgePosition])

  // Handle badge click to cycle through cluster
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCycleCluster?.()
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={photo.blob_url}
        srcSet={srcSet}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
        alt={photo.original_filename || `Photo ${index + 1}`}
        className={`block object-contain ${
          isMobileOrPlaying
            ? 'w-full h-full'
            : 'max-w-[90%] max-h-full rounded-lg shadow-2xl'
        }`}
        draggable={false}
      />
      {/* Cluster badge - positioned at the actual image corner */}
      {showClusterBadge && !isPlaying && badgePosition && (
        <button
          onClick={handleBadgeClick}
          style={{ bottom: badgePosition.bottom, right: badgePosition.right }}
          className="absolute z-30 px-3 py-1.5 bg-black/70 backdrop-blur-xs rounded-lg flex items-center gap-2 text-white/90 hover:text-white hover:bg-black/80 transition-all cursor-pointer shadow-lg"
          title={`${clusterIndex + 1} of ${clusterSize} similar photos – click to cycle`}
          aria-label={`View ${clusterSize} similar photos (currently ${clusterIndex + 1} of ${clusterSize})`}
        >
          <LayersIcon size={16} />
          <span className="text-sm font-medium">
            {clusterIndex + 1}/{clusterSize}
          </span>
        </button>
      )}
    </div>
  )
})

export const PhotoSlideshow = memo(function PhotoSlideshow({
  photos: initialPhotos,
  initialIndex,
  totalPhotos,
  currentPage,
  filters,
  filterNames,
  onClose,
  onPhotoDeleted,
  onPhotoChange,
  onFilterChange,
  mode = 'modal',
  initialClusterIndexes,
}: PhotoSlideshowProps) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.isAdmin ?? false

  // Internal state for all loaded photos (representative photos with clusters)
  const [allPhotos, setAllPhotos] = useState<PhotoWithCluster[]>(initialPhotos)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [_direction, setDirection] = useState(0)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(
    new Set([currentPage])
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Cluster state: maps representative photo ID to current index within its cluster
  // Initialize from props if provided (for deep links to non-representative photos)
  const [clusterIndexMap, setClusterIndexMap] = useState<Map<string, number>>(
    () => initialClusterIndexes ?? new Map()
  )
  // Ref for debouncing URL updates (prevents navigation flooding when swiping fast)
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [totalCount, setTotalCount] = useState(totalPhotos)

  // Track the previous initialIndex to detect filter changes
  const prevInitialIndexRef = useRef(initialIndex)

  // Sync photos from parent without resetting position (e.g., after crop updates)
  useEffect(() => {
    setAllPhotos(initialPhotos)
  }, [initialPhotos])

  // Sync totalCount when parent's totalPhotos changes (e.g., after initial fetch completes)
  useEffect(() => {
    if (totalPhotos > 0 && totalCount === 0) {
      setTotalCount(totalPhotos)
    }
  }, [totalPhotos, totalCount])

  // Only reset position when filters change (indicated by initialIndex changing to 0)
  // This happens when parent explicitly resets slideshowIndex after a filter change
  useEffect(() => {
    if (prevInitialIndexRef.current !== initialIndex) {
      setCurrentIndex(initialIndex)
      setLoadedPages(new Set([currentPage]))
      setTotalCount(totalPhotos)
      setDirection(0)
      prevInitialIndexRef.current = initialIndex
      // Also sync Swiper to the new position
      if (swiperRef.current && swiperRef.current.activeIndex !== initialIndex) {
        swiperRef.current.slideTo(initialIndex, 0)
      }
    }
  }, [initialIndex, currentPage, totalPhotos])

  // Track photo views when photo changes (with minimum 1s view duration)
  useEffect(() => {
    const photo = allPhotos[currentIndex]
    if (!photo) return

    // Set a timer to track the view after 1 second
    // This ensures we only track intentional views, not accidental glimpses
    const viewTimer = setTimeout(() => {
      trackPhotoView({
        photo_id: photo.id,
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })
    }, 1000) // 1 second minimum view duration

    // Clean up timer if user navigates away before 1 second
    return () => {
      clearTimeout(viewTimer)
    }
  }, [currentIndex, allPhotos])

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Hero settings modal state (combined labels + focal point)
  const [showHeroSettingsModal, setShowHeroSettingsModal] = useState(false)

  // Link copy state
  const [linkCopied, setLinkCopied] = useState(false)

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false)

  // Metadata editing modal state (admin only)
  const [showMetadataModal, setShowMetadataModal] = useState(false)

  // Play mode state (Swiper Autoplay handles the interval)
  const [isPlaying, setIsPlaying] = useState(false)

  // Mobile controls state (will be implemented in UI update)
  const [_mobileControlsExpanded, _setMobileControlsExpanded] = useState(false)

  // Track if thumbnail strip should be hidden
  // Hidden when: width < 768px (md breakpoint) OR height < 500px (landscape mobile)
  const [thumbnailsHidden, setThumbnailsHidden] = useState(false)
  useEffect(() => {
    const checkThumbnails = () => {
      const isNarrow = window.innerWidth < 768
      const isShort = window.innerHeight < 500 // Landscape mobile
      setThumbnailsHidden(isNarrow || isShort)
    }
    checkThumbnails()
    window.addEventListener('resize', checkThumbnails)
    return () => window.removeEventListener('resize', checkThumbnails)
  }, [])

  // Touch/swipe state (reserved for future touch handling)
  const _touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // Swiper instance refs
  const swiperRef = useRef<SwiperType | null>(null)
  const thumbnailStripRef = useRef<HTMLDivElement>(null)
  const prevButtonRef = useRef<HTMLButtonElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch a specific page of photos
  // Uses buildPhotoApiParams for consistent behavior with gallery/photo-strip
  const fetchPage = useCallback(
    async (page: number): Promise<PhotoWithCluster[]> => {
      const params = buildPhotoApiParams({
        eventId: filters.eventId || undefined,
        bandId: filters.bandId || undefined,
        photographer: filters.photographer || undefined,
        companySlug: filters.companySlug || undefined,
        shuffle: filters.shuffle,
        page,
        limit: PAGE_SIZE,
        // groupTypes defaults to 'near_duplicate,scene'
      })

      const res = await fetch(`/api/photos?${params.toString()}`)
      if (!res.ok) return []

      const data = await res.json()
      setTotalCount(data.pagination.total)
      return data.photos
    },
    [filters]
  )

  // Load next page
  const loadNextPage = useCallback(async () => {
    const nextPage = Math.max(...Array.from(loadedPages)) + 1
    const maxPage = Math.ceil(totalCount / PAGE_SIZE)

    if (nextPage > maxPage || loadedPages.has(nextPage) || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const newPhotos = await fetchPage(nextPage)
      if (newPhotos.length > 0) {
        setAllPhotos((prev) => {
          // Deduplicate by filtering out photos that already exist
          const existingIds = new Set(prev.map((p) => p.id))
          const uniqueNewPhotos = newPhotos.filter(
            (p) => !existingIds.has(p.id)
          )
          return [...prev, ...uniqueNewPhotos]
        })
        setLoadedPages((prev) => new Set([...prev, nextPage]))
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [loadedPages, totalCount, isLoadingMore, fetchPage])

  // Load previous page
  const loadPrevPage = useCallback(async () => {
    const prevPage = Math.min(...Array.from(loadedPages)) - 1

    if (prevPage < 1 || loadedPages.has(prevPage) || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const newPhotos = await fetchPage(prevPage)
      if (newPhotos.length > 0) {
        // Use functional updates that compute added count correctly
        setAllPhotos((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const uniqueNewPhotos = newPhotos.filter(
            (p) => !existingIds.has(p.id)
          )
          // Also update currentIndex in the same render cycle
          if (uniqueNewPhotos.length > 0) {
            setCurrentIndex((prevIndex) => prevIndex + uniqueNewPhotos.length)
          }
          return [...uniqueNewPhotos, ...prev]
        })
        setLoadedPages((prev) => new Set([...prev, prevPage]))
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [loadedPages, isLoadingMore, fetchPage])

  // Aggressive initial load - load multiple pages until thumbnail strip is full
  // Each thumbnail is 64px + 12px gap = 76px, aim for 2x screen width
  useEffect(() => {
    // Skip if totalCount is 0 (not yet loaded from parent)
    if (totalCount === 0) return

    // Calculate minimum photos to fill thumbnail strip (2x viewport width)
    const minThumbnailPhotos = Math.ceil((window.innerWidth * 2) / 76)

    // Need more photos and there are more to load
    const needsMore = allPhotos.length < minThumbnailPhotos
    const hasMore = allPhotos.length < totalCount

    if (needsMore && hasMore && !isLoadingMore) {
      loadNextPage()
    }
  }, [allPhotos.length, totalCount, isLoadingMore, loadNextPage])

  // Check if we need to prefetch based on navigation
  useEffect(() => {
    // Near the end - load next page
    if (currentIndex >= allPhotos.length - PREFETCH_THRESHOLD) {
      loadNextPage()
    }
    // Near the beginning - load previous page
    if (currentIndex < PREFETCH_THRESHOLD) {
      loadPrevPage()
    }
  }, [currentIndex, allPhotos.length, loadNextPage, loadPrevPage])

  // Navigate to specific index
  const goToIndex = useCallback((index: number) => {
    if (!swiperRef.current) return
    if (index === swiperRef.current.activeIndex) return
    swiperRef.current.slideTo(index)
  }, [])

  const _goToNext = useCallback(() => {
    if (!swiperRef.current) return
    const current = swiperRef.current.activeIndex
    const canGoNext =
      current < allPhotos.length - 1 ||
      (isPlaying && current === allPhotos.length - 1)

    if (!canGoNext) return

    const nextIndex = current === allPhotos.length - 1 ? 0 : current + 1
    swiperRef.current.slideTo(nextIndex)
  }, [allPhotos.length, isPlaying])

  const _goToPrevious = useCallback(() => {
    if (!swiperRef.current) return
    if (swiperRef.current.isBeginning) return
    swiperRef.current.slidePrev()
  }, [])

  // Swiper autoplay control
  useEffect(() => {
    if (!swiperRef.current?.autoplay) return
    if (isPlaying) {
      swiperRef.current.autoplay.start()
    } else {
      swiperRef.current.autoplay.stop()
    }
  }, [isPlaying])

  // Initialize Swiper navigation after mount (refs are null during initial render)
  useEffect(() => {
    if (!swiperRef.current) return
    const swiper = swiperRef.current

    // Update navigation elements now that refs are populated
    if (
      swiper.params.navigation &&
      typeof swiper.params.navigation === 'object'
    ) {
      swiper.params.navigation.prevEl = prevButtonRef.current
      swiper.params.navigation.nextEl = nextButtonRef.current
    }

    // Re-initialize navigation
    if (swiper.navigation) {
      swiper.navigation.destroy()
      swiper.navigation.init()
      swiper.navigation.update()
    }
  }, [])

  // Stop play mode when modals open
  useEffect(() => {
    if (
      showDeleteConfirm ||
      showHeroSettingsModal ||
      showShareModal ||
      showMetadataModal
    ) {
      setIsPlaying(false)
    }
  }, [
    showDeleteConfirm,
    showHeroSettingsModal,
    showShareModal,
    showMetadataModal,
  ])

  // Toggle play mode
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
    _setMobileControlsExpanded(false) // Collapse mobile controls when toggling play
  }, [])

  // Generate a random seed for re-shuffle
  const generateRandomSeed = useCallback(() => {
    return Math.random().toString(36).substring(2, 10)
  }, [])

  // Handle shuffle toggle
  // - OFF → ON: generate new seed (reshuffle)
  // - ON → OFF: turn off shuffle
  const handleShuffleToggle = useCallback(() => {
    if (!onFilterChange) return

    if (!filters.shuffle) {
      // Turn on shuffle with new unique seed
      const newSeed = generateRandomSeed()
      onFilterChange('shuffle', newSeed)
    } else {
      // Turn off shuffle
      onFilterChange('shuffle', null)
    }
  }, [filters.shuffle, onFilterChange, generateRandomSeed])

  // Stop play mode (called on image click or manual navigation)
  const stopPlay = useCallback(() => {
    setIsPlaying(false)
  }, [])

  // Keyboard navigation (Swiper handles arrows, we handle Escape + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showDeleteConfirm ||
        showHeroSettingsModal ||
        showShareModal ||
        showMetadataModal
      )
        return // Don't navigate while modals are open
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      // Arrow keys stop autoplay on user interaction
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        stopPlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onClose,
    togglePlay,
    stopPlay,
    showDeleteConfirm,
    showHeroSettingsModal,
    showShareModal,
    showMetadataModal,
  ])

  // Sync Embla's selected slide with our currentIndex state
  // Embla is the source of truth - we read from it on 'select' event
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  // Store stopPlay in ref to avoid dependency array issues with hot reload
  const stopPlayRef = useRef(stopPlay)
  stopPlayRef.current = stopPlay

  // Swiper event handlers
  const handleSlideChange = useCallback((swiper: SwiperType) => {
    const index = swiper.activeIndex
    const current = currentIndexRef.current
    if (index !== current) {
      setDirection(index > current ? 1 : -1)
      setCurrentIndex(index)
    }
  }, [])

  const handleTouchStart = useCallback(() => {
    stopPlayRef.current()
  }, [])

  // Re-initialize Swiper when photos array changes
  const prevPhotoCountRef = useRef(allPhotos.length)
  useEffect(() => {
    if (!swiperRef.current) return
    if (prevPhotoCountRef.current === allPhotos.length) return
    prevPhotoCountRef.current = allPhotos.length

    // Swiper auto-updates, just ensure we're at the right position
    const currentPos = swiperRef.current.activeIndex
    if (currentPos < allPhotos.length) {
      swiperRef.current.slideTo(currentPos, 0)
    }
  }, [allPhotos.length])

  // Auto-scroll thumbnail strip to keep current thumbnail visible
  useEffect(() => {
    const strip = thumbnailStripRef.current
    if (!strip) return
    const thumb = strip.children[currentIndex] as HTMLElement | undefined
    if (thumb) {
      thumb.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [currentIndex])

  // Debounced URL update - prevents navigation flooding when swiping fast
  // Uses display photo (accounting for cluster cycling) for correct URL
  useEffect(() => {
    const repPhoto = allPhotos[currentIndex]
    if (!repPhoto) return

    // Get the actual display photo (may be different if cycling within cluster)
    const cluster = repPhoto.cluster_photos
    const clusterIdx = clusterIndexMap.get(repPhoto.id) ?? 0
    const displayPhoto =
      cluster && cluster.length > 1
        ? (cluster[clusterIdx] ?? repPhoto)
        : repPhoto

    // Clear any pending URL update
    if (urlUpdateTimeoutRef.current) {
      clearTimeout(urlUpdateTimeoutRef.current)
    }

    // Update URL after user stops navigating (500ms debounce)
    urlUpdateTimeoutRef.current = setTimeout(() => {
      if (onPhotoChange) {
        onPhotoChange(displayPhoto.id)
      }
    }, 500)

    return () => {
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current)
      }
    }
  }, [currentIndex, allPhotos, clusterIndexMap, onPhotoChange])

  // Handle photo deletion
  const handleDelete = async () => {
    const photoToDelete = allPhotos[currentIndex]
    if (!photoToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/photos/${photoToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete photo')
      }

      // Remove from local state
      setAllPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id))
      setTotalCount((prev) => prev - 1)

      // Notify parent component
      onPhotoDeleted?.(photoToDelete.id)

      // Close confirmation dialog
      setShowDeleteConfirm(false)

      // If this was the last photo, close the slideshow
      if (allPhotos.length <= 1) {
        onClose()
      } else if (currentIndex >= allPhotos.length - 1) {
        // If we deleted the last photo, go to previous
        setCurrentIndex(currentIndex - 1)
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle copying link to clipboard
  const handleCopyLink = async () => {
    try {
      // Copy current URL (which already has the photo param from URL sync)
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)

      // Track share
      const photo = allPhotos[currentIndex]
      if (photo) {
        trackPhotoShare({
          photo_id: photo.id,
          share_method: 'copy_link',
          event_id: photo.event_id || null,
          band_id: photo.band_id || null,
          event_name: photo.event_name || null,
          band_name: photo.band_name || null,
        })
      }
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  // Handle downloading high-res image
  const handleDownload = async () => {
    const photo = allPhotos[currentIndex]
    if (!photo) return

    try {
      // Fetch the image and trigger download
      const response = await fetch(photo.blob_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = photo.original_filename || `photo-${photo.id}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // Track download
      trackPhotoDownload({
        photo_id: photo.id,
        event_id: photo.event_id || null,
        band_id: photo.band_id || null,
        photographer: photo.photographer || null,
        event_name: photo.event_name || null,
        band_name: photo.band_name || null,
      })
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  // Handle hero settings save (both labels and focal point)
  const handleHeroSettingsSave = useCallback(
    (
      photoId: string,
      labels: string[],
      focalPoint: { x: number; y: number }
    ) => {
      // Update the photo in local state
      setAllPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, labels, hero_focal_point: focalPoint } : p
        )
      )
    },
    []
  )

  // Handle metadata update from EditMetadataModal
  const handleMetadataUpdated = useCallback(
    (updatedPhoto: Photo) => {
      // Update the photo in local state
      setAllPhotos((prev) =>
        prev.map((p) =>
          p.id === updatedPhoto.id
            ? {
                ...p,
                event_id: updatedPhoto.event_id,
                band_id: updatedPhoto.band_id,
                photographer: updatedPhoto.photographer,
                event_name: updatedPhoto.event_name,
                band_name: updatedPhoto.band_name,
                company_name: updatedPhoto.company_name,
                company_slug: updatedPhoto.company_slug,
                company_icon_url: updatedPhoto.company_icon_url,
                match_confidence: 'manual',
              }
            : p
        )
      )
      setShowMetadataModal(false)
    },
    [setAllPhotos]
  )

  // Get the representative photo at current slide index
  const currentRepPhoto = allPhotos[currentIndex]

  // Get the actual display photo (may be different if cycling within a cluster)
  const getDisplayPhoto = useCallback(
    (repPhoto: PhotoWithCluster | undefined): Photo | undefined => {
      if (!repPhoto) return undefined
      const cluster = repPhoto.cluster_photos
      if (!cluster || cluster.length <= 1) return repPhoto
      const clusterIdx = clusterIndexMap.get(repPhoto.id) ?? 0
      return cluster[clusterIdx] ?? repPhoto
    },
    [clusterIndexMap]
  )

  // Handle cycling through cluster photos
  const handleCycleCluster = useCallback(
    (repPhotoId: string) => {
      const repPhoto = allPhotos.find((p) => p.id === repPhotoId)
      if (!repPhoto?.cluster_photos || repPhoto.cluster_photos.length <= 1)
        return

      const currentClusterIdx = clusterIndexMap.get(repPhotoId) ?? 0
      const nextIdx = (currentClusterIdx + 1) % repPhoto.cluster_photos.length

      setClusterIndexMap((prev) => {
        const next = new Map(prev)
        next.set(repPhotoId, nextIdx)
        return next
      })

      // Update URL to reflect the new photo being viewed
      const newPhoto = repPhoto.cluster_photos[nextIdx]
      if (newPhoto && onPhotoChange) {
        onPhotoChange(newPhoto.id)
      }
    },
    [allPhotos, clusterIndexMap, onPhotoChange]
  )

  // The actual photo to display (accounting for cluster cycling)
  const currentPhoto = getDisplayPhoto(currentRepPhoto)

  // Container classes based on mode (used for both loading and main states)
  const loadingContainerClasses =
    mode === 'modal'
      ? 'fixed inset-0 z-50 bg-black flex items-center justify-center'
      : 'min-h-screen bg-black flex items-center justify-center relative'

  // Show loading state when photo hasn't loaded yet (e.g., deep link before photos fetch)
  if (!currentPhoto) {
    return (
      <div className={loadingContainerClasses}>
        <div className="text-white text-center">
          <VinylSpinner size="md" className="mx-auto mb-4" />
          <p className="text-gray-400">Loading photo...</p>
        </div>
        {/* Close/Back button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
          aria-label={mode === 'page' ? 'Go back' : 'Close slideshow'}
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>
    )
  }

  // Calculate display position accounting for potentially loaded previous pages
  const minLoadedPage = Math.min(...Array.from(loadedPages))
  const displayPosition = (minLoadedPage - 1) * PAGE_SIZE + currentIndex + 1

  // Container classes based on mode
  // overflow-hidden is critical to prevent horizontal scroll on mobile
  const containerClasses =
    mode === 'modal'
      ? 'fixed inset-0 z-50 bg-bg flex flex-col overflow-hidden'
      : 'min-h-screen bg-bg flex flex-col overflow-hidden'

  return (
    <div className={containerClasses}>
      {/* Top Bar - hidden during play mode */}
      <div
        className={`slideshow-topbar absolute top-0 left-0 right-0 z-10 bg-bg/80 backdrop-blur-lg border-b border-white/5 transition-all duration-300 overflow-hidden ${
          isPlaying
            ? 'opacity-0 pointer-events-none -translate-y-full'
            : 'opacity-100'
        }`}
      >
        <div className="slideshow-topbar-inner flex items-center justify-between px-2 sm:px-6 py-3 sm:py-4">
          {/* Photo Info */}
          <div className="shrink-0 min-w-0">
            {currentPhoto.band_name && currentPhoto.band_id ? (
              <Link
                href={`/band/${currentPhoto.band_id}`}
                className="slideshow-band-name font-medium text-lg hover:text-accent transition-colors block truncate"
              >
                {currentPhoto.band_name}
              </Link>
            ) : currentPhoto.band_name ? (
              <h2 className="slideshow-band-name font-medium text-lg truncate">
                {currentPhoto.band_name}
              </h2>
            ) : null}
            {/* Metadata: stacked on mobile portrait, horizontal on sm+ and landscape */}
            <div className="slideshow-info slideshow-meta text-sm text-text-muted flex flex-col sm:flex-row sm:items-center sm:gap-1">
              {/* Company and Event */}
              {(currentPhoto.company_name || currentPhoto.event_name) && (
                <span className="flex items-center gap-1 truncate">
                  {currentPhoto.company_name && currentPhoto.company_slug ? (
                    <Link
                      href={`/companies/${currentPhoto.company_slug}`}
                      className="flex items-center gap-1.5 truncate hover:text-accent transition-colors"
                    >
                      {currentPhoto.company_icon_url && (
                        <CompanyIcon
                          iconUrl={currentPhoto.company_icon_url}
                          companyName={currentPhoto.company_name}
                          size="xs"
                          showFallback={false}
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate">
                        {currentPhoto.company_name}
                      </span>
                    </Link>
                  ) : currentPhoto.company_name ? (
                    <span className="flex items-center gap-1.5 truncate">
                      {currentPhoto.company_icon_url && (
                        <CompanyIcon
                          iconUrl={currentPhoto.company_icon_url}
                          companyName={currentPhoto.company_name}
                          size="xs"
                          showFallback={false}
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate">
                        {currentPhoto.company_name}
                      </span>
                    </span>
                  ) : null}
                  {currentPhoto.company_name && currentPhoto.event_name && (
                    <span className="slideshow-separator hidden sm:inline">
                      •
                    </span>
                  )}
                  {currentPhoto.event_name && currentPhoto.event_id ? (
                    <Link
                      href={`/event/${currentPhoto.event_id}`}
                      className="truncate hover:text-accent transition-colors"
                    >
                      {currentPhoto.event_name}
                    </Link>
                  ) : currentPhoto.event_name ? (
                    <span className="truncate">{currentPhoto.event_name}</span>
                  ) : null}
                </span>
              )}
              {/* Photographer with camera icon */}
              {currentPhoto.photographer && (
                <span className="flex items-center gap-1.5">
                  <span className="slideshow-separator hidden sm:inline">
                    •
                  </span>
                  <CameraIcon size={16} className="shrink-0" />
                  <Link
                    href={`/photographer/${slugify(currentPhoto.photographer)}`}
                    className="truncate hover:text-accent transition-colors"
                  >
                    {currentPhoto.photographer}
                  </Link>
                </span>
              )}
            </div>
          </div>

          {/* Active Filter Pills */}
          {(filterNames?.companyName ||
            filterNames?.eventName ||
            filterNames?.bandName ||
            filterNames?.photographer) && (
            <div className="hidden md:flex flex-wrap gap-2 mx-4 flex-1 justify-center">
              {filterNames?.companyName && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
                  {filterNames.companyName}
                  {onFilterChange && (
                    <button
                      onClick={() => onFilterChange('company', null)}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove ${filterNames.companyName} filter`}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
              {filterNames?.eventName && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
                  {filterNames.eventName}
                  {onFilterChange && (
                    <button
                      onClick={() => onFilterChange('event', null)}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove ${filterNames.eventName} filter`}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
              {filterNames?.bandName && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
                  {filterNames.bandName}
                  {onFilterChange && (
                    <button
                      onClick={() => onFilterChange('band', null)}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove ${filterNames.bandName} filter`}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
              {filterNames?.photographer && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent/15 rounded-full text-xs text-accent">
                  {filterNames.photographer}
                  {onFilterChange && (
                    <button
                      onClick={() => onFilterChange('photographer', null)}
                      className="hover:text-white transition-colors"
                      aria-label={`Remove ${filterNames.photographer} filter`}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Counter & Controls - gap-2 on mobile, gap-4 on sm+ */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
              aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>

            {/* Shuffle Button */}
            <ShuffleButton
              isActive={!!filters.shuffle}
              onClick={handleShuffleToggle}
              size="sm"
            />

            {/* Photo counter - hidden on mobile */}
            <span className="hidden sm:inline-flex items-center text-sm text-text-muted">
              <span className="text-white font-medium">{displayPosition}</span>
              <span className="mx-1">/</span>
              <span>{totalCount}</span>
              {/* Show cluster indicator when viewing a grouped photo */}
              {currentRepPhoto?.cluster_photos &&
                currentRepPhoto.cluster_photos.length > 1 && (
                  <span className="ml-2 text-xs text-accent">
                    ({(clusterIndexMap.get(currentRepPhoto.id) ?? 0) + 1}/
                    {currentRepPhoto.cluster_photos.length} in group)
                  </span>
                )}
              {isLoadingMore && <VinylSpinner size="xxs" className="ml-2" />}
            </span>

            {/* Public Controls - available to everyone */}
            <div className="slideshow-controls flex items-center gap-1 sm:gap-2 pl-2 sm:pl-4 border-l border-white/10">
              <button
                onClick={handleCopyLink}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors relative"
                aria-label="Copy link to photo"
                title="Copy link"
              >
                {linkCopied ? (
                  <CheckIcon size={20} className="text-success" />
                ) : (
                  <LinkIcon size={20} />
                )}
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
                aria-label="Download high-resolution image"
                title="Download"
              >
                <DownloadIcon size={20} />
              </button>
            </div>

            {/* Admin Controls - accent colored to indicate admin-only, hidden on mobile */}
            {isAdmin && (
              <div className="slideshow-controls hidden sm:flex items-center gap-2 pl-4 border-l border-accent/30">
                {/* Edit Metadata Button */}
                <button
                  onClick={() => setShowMetadataModal(true)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors"
                  aria-label="Edit photo metadata (Admin)"
                  title="Edit (Admin)"
                >
                  <EditIcon size={20} />
                </button>
                {/* Share Button */}
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors"
                  aria-label="Share to social media (Admin)"
                  title="Share (Admin)"
                >
                  <ShareIcon size={20} />
                </button>
                <button
                  onClick={() => setShowHeroSettingsModal(true)}
                  className="p-2 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors relative"
                  aria-label="Hero settings - labels and focal point (Admin)"
                  title="Hero Settings (Admin)"
                >
                  <StarIcon size={20} />
                  {/* Indicator dot if photo has any hero labels */}
                  {currentPhoto?.labels && currentPhoto.labels.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg hover:bg-error/10 text-error/70 hover:text-error transition-colors"
                  aria-label="Delete photo (Admin)"
                  title="Delete photo (Admin)"
                >
                  <DeleteIcon size={20} />
                </button>
              </div>
            )}

            {/* Close / Back */}
            <button
              onClick={onClose}
              className="slideshow-close p-1.5 sm:p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors ml-1 sm:ml-2"
              aria-label={mode === 'page' ? 'Go back' : 'Close slideshow'}
              title={mode === 'page' ? 'Back' : 'Close'}
            >
              <CloseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Image Area - Embla Carousel */}
      <div
        ref={imageContainerRef}
        className="slideshow-main flex-1 relative"
        onClick={isPlaying ? stopPlay : undefined}
      >
        {/* Previous Button - Swiper Navigation (hidden during play mode) */}
        <button
          ref={prevButtonRef}
          onClick={stopPlay}
          className={`slideshow-nav absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-bg/80 backdrop-blur-lg border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all duration-300 z-20 disabled:opacity-30 disabled:cursor-not-allowed ${
            isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Previous photo"
        >
          <ChevronLeftIcon size={24} strokeWidth={2} />
        </button>

        {/* Swiper Carousel - using absolute positioning for fixed dimensions */}
        {/* When thumbnails hidden (mobile or landscape), photos use full height */}
        <div
          className="absolute left-0 right-0 overflow-hidden bg-bg"
          style={{
            top: isPlaying ? 0 : '4rem',
            bottom: isPlaying || thumbnailsHidden ? 0 : '7rem',
          }}
        >
          <Swiper
            modules={[Mousewheel, Autoplay, Navigation, Keyboard]}
            onSwiper={(swiper) => {
              swiperRef.current = swiper
            }}
            onSlideChange={handleSlideChange}
            onTouchStart={handleTouchStart}
            initialSlide={initialIndex}
            slidesPerView={1}
            // Mousewheel settings - aggressive thresholds to prevent double-fire
            mousewheel={{
              forceToAxis: true,
              sensitivity: 0.3,
              thresholdDelta: 50,
              thresholdTime: 600, // 600ms debounce between slides
              releaseOnEdges: true,
            }}
            // Lazy preloading (Swiper 9+ uses lazyPreloadPrevNext)
            lazyPreloadPrevNext={2}
            // Autoplay config (stopped on init, controlled via isPlaying state)
            autoplay={{
              delay: PLAY_INTERVAL_MS,
              disableOnInteraction: true,
              pauseOnMouseEnter: true,
              stopOnLastSlide: false,
            }}
            onInit={(swiper) => {
              // Stop autoplay immediately on init
              swiper.autoplay?.stop()
            }}
            // Navigation buttons
            navigation={{
              prevEl: prevButtonRef.current,
              nextEl: nextButtonRef.current,
            }}
            // Keyboard navigation - arrow keys to navigate slides
            keyboard={{
              enabled: true,
              onlyInViewport: true,
            }}
            onBeforeInit={(swiper) => {
              // Assign navigation elements before init
              if (typeof swiper.params.navigation === 'object') {
                swiper.params.navigation.prevEl = prevButtonRef.current
                swiper.params.navigation.nextEl = nextButtonRef.current
              }
            }}
            className="w-full h-full"
            style={{ overflow: 'hidden' }}
          >
            {allPhotos.map((repPhoto, index) => {
              const cluster = repPhoto.cluster_photos
              const clusterSize = cluster?.length ?? 1
              const clusterIdx = clusterIndexMap.get(repPhoto.id) ?? 0
              const displayPhoto =
                cluster && cluster.length > 1
                  ? (cluster[clusterIdx] ?? repPhoto)
                  : repPhoto

              return (
                <SwiperSlide key={repPhoto.id} className="!h-full">
                  <Slide
                    photo={displayPhoto}
                    index={index}
                    isPlaying={isPlaying}
                    isMobile={thumbnailsHidden}
                    clusterSize={clusterSize}
                    clusterIndex={clusterIdx}
                    onCycleCluster={() => handleCycleCluster(repPhoto.id)}
                  />
                </SwiperSlide>
              )
            })}
          </Swiper>
        </div>

        {/* Next Button - Swiper Navigation (hidden during play mode) */}
        <button
          ref={nextButtonRef}
          onClick={stopPlay}
          className={`slideshow-nav absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-bg/80 backdrop-blur-lg border border-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all duration-300 z-20 disabled:opacity-30 disabled:cursor-not-allowed ${
            isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Next photo"
        >
          <ChevronRightIcon size={24} strokeWidth={2} />
        </button>
      </div>

      {/* Thumbnail Strip - hidden on mobile, landscape, and during play mode */}
      <div
        className={`slideshow-thumbnails absolute bottom-0 left-0 right-0 bg-bg/90 backdrop-blur-lg border-t border-white/5 px-2 sm:px-6 transition-all duration-300 ${
          isPlaying || thumbnailsHidden
            ? 'opacity-0 pointer-events-none translate-y-full'
            : 'opacity-100'
        }`}
        style={{ display: thumbnailsHidden ? 'none' : 'block' }}
      >
        <div
          ref={thumbnailStripRef}
          className="flex gap-3 overflow-x-auto py-3 px-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {allPhotos.map((repPhoto, index) => {
            // Show the currently displayed photo from cluster in thumbnail
            const cluster = repPhoto.cluster_photos
            const clusterIdx = clusterIndexMap.get(repPhoto.id) ?? 0
            const displayPhoto =
              cluster && cluster.length > 1
                ? (cluster[clusterIdx] ?? repPhoto)
                : repPhoto

            return (
              <Thumbnail
                key={repPhoto.id}
                photo={displayPhoto}
                index={index}
                isSelected={index === currentIndex}
                onClick={() => goToIndex(index)}
              />
            )
          })}
          {/* Loading indicator at the end if more photos exist */}
          {allPhotos.length < totalCount && (
            <div className="shrink-0 w-16 h-16 rounded-lg bg-bg-elevated flex items-center justify-center">
              <VinylSpinner size="xs" className="text-text-dim" />
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-6">
          <div className="bg-bg-elevated rounded-xl p-6 max-w-md w-full border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center shrink-0">
                <WarningIcon size={24} className="text-error" />
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-1">Delete Photo?</h3>
                <p className="text-text-muted text-sm">
                  This action cannot be undone. The photo will be permanently
                  removed from the gallery.
                </p>
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
                  setShowDeleteConfirm(false)
                  setDeleteError(null)
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
                    <VinylSpinner size="xxs" />
                    Deleting...
                  </>
                ) : (
                  'Delete Photo'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Settings Modal (combined labels + focal point) */}
      {showHeroSettingsModal && currentPhoto && (
        <HeroSettingsModal
          isOpen={showHeroSettingsModal}
          photo={currentPhoto}
          onClose={() => setShowHeroSettingsModal(false)}
          onSave={handleHeroSettingsSave}
        />
      )}

      {/* Share to Social Modal */}
      {showShareModal && currentPhoto && (
        <ShareComposerModal
          photos={[currentPhoto]}
          onClose={() => setShowShareModal(false)}
          onSuccess={() => {
            // Optionally close after successful post
          }}
        />
      )}

      {/* Edit Metadata Modal (Admin only) */}
      {showMetadataModal && currentPhoto && (
        <EditMetadataModal
          isOpen={showMetadataModal}
          photo={currentPhoto}
          onClose={() => setShowMetadataModal(false)}
          onPhotoUpdated={handleMetadataUpdated}
        />
      )}
    </div>
  )
})
