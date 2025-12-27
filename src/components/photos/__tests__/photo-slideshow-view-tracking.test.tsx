import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PhotoSlideshow } from '../photo-slideshow'
import type { Photo } from '@/lib/db'

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  trackPhotoView: vi.fn(),
  trackPhotoDownload: vi.fn(),
  trackPhotoShare: vi.fn(),
}))

// Mock Embla carousel with a simpler approach
const mockEmblaApi = {
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  selectedScrollSnap: vi.fn().mockReturnValue(0),
  scrollTo: vi.fn(),
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
  canScrollPrev: vi.fn().mockReturnValue(false),
  canScrollNext: vi.fn().mockReturnValue(true),
  slideNodes: vi.fn().mockReturnValue([]),
  slidesInView: vi.fn().mockReturnValue([0]),
  reInit: vi.fn(),
}

vi.mock('embla-carousel-react', () => ({
  default: vi.fn(() => [vi.fn(), mockEmblaApi]),
}))

// Mock Embla wheel gestures plugin
vi.mock('embla-carousel-wheel-gestures', () => ({
  WheelGesturesPlugin: vi.fn(() => ({})),
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img {...props} alt="" />
    ),
    button: ({
      children,
      ...props
    }: {
      children: React.ReactNode
    } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock react-easy-crop
vi.mock('react-easy-crop', () => ({
  default: ({
    onCropComplete,
  }: {
    image: string
    crop: { x: number; y: number }
    onCropChange: (crop: { x: number; y: number }) => void
    onCropComplete: (area: {
      x: number
      y: number
      width: number
      height: number
    }) => void
  }) => (
    <div data-testid="cropper">
      <button
        onClick={() => onCropComplete({ x: 0, y: 0, width: 100, height: 100 })}
      >
        Complete Crop
      </button>
    </div>
  ),
  Area: {},
}))

// Mock ShareComposerModal
vi.mock('../share-composer-modal', () => ({
  ShareComposerModal: ({ isOpen }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="share-modal">Share Modal</div> : null,
}))

// Mock UI components
vi.mock('@/components/ui', () => ({
  CompanyIcon: () => <div data-testid="company-icon">Company</div>,
}))

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

// Mock scrollIntoView for DOM elements
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// TODO: Fix Embla carousel mocking - currently crashes test runner
describe.skip('PhotoSlideshow - View Tracking', () => {
  const mockPhotos: Photo[] = [
    {
      id: 'photo1',
      blob_url: 'https://example.com/photo1.jpg',
      blob_pathname: '/photo1.jpg',
      original_blob_url: null,
      original_filename: 'photo1.jpg',
      thumbnail_url: 'https://example.com/photo1-thumb.jpg',
      event_id: 'event1',
      band_id: 'band1',
      event_name: 'Test Event',
      band_name: 'Test Band',
      photographer: 'Test Photographer',
      width: 1920,
      height: 1080,
      file_size: 1000000,
      content_type: 'image/jpeg',
      xmp_metadata: null,
      matched_event_name: null,
      matched_band_name: null,
      match_confidence: null,
      uploaded_by: null,
      uploaded_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      captured_at: null,
      labels: [],
      hero_focal_point: { x: 0.5, y: 0.5 },
    },
    {
      id: 'photo2',
      blob_url: 'https://example.com/photo2.jpg',
      blob_pathname: '/photo2.jpg',
      original_blob_url: null,
      original_filename: 'photo2.jpg',
      thumbnail_url: 'https://example.com/photo2-thumb.jpg',
      event_id: 'event1',
      band_id: 'band2',
      event_name: 'Test Event',
      band_name: 'Test Band 2',
      photographer: 'Test Photographer',
      width: 1920,
      height: 1080,
      file_size: 1000000,
      content_type: 'image/jpeg',
      xmp_metadata: null,
      matched_event_name: null,
      matched_band_name: null,
      match_confidence: null,
      uploaded_by: null,
      uploaded_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      captured_at: null,
      labels: [],
      hero_focal_point: { x: 0.5, y: 0.5 },
    },
  ]

  const defaultProps = {
    photos: mockPhotos,
    initialIndex: 0,
    totalPhotos: 2,
    currentPage: 1,
    filters: {},
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should track photo view after 1 second when photo is displayed', async () => {
    const { trackPhotoView } = await import('@/lib/analytics')

    render(<PhotoSlideshow {...defaultProps} />)

    // Fast-forward 1 second
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(trackPhotoView).toHaveBeenCalledTimes(1)
    expect(trackPhotoView).toHaveBeenCalledWith({
      photo_id: 'photo1',
      event_id: 'event1',
      band_id: 'band1',
      event_name: 'Test Event',
      band_name: 'Test Band',
    })
  })

  it('should NOT track photo view if user navigates away before 1 second', async () => {
    const { trackPhotoView } = await import('@/lib/analytics')

    const { rerender } = render(<PhotoSlideshow {...defaultProps} />)

    // Fast-forward 500ms (less than 1 second)
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Change to next photo (simulating navigation)
    rerender(<PhotoSlideshow {...defaultProps} initialIndex={1} />)

    // Fast-forward another 1 second
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    // Should only track the second photo, not the first
    expect(trackPhotoView).toHaveBeenCalledTimes(1)
    expect(trackPhotoView).toHaveBeenCalledWith({
      photo_id: 'photo2',
      event_id: 'event1',
      band_id: 'band2',
      event_name: 'Test Event',
      band_name: 'Test Band 2',
    })
  })

  it('should track each photo view separately when navigating between photos', async () => {
    const { trackPhotoView } = await import('@/lib/analytics')

    const { rerender } = render(<PhotoSlideshow {...defaultProps} />)

    // Wait 1 second for first photo
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(trackPhotoView).toHaveBeenCalledTimes(1)
    expect(trackPhotoView).toHaveBeenCalledWith(
      expect.objectContaining({ photo_id: 'photo1' })
    )

    // Navigate to second photo
    rerender(<PhotoSlideshow {...defaultProps} initialIndex={1} />)

    // Wait 1 second for second photo
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(trackPhotoView).toHaveBeenCalledTimes(2)
    expect(trackPhotoView).toHaveBeenCalledWith(
      expect.objectContaining({ photo_id: 'photo2' })
    )
  })

  it('should handle null event_id and band_id correctly', async () => {
    const { trackPhotoView } = await import('@/lib/analytics')

    const photoWithoutIds: Photo[] = [
      {
        id: 'photo3',
        blob_url: 'https://example.com/photo3.jpg',
        blob_pathname: '/photo3.jpg',
        original_blob_url: null,
        original_filename: 'photo3.jpg',
        thumbnail_url: 'https://example.com/photo3-thumb.jpg',
        event_id: null,
        band_id: null,
        photographer: null,
        width: 1920,
        height: 1080,
        file_size: 1000000,
        content_type: 'image/jpeg',
        xmp_metadata: null,
        matched_event_name: null,
        matched_band_name: null,
        match_confidence: null,
        uploaded_by: null,
        uploaded_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        captured_at: null,
        labels: [],
        hero_focal_point: { x: 0.5, y: 0.5 },
      },
    ]

    render(
      <PhotoSlideshow
        {...defaultProps}
        photos={photoWithoutIds}
        initialIndex={0}
      />
    )

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(trackPhotoView).toHaveBeenCalledWith({
      photo_id: 'photo3',
      event_id: null,
      band_id: null,
      event_name: null,
      band_name: null,
    })
  })
})
