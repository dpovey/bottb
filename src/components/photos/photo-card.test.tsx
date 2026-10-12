import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Photo } from '@/lib/db-types'
import { PhotoCard } from './photo-card'

vi.mock('@/lib/photo-hearts-client', () => ({
  isPhotoHeartedLocally: vi.fn(() => false),
  togglePhotoHeartRequest: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackPhotoHeart: vi.fn(),
}))

const makePhoto = (id: string) =>
  ({
    id,
    heart_count: 0,
    blob_url: `https://example.com/${id}/large.webp`,
    thumbnail_url: `https://example.com/${id}/thumbnail.webp`,
    original_filename: `${id}.jpg`,
    visibility: 'public',
  }) as unknown as Photo

const groupPhotos = [makePhoto('a'), makePhoto('b'), makePhoto('c')]

/** Holds the cluster index the way the gallery does, so cycling re-renders. */
function GroupedCard({ onOpen }: { onOpen: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  return (
    <PhotoCard
      photo={groupPhotos[0]}
      onClick={onOpen}
      cluster={{ photos: groupPhotos, currentIndex }}
      onCyclePhoto={setCurrentIndex}
    />
  )
}

describe('PhotoCard group button', () => {
  it('shows the position in the group and advances with wrap-around', async () => {
    const user = userEvent.setup()
    render(<GroupedCard onOpen={vi.fn()} />)

    const button = screen.getByRole('button', { name: /similar photos/i })
    expect(button.textContent).toBe('1/3')
    expect(button.getAttribute('aria-label')).toBe(
      'View 3 similar photos (currently 1 of 3)'
    )

    await user.click(button)
    expect(button.textContent).toBe('2/3')
    expect(button.getAttribute('aria-label')).toContain('currently 2 of 3')

    await user.click(button)
    expect(button.textContent).toBe('3/3')

    await user.click(button)
    expect(button.textContent).toBe('1/3')
  })

  it('does not open the photo when the group button is clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<GroupedCard onOpen={onOpen} />)

    await user.click(screen.getByRole('button', { name: /similar photos/i }))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows no group button for an ungrouped photo', () => {
    render(<PhotoCard photo={groupPhotos[0]} onClick={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /similar photos/i })).toBeNull()
  })
})
