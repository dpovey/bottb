'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Photo, PhotoVisibility } from '@/lib/db-types'
import { EditMetadataModal } from './edit-metadata-modal'
import { HeroSettingsModal } from './hero-settings-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { ShareComposerModal } from './share-composer-modal'
import {
  EditIcon,
  ShareIcon,
  StarIcon,
  DeleteIcon,
  GlobeIcon,
} from '@/components/icons'

interface PhotoAdminControlsProps {
  /** The photo to edit */
  photo: Photo
  /** Called when photo metadata is updated (receives the updated photo) */
  onPhotoUpdated?: (photo: Photo) => void
  /** Called when photo labels are updated */
  onLabelsUpdated?: (photoId: string, labels: string[]) => void
  /** Called when photo is deleted */
  onPhotoDeleted?: (photoId: string) => void
  /** Visual variant - toolbar for slideshow header, inline for photo page */
  variant?: 'toolbar' | 'inline'
  /** Custom class name */
  className?: string
}

/**
 * Admin controls for managing a single photo.
 * Includes: Edit Metadata, Share, Hero Settings, Delete
 * Only renders for admin users.
 */
export function PhotoAdminControls({
  photo,
  onPhotoUpdated,
  onLabelsUpdated,
  onPhotoDeleted,
  variant = 'toolbar',
  className = '',
}: PhotoAdminControlsProps) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.isAdmin ?? false

  // Modal states
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showHeroSettingsModal, setShowHeroSettingsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Track current photo state (for labels indicator)
  const [currentLabels, setCurrentLabels] = useState<string[]>(
    photo.labels || []
  )

  // Track visibility so the toggle reflects state without a full refresh
  const [visibility, setVisibility] = useState<PhotoVisibility>(
    photo.visibility
  )
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  const isPublic = visibility === 'public'

  // Toggle private <-> public via the photo PATCH endpoint
  const handleToggleVisibility = async () => {
    const next: PhotoVisibility = isPublic ? 'private' : 'public'
    setIsTogglingVisibility(true)
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
      if (res.ok) {
        setVisibility(next)
        if (onPhotoUpdated) {
          onPhotoUpdated({ ...photo, visibility: next })
        }
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error)
    } finally {
      setIsTogglingVisibility(false)
    }
  }

  // Handle hero settings save (both labels and focal point)
  const handleHeroSettingsSave = (
    photoId: string,
    labels: string[],
    focalPoint: { x: number; y: number }
  ) => {
    setCurrentLabels(labels)

    if (onLabelsUpdated) {
      onLabelsUpdated(photoId, labels)
    }

    if (onPhotoUpdated) {
      onPhotoUpdated({
        ...photo,
        labels,
        hero_focal_point: focalPoint,
      })
    }
  }

  // Handle photo deleted
  const handlePhotoDeleted = (photoId: string) => {
    if (onPhotoDeleted) {
      onPhotoDeleted(photoId)
    }
  }

  // Don't render if not admin
  if (!isAdmin) {
    return null
  }

  const buttonBaseClass =
    variant === 'toolbar'
      ? 'p-2 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors'
      : 'p-2.5 rounded-lg hover:bg-accent/10 text-accent/70 hover:text-accent transition-colors border border-accent/20'

  const deleteButtonClass =
    variant === 'toolbar'
      ? 'p-2 rounded-lg hover:bg-error/10 text-error/70 hover:text-error transition-colors'
      : 'p-2.5 rounded-lg hover:bg-error/10 text-error/70 hover:text-error transition-colors border border-error/20'

  // Visibility toggle colour follows state: green when public, amber when private
  const visibilityButtonClass = isPublic
    ? variant === 'toolbar'
      ? 'p-2 rounded-lg hover:bg-success/10 text-success/70 hover:text-success transition-colors'
      : 'p-2.5 rounded-lg hover:bg-success/10 text-success/70 hover:text-success transition-colors border border-success/20'
    : variant === 'toolbar'
      ? 'p-2 rounded-lg hover:bg-warning/10 text-warning/80 hover:text-warning transition-colors'
      : 'p-2.5 rounded-lg hover:bg-warning/10 text-warning/80 hover:text-warning transition-colors border border-warning/20'

  const containerClass =
    variant === 'toolbar'
      ? `hidden sm:flex items-center gap-2 pl-4 border-l border-accent/30 ${className}`
      : `flex items-center gap-2 ${className}`

  return (
    <>
      <div className={containerClass}>
        {/* Edit Metadata Button */}
        <button
          onClick={() => setShowMetadataModal(true)}
          className={buttonBaseClass}
          aria-label="Edit photo metadata (Admin)"
          title="Edit (Admin)"
        >
          <EditIcon size={20} />
        </button>

        {/* Share Button */}
        <button
          onClick={() => setShowShareModal(true)}
          className={buttonBaseClass}
          aria-label="Share to social media (Admin)"
          title="Share (Admin)"
        >
          <ShareIcon size={20} />
        </button>

        {/* Hero Settings Button (combined labels + focal point) */}
        <button
          onClick={() => setShowHeroSettingsModal(true)}
          className={`${buttonBaseClass} relative`}
          aria-label="Hero settings - labels and focal point (Admin)"
          title="Hero Settings (Admin)"
        >
          <StarIcon size={20} />
          {/* Indicator dot if photo has any hero labels */}
          {currentLabels.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full" />
          )}
        </button>

        {/* Visibility Toggle (private <-> public) */}
        <button
          onClick={handleToggleVisibility}
          disabled={isTogglingVisibility}
          className={`${visibilityButtonClass} relative disabled:opacity-50`}
          aria-label={
            isPublic
              ? 'Make photo private (Admin)'
              : 'Make photo public (Admin)'
          }
          title={
            isPublic
              ? 'Public — click to make private (Admin)'
              : 'Private — click to make public (Admin)'
          }
        >
          <GlobeIcon size={20} />
          {/* Amber dot flags an unreleased (private) photo */}
          {!isPublic && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-warning rounded-full" />
          )}
        </button>

        {/* Delete Button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className={deleteButtonClass}
          aria-label="Delete photo (Admin)"
          title="Delete photo (Admin)"
        >
          <DeleteIcon size={20} />
        </button>
      </div>

      {/* Edit Metadata Modal */}
      {showMetadataModal && (
        <EditMetadataModal
          isOpen={showMetadataModal}
          photo={photo}
          onClose={() => setShowMetadataModal(false)}
          onPhotoUpdated={(updatedPhoto) => {
            if (onPhotoUpdated) {
              onPhotoUpdated(updatedPhoto)
            }
            setShowMetadataModal(false)
          }}
        />
      )}

      {/* Share to Social Modal */}
      {showShareModal && (
        <ShareComposerModal
          photos={[photo]}
          onClose={() => setShowShareModal(false)}
          onSuccess={() => {
            // Could close after successful post if desired
          }}
        />
      )}

      {/* Hero Settings Modal (combined labels + focal point) */}
      {showHeroSettingsModal && (
        <HeroSettingsModal
          isOpen={showHeroSettingsModal}
          photo={photo}
          onClose={() => setShowHeroSettingsModal(false)}
          onSave={handleHeroSettingsSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          photo={photo}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handlePhotoDeleted}
        />
      )}
    </>
  )
}
