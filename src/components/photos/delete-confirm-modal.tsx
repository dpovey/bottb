'use client'

import { useState } from 'react'
import { ConfirmModal } from '@/components/ui'
import { Photo } from '@/lib/db-types'

interface DeleteConfirmModalProps {
  isOpen: boolean
  photo: Photo
  onClose: () => void
  onConfirm: (photoId: string) => void
}

/**
 * Modal for confirming photo deletion.
 * Handles the API call and error state internally.
 */
export function DeleteConfirmModal({
  isOpen,
  photo,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete photo')
      }

      onConfirm(photo.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleDelete}
      title="Delete Photo?"
      message={
        error ||
        'This action cannot be undone. The photo will be permanently removed from the gallery.'
      }
      confirmLabel="Delete"
      cancelLabel="Cancel"
      isLoading={isDeleting}
      variant="danger"
    />
  )
}
