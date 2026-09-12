'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Photo } from '@/lib/db-types'
import { PhotoIcon } from '@/components/icons'
import { Skeleton } from '@/components/ui'
import {
  computeJustifiedLayout,
  photoAspectRatio,
  type JustifiedRow,
} from '@/lib/justified-layout'
import { PhotoCard, type PhotoClusterData } from './photo-card'

export type GridSize = 'xs' | 'sm' | 'md' | 'lg'

/**
 * 'square' crops every photo to a uniform tile; 'justified' packs photos into
 * flush rows at their real aspect ratio (see `@/lib/justified-layout`).
 */
export type GridLayout = 'square' | 'justified'

// Grid classes for each size - designed for mobile-first
const gridClasses: Record<GridSize, string> = {
  xs: 'grid-cols-1 sm:grid-cols-2 gap-4', // 1 col mobile, 2 tablet+
  sm: 'grid-cols-2 sm:grid-cols-3 gap-3', // 2 col mobile, 3 tablet+
  md: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3', // Default
  lg: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2', // Compact
}

// Gaps matching the square grid's Tailwind gap classes, in pixels.
const gridGaps: Record<GridSize, number> = { xs: 16, sm: 12, md: 12, lg: 8 }

// Row height each size aims for. Deliberately not scaled down on narrow
// viewports: a phone-width row that aims lower ends up packing three photos,
// squeezing portraits into slivers. Holding the target means a phone shows
// paired portraits and full-width landscapes instead.
const targetRowHeights: Record<GridSize, number> = {
  xs: 460,
  sm: 340,
  md: 260,
  lg: 180,
}

// Stand-in width used only until the container has been measured.
const FALLBACK_WIDTH = 1024

/**
 * Map of photo ID to cluster data for grouped photos
 */
export type ClusterMap = Map<string, { photos: Photo[]; currentIndex: number }>

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick: (index: number) => void
  loading?: boolean
  size?: GridSize
  /** Tile shape: uniform squares, or justified rows at true aspect ratio */
  layout?: GridLayout
  showCompanyLogos?: boolean
  /** Map of photo IDs to their cluster data (for grouping similar photos) */
  clusterMap?: ClusterMap
  /** Callback when cycling through cluster photos */
  onCycleClusterPhoto?: (photoId: string, newIndex: number) => void
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  loading,
  size = 'md',
  layout = 'justified',
  showCompanyLogos = true,
  clusterMap,
  onCycleClusterPhoto,
}: PhotoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Falls back to a desktop width if the container reports none (first render
  // before the layout effect, or a hidden parent) so the gallery is never blank.
  const containerWidth = useContainerWidth(containerRef) || FALLBACK_WIDTH

  const gap = gridGaps[size]
  const targetRowHeight = targetRowHeights[size]

  // Aspect ratios come from the representative photo even when a cluster is
  // cycling, so flipping through a group doesn't reflow the whole row.
  const aspects = useMemo(() => photos.map(photoAspectRatio), [photos])

  const rows = useMemo(
    () =>
      layout === 'justified'
        ? computeJustifiedLayout(aspects, {
            containerWidth,
            targetRowHeight,
            gap,
          })
        : [],
    [layout, aspects, containerWidth, targetRowHeight, gap]
  )

  const renderCard = (photo: Photo, index: number, cardSize?: SizePx) => {
    const cluster = clusterMap?.get(photo.id)
    const clusterData: PhotoClusterData | undefined = cluster
      ? { photos: cluster.photos, currentIndex: cluster.currentIndex }
      : undefined

    return (
      <PhotoCard
        key={`${photo.id}-${photo.thumbnail_url}`}
        photo={photo}
        onClick={() => onPhotoClick(index)}
        showCompanyLogo={showCompanyLogos}
        size={cardSize}
        cluster={clusterData}
        onCyclePhoto={
          cluster && onCycleClusterPhoto
            ? (newIndex) => onCycleClusterPhoto(photo.id, newIndex)
            : undefined
        }
      />
    )
  }

  if (loading) {
    return (
      <div ref={containerRef}>
        {layout === 'justified' ? (
          <JustifiedSkeleton
            containerWidth={containerWidth}
            targetRowHeight={targetRowHeight}
            gap={gap}
          />
        ) : (
          <div className={`grid ${gridClasses[size]}`}>
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center mb-6">
          <PhotoIcon className="w-10 h-10 text-text-dim" />
        </div>
        <h2 className="font-semibold text-2xl mb-2">No photos found</h2>
        <p className="text-text-muted mb-6">
          Try adjusting your filters to see more photos
        </p>
      </div>
    )
  }

  if (layout === 'justified') {
    return (
      <div ref={containerRef}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={{
              gap,
              marginBottom: rowIndex === rows.length - 1 ? 0 : gap,
            }}
          >
            {row.items.map((item) =>
              renderCard(photos[item.index], item.index, {
                width: item.width,
                height: item.height,
              })
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`grid ${gridClasses[size]}`}>
      {photos.map((photo, index) => renderCard(photo, index))}
    </div>
  )
}

interface SizePx {
  width: number
  height: number
}

/**
 * Track an element's content width. Returns 0 until the first measurement.
 */
function useContainerWidth(
  ref: React.RefObject<HTMLDivElement | null>
): number {
  const [width, setWidth] = useState(0)

  // Measured before paint so the first painted frame is already correct.
  useLayoutEffect(() => {
    const element = ref.current
    if (element) setWidth(element.clientWidth)
  }, [ref])

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

/**
 * Placeholder rows laid out with the real algorithm over a repeating mix of
 * landscape and portrait ratios, so the skeleton matches the gallery's rhythm.
 */
const SKELETON_ASPECTS = [
  1.5, 0.667, 1.5, 1.5, 0.667, 1.78, 0.667, 1.5, 1.5, 0.8,
]

function JustifiedSkeleton({
  containerWidth,
  targetRowHeight,
  gap,
}: {
  containerWidth: number
  targetRowHeight: number
  gap: number
}) {
  const rows: JustifiedRow[] = computeJustifiedLayout(
    Array.from({ length: 20 }, (_, i) => SKELETON_ASPECTS[i % 10]),
    { containerWidth, targetRowHeight, gap }
  )

  return (
    <>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex"
          style={{ gap, marginBottom: rowIndex === rows.length - 1 ? 0 : gap }}
        >
          {row.items.map((item) => (
            <Skeleton
              key={item.index}
              className="shrink-0"
              style={{ width: item.width, height: item.height }}
            />
          ))}
        </div>
      ))}
    </>
  )
}
