/**
 * Smart crop utilities for social media posts.
 * Fetches intelligent crop boxes from the photo intelligence pipeline.
 */

import type { Photo } from '@/lib/db-types'

export interface SmartCropInfo {
  photo_id: string
  aspect_ratio: string
  crop_box: { x: number; y: number; width: number; height: number }
  confidence: number
  method: 'face' | 'person' | 'saliency' | 'manual'
}

/**
 * Get smart crop for a photo and aspect ratio.
 * Falls back to null if not available.
 */
export async function getSmartCropForPhoto(
  photoId: string,
  aspectRatio: string = '4:5'
): Promise<SmartCropInfo | null> {
  try {
    const response = await fetch(
      `/api/photos/${photoId}/smart-crop?aspect=${aspectRatio}`
    )
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching smart crop:', error)
    return null
  }
}

/**
 * Get smart crops for multiple photos.
 * Returns a map of photo_id -> crop info.
 */
export async function getSmartCropsForPhotos(
  photos: Photo[],
  aspectRatio: string = '4:5'
): Promise<Record<string, SmartCropInfo>> {
  const crops: Record<string, SmartCropInfo> = {}

  await Promise.all(
    photos.map(async (photo) => {
      const crop = await getSmartCropForPhoto(photo.id, aspectRatio)
      if (crop) {
        crops[photo.id] = crop
      }
    })
  )

  return crops
}

/**
 * Convert smart crop to Instagram crop format.
 * Instagram expects crop info in a specific format.
 */
export function smartCropToInstagramFormat(crop: SmartCropInfo): {
  x: number
  y: number
  width: number
  height: number
} {
  return {
    x: crop.crop_box.x,
    y: crop.crop_box.y,
    width: crop.crop_box.width,
    height: crop.crop_box.height,
  }
}
