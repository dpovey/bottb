import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeartButton } from './heart-button'
import { Photo } from '@/lib/db-types'
import {
  isPhotoHeartedLocally,
  togglePhotoHeartRequest,
} from '@/lib/photo-hearts-client'
import { trackPhotoHeart } from '@/lib/analytics'

vi.mock('@/lib/photo-hearts-client', () => ({
  isPhotoHeartedLocally: vi.fn(() => false),
  togglePhotoHeartRequest: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackPhotoHeart: vi.fn(),
}))

const mockIsHearted = isPhotoHeartedLocally as unknown as ReturnType<
  typeof vi.fn
>
const mockToggle = togglePhotoHeartRequest as unknown as ReturnType<
  typeof vi.fn
>
const mockTrack = trackPhotoHeart as unknown as ReturnType<typeof vi.fn>

const photo = {
  id: 'photo-1',
  heart_count: 3,
  event_id: 'event-1',
  band_id: 'band-1',
  photographer: 'Jane',
  event_name: 'Show',
  band_name: 'The Band',
} as unknown as Photo

describe('HeartButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsHearted.mockReturnValue(false)
  })

  it('renders the initial heart count', () => {
    render(<HeartButton photo={photo} />)
    expect(screen.getByRole('button', { name: /heart photo/i })).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('optimistically increments and reconciles with the server', async () => {
    mockToggle.mockResolvedValue({ hearted: true, heart_count: 4 })
    const user = userEvent.setup()

    render(<HeartButton photo={photo} />)
    const button = screen.getByRole('button', { name: /heart photo/i })

    await user.click(button)

    // Optimistic + server-confirmed count
    expect(screen.getByText('4')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove heart/i })).toBeTruthy()
    })
    expect(mockToggle).toHaveBeenCalledWith('photo-1')
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ photo_id: 'photo-1', hearted: true })
    )
  })

  it('reverts the optimistic update when the request fails', async () => {
    mockToggle.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()

    render(<HeartButton photo={photo} />)
    const button = screen.getByRole('button', { name: /heart photo/i })

    await user.click(button)

    await waitFor(() => {
      // Count reverts to the original value
      expect(screen.getByText('3')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /heart photo/i })).toBeTruthy()
  })

  it('reflects locally-remembered hearted state on mount', () => {
    mockIsHearted.mockReturnValue(true)
    render(<HeartButton photo={photo} />)
    expect(screen.getByRole('button', { name: /remove heart/i })).toBeTruthy()
  })
})
