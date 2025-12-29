'use client'

import { useState } from 'react'
import { PhotographerWithStats } from '@/lib/db-types'
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  PlusIcon,
  CameraIcon,
} from '@/components/icons'
import { VinylSpinner } from '@/components/ui'

interface PhotographerAdminClientProps {
  initialPhotographers: PhotographerWithStats[]
}

export function PhotographerAdminClient({
  initialPhotographers,
}: PhotographerAdminClientProps) {
  const [photographers, setPhotographers] =
    useState<PhotographerWithStats[]>(initialPhotographers)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newInstagram, setNewInstagram] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper to generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/photographers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: newSlug || generateSlug(newName),
          bio: newBio || null,
          location: newLocation || null,
          website: newWebsite || null,
          instagram: newInstagram || null,
          email: newEmail || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPhotographers([
          ...photographers,
          { ...data.photographer, photo_count: 0 },
        ])
        resetForm()
        setIsAdding(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add photographer')
      }
    } catch (err) {
      setError('Failed to add photographer')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (
    slug: string,
    updates: {
      name?: string
      bio?: string | null
      location?: string | null
      website?: string | null
      instagram?: string | null
      email?: string | null
    }
  ) => {
    try {
      const response = await fetch(`/api/photographers/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setPhotographers(
          photographers.map((p) =>
            p.slug === slug ? { ...p, ...data.photographer } : p
          )
        )
        return true
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update photographer')
        return false
      }
    } catch (err) {
      alert('Failed to update photographer')
      console.error(err)
      return false
    }
  }

  const handleDelete = async (slug: string) => {
    const photographer = photographers.find((p) => p.slug === slug)
    if (!photographer) return

    if (
      !confirm(
        `Are you sure you want to delete "${photographer.name}"? This cannot be undone.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/photographers/${slug}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPhotographers(photographers.filter((p) => p.slug !== slug))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete photographer')
      }
    } catch (err) {
      alert('Failed to delete photographer')
      console.error(err)
    }
  }

  const resetForm = () => {
    setNewName('')
    setNewSlug('')
    setNewBio('')
    setNewLocation('')
    setNewWebsite('')
    setNewInstagram('')
    setNewEmail('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsAdding(true)}
          className="bg-accent hover:bg-accent-light text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusIcon size={20} />
          Add Photographer
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="bg-elevated rounded-2xl p-6 border border-white/5">
          <h2 className="text-xl font-bold text-white mb-4">
            Add New Photographer
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Slug (URL-friendly ID)
                </label>
                <input
                  type="text"
                  value={newSlug || generateSlug(newName)}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="auto-generated from name"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Short biography..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g., Sydney, Australia"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={newInstagram}
                  onChange={(e) => setNewInstagram(e.target.value)}
                  placeholder="@username"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="contact@..."
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent hover:bg-accent-light text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Photographer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  resetForm()
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Photographers List */}
      <div className="bg-elevated rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            Photographers ({photographers.length})
          </h2>
        </div>

        {photographers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No photographers found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first photographer to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {photographers.map((photographer) => (
              <PhotographerRow
                key={photographer.slug}
                photographer={photographer}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface PhotographerRowProps {
  photographer: PhotographerWithStats
  onUpdate: (
    slug: string,
    updates: {
      name?: string
      bio?: string | null
      location?: string | null
      website?: string | null
      instagram?: string | null
      email?: string | null
    }
  ) => Promise<boolean>
  onDelete: (slug: string) => Promise<void>
}

function PhotographerRow({
  photographer,
  onUpdate,
  onDelete,
}: PhotographerRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(photographer.name)
  const [editBio, setEditBio] = useState(photographer.bio || '')
  const [editLocation, setEditLocation] = useState(photographer.location || '')
  const [editWebsite, setEditWebsite] = useState(photographer.website || '')
  const [editInstagram, setEditInstagram] = useState(
    photographer.instagram || ''
  )
  const [editEmail, setEditEmail] = useState(photographer.email || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onUpdate(photographer.slug, {
      name: editName,
      bio: editBio || null,
      location: editLocation || null,
      website: editWebsite || null,
      instagram: editInstagram || null,
      email: editEmail || null,
    })
    if (success) {
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName(photographer.name)
    setEditBio(photographer.bio || '')
    setEditLocation(photographer.location || '')
    setEditWebsite(photographer.website || '')
    setEditInstagram(photographer.instagram || '')
    setEditEmail(photographer.email || '')
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(photographer.slug)
    setIsDeleting(false)
  }

  return (
    <div className="p-4 hover:bg-white/5">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Location"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
          </div>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Bio"
            rows={2}
            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="url"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              placeholder="Website"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
            <input
              type="text"
              value={editInstagram}
              onChange={(e) => setEditInstagram(e.target.value)}
              placeholder="Instagram"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <VinylSpinner size="xxs" /> : <CheckIcon size={16} />}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            {photographer.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photographer.avatar_url}
                alt={photographer.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <CameraIcon size={20} className="text-gray-400" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white">{photographer.name}</h3>
            <p className="text-sm text-gray-400">
              {photographer.slug}
              {photographer.location && ` • ${photographer.location}`}
            </p>
            {photographer.bio && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {photographer.bio}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="text-center px-4">
            <div className="text-lg font-semibold text-white">
              {photographer.photo_count}
            </div>
            <div className="text-xs text-gray-400">photos</div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-2 px-4 text-sm text-gray-400">
            {photographer.website && (
              <a
                href={photographer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                Web
              </a>
            )}
            {photographer.instagram && (
              <a
                href={`https://instagram.com/${photographer.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                IG
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Edit"
            >
              <EditIcon size={18} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || photographer.photo_count > 0}
              className="p-2 hover:bg-error/20 text-gray-400 hover:text-error rounded-lg transition-colors disabled:opacity-50"
              title={
                photographer.photo_count > 0
                  ? 'Cannot delete - photographer has photos'
                  : 'Delete'
              }
            >
              {isDeleting ? (
                <VinylSpinner size="xxs" />
              ) : (
                <DeleteIcon size={18} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
