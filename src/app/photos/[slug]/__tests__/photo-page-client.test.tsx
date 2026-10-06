import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Photo } from '@/lib/db-types'
import { PhotoPageClient } from '../photo-page-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))
vi.mock('@/components/photos/photo-admin-controls', () => ({
  PhotoAdminControls: () => null,
}))
vi.mock('@/components/photos/photo-share-button', () => ({
  PhotoShareButton: () => null,
}))
vi.mock('@/components/photos/heart-button', () => ({
  HeartButton: () => null,
}))

const { trackPhotoDownload, recordPhotoDownload } = vi.hoisted(() => ({
  trackPhotoDownload: vi.fn(),
  recordPhotoDownload: vi.fn(),
}))
vi.mock('@/lib/analytics', () => ({ trackPhotoDownload }))
vi.mock('@/lib/photo-hearts-client', () => ({ recordPhotoDownload }))

const photo = {
  id: 'photo-1',
  event_id: 'event-1',
  band_id: 'band-1',
  photographer: 'John Doe',
  blob_url: 'https://example.com/photos/photo-1/large.webp',
  original_blob_url: 'https://example.com/photos/photo-1/original.jpg',
  original_filename: 'IMG_0001.jpg',
  content_type: 'image/jpeg',
  event_name: 'Test Event',
  band_name: 'Test Band',
  download_count: 0,
} as Photo

describe('PhotoPageClient download', () => {
  const fetchMock = vi.fn()
  let downloads: string[]

  beforeEach(() => {
    fetchMock.mockResolvedValue({ blob: () => Promise.resolve(new Blob()) })
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    downloads = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches the original file and saves it under its original name', async () => {
    render(
      <PhotoPageClient
        photo={photo}
        h1Text="Test Band at Test Event"
        slideshowUrl="/slideshow"
        galleryUrl="/photos"
      />
    )

    await userEvent.click(
      screen.getByRole('button', { name: /download high-resolution/i })
    )

    await waitFor(() =>
      expect(recordPhotoDownload).toHaveBeenCalledWith('photo-1')
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/photos/photo-1/original.jpg'
    )
    expect(downloads).toEqual(['IMG_0001.jpg'])
    expect(trackPhotoDownload).toHaveBeenCalled()
  })
})
