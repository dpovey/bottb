import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Photo } from '@/lib/db-types'
import { PhotoStrip } from '../photo-strip'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/analytics', () => ({
  trackPhotoClick: vi.fn(),
}))

const makePhoto = (
  id: string,
  width: number | null,
  height: number | null
): Photo =>
  ({
    id,
    slug: `photo-${id}`,
    width,
    height,
    blob_url: `https://example.com/${id}/large.webp`,
    thumbnail_url: `https://example.com/${id}/thumbnail.webp`,
    original_filename: `${id}.jpg`,
    hero_focal_point: { x: 30, y: 70 },
  }) as unknown as Photo

const photos = [
  makePhoto('landscape', 3000, 2000),
  makePhoto('portrait', 2000, 3000),
  makePhoto('unknown', null, null),
]

vi.mock('@/lib/hooks/use-shuffled-photos', () => ({
  useShuffledPhotos: () => ({
    photos,
    totalCount: photos.length,
    shuffle: { seed: null },
    loading: false,
    loadingMore: false,
    loadMore: vi.fn(),
    hasMore: false,
    buildPhotoUrl: (slug: string) => `/slideshow/${slug}`,
  }),
}))

describe('PhotoStrip', () => {
  beforeEach(() => push.mockClear())

  it('sizes each tile from its photo aspect ratio', () => {
    render(<PhotoStrip />)
    const [landscape, portrait] = screen.getAllByRole('option')

    expect(landscape.style.getPropertyValue('--tile-aspect')).toBe('1.5')
    expect(
      Number(portrait.style.getPropertyValue('--tile-aspect'))
    ).toBeCloseTo(2 / 3)
    expect(landscape.querySelector('img')?.getAttribute('sizes')).toBe(
      '(max-width: 639px) 240px, (max-width: 767px) 312px, 360px'
    )
  })

  it('falls back to a focal-point square crop when dimensions are missing', () => {
    render(<PhotoStrip />)
    const unknown = screen.getAllByRole('option')[2]
    const img = unknown.querySelector('img')

    expect(unknown.style.getPropertyValue('--tile-aspect')).toBe('1')
    expect(img?.className).toContain('object-cover')
    expect(img?.style.objectPosition).toBe('30% 70%')
  })

  it('still opens the photo when a tile is clicked', async () => {
    const user = userEvent.setup()
    render(<PhotoStrip />)

    await user.click(screen.getAllByRole('option')[1])
    expect(push).toHaveBeenCalledWith('/slideshow/photo-portrait')
  })
})
