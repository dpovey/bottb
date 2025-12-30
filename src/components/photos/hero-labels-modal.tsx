'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui'
import { Photo, PHOTO_LABELS } from '@/lib/db-types'
import { CheckIcon } from '@/components/icons'
import { VinylSpinner } from '@/components/ui'

// Label display info
const LABEL_INFO = {
  [PHOTO_LABELS.BAND_HERO]: {
    name: 'Band Hero',
    description: 'Featured on band page',
    icon: '🎸',
  },
  [PHOTO_LABELS.EVENT_HERO]: {
    name: 'Event Hero',
    description: 'Featured on event page',
    icon: '🎪',
  },
  [PHOTO_LABELS.GLOBAL_HERO]: {
    name: 'Global Hero',
    description: 'Featured on home page',
    icon: '🏠',
  },
} as const

interface HeroLabelsModalProps {
  isOpen: boolean
  photo: Photo
  onClose: () => void
  onLabelsUpdated: (photoId: string, labels: string[]) => void
}

/**
 * Modal for managing hero labels on a photo.
 * Allows admins to set which pages a photo should be featured on.
 *
 * Note: Focal point editing is now handled separately via the FocalPointEditor component.
 */
export function HeroLabelsModal({
  isOpen,
  photo,
  onClose,
  onLabelsUpdated,
}: HeroLabelsModalProps) {
  const [labels, setLabels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingLabels, setIsSavingLabels] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch labels when modal opens
  useEffect(() => {
    if (!isOpen || !photo) return

    const fetchLabels = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/photos/${photo.id}/labels`)
        if (!response.ok) throw new Error('Failed to fetch labels')
        const data = await response.json()
        setLabels(data.labels || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load labels')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLabels()
  }, [isOpen, photo])

  // Toggle a label
  const handleToggleLabel = async (label: string) => {
    const newLabels = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label]

    setIsSavingLabels(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: newLabels }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update labels')
      }

      const result = await response.json()
      setLabels(result.labels)
      onLabelsUpdated(photo.id, result.labels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSavingLabels(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hero Labels"
      description="Select where this photo should be featured."
      size="md"
      disabled={isSavingLabels}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <VinylSpinner size="xs" className="text-text-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {Object.entries(LABEL_INFO).map(([label, info]) => (
              <button
                key={label}
                onClick={() => handleToggleLabel(label)}
                disabled={isSavingLabels}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  labels.includes(label)
                    ? 'border-accent bg-accent/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <span className="text-2xl">{info.icon}</span>
                <div className="flex-1 text-left">
                  <span className="font-medium">{info.name}</span>
                  <span className="text-sm text-text-muted block">
                    {info.description}
                  </span>
                </div>
                {labels.includes(label) && (
                  <CheckIcon size={20} className="text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
