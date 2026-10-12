import { Skeleton } from '@/components/ui'
import {
  PHOTO_STRIP_TILE_CLASS,
  photoStripTileStyle,
} from '@/components/photos/photo-strip-tile'

export function EventCardSkeleton() {
  return <Skeleton className="aspect-4/3 rounded-lg" />
}

// A landscape/portrait mix, so the placeholder has the strip's rhythm.
const PHOTO_STRIP_SKELETON_ASPECTS = [1.5, 0.667, 1.5, 1.5, 0.667, 1.5]

/**
 * Placeholder for `PhotoStrip`. Tile sizes come from the strip's own row
 * classes so the skeleton and the loaded strip are the same height.
 */
export function PhotoStripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden px-2 py-3">
      {PHOTO_STRIP_SKELETON_ASPECTS.map((aspect, i) => (
        <Skeleton
          key={i}
          className={PHOTO_STRIP_TILE_CLASS}
          style={photoStripTileStyle(aspect)}
        />
      ))}
    </div>
  )
}

export function VideoStripSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-[280px] sm:w-[320px] shrink-0 aspect-video"
          />
        ))}
      </div>
    </>
  )
}

export function CompanyLogoMarqueeSkeleton() {
  return (
    <div className="flex items-center gap-16 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-32 shrink-0" />
      ))}
    </div>
  )
}
