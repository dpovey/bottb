'use client'

import { useState } from 'react'
import { VideographerWithStats } from '@/lib/db-types'
import { nameToSlug } from '@/lib/slug-utils'
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  PlusIcon,
  VideoIcon,
} from '@/components/icons'
import {
  VinylSpinner,
  ConfirmModal,
  Button,
  Card,
  ErrorBanner,
} from '@/components/ui'

export interface EventOption {
  id: string
  name: string
}

interface VideographerAdminClientProps {
  initialVideographers: VideographerWithStats[]
  events: EventOption[]
  initialEventIdsBySlug: Record<string, string[]>
}

function EventPicker({
  events,
  selected,
  onToggle,
}: {
  events: EventOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No events available yet.</p>
  }
  return (
    <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 p-3">
      {events.map((event) => (
        <label
          key={event.id}
          className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(event.id)}
            onChange={() => onToggle(event.id)}
            className="accent-accent"
          />
          {event.name}
        </label>
      ))}
    </div>
  )
}

export function VideographerAdminClient({
  initialVideographers,
  events,
  initialEventIdsBySlug,
}: VideographerAdminClientProps) {
  const [videographers, setVideographers] =
    useState<VideographerWithStats[]>(initialVideographers)
  const [eventIdsBySlug, setEventIdsBySlug] = useState<
    Record<string, string[]>
  >(initialEventIdsBySlug)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newInstagram, setNewInstagram] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newEventIds, setNewEventIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] =
    useState<VideographerWithStats | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const slug = newSlug || nameToSlug(newName)
    try {
      const response = await fetch('/api/videographers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug,
          bio: newBio || null,
          location: newLocation || null,
          website: newWebsite || null,
          instagram: newInstagram || null,
          email: newEmail || null,
          event_ids: newEventIds,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setVideographers([
          ...videographers,
          { ...data.videographer, event_count: newEventIds.length },
        ])
        setEventIdsBySlug({ ...eventIdsBySlug, [slug]: newEventIds })
        resetForm()
        setIsAdding(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add videographer')
      }
    } catch (err) {
      setError('Failed to add videographer')
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
      event_ids?: string[]
    }
  ) => {
    setOperationError(null)
    try {
      const response = await fetch(`/api/videographers/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setVideographers(
          videographers.map((v) =>
            v.slug === slug
              ? {
                  ...v,
                  ...data.videographer,
                  event_count: updates.event_ids
                    ? updates.event_ids.length
                    : v.event_count,
                }
              : v
          )
        )
        if (updates.event_ids) {
          setEventIdsBySlug({ ...eventIdsBySlug, [slug]: updates.event_ids })
        }
        return true
      } else {
        const data = await response.json()
        setOperationError(data.error || 'Failed to update videographer')
        return false
      }
    } catch (err) {
      setOperationError('Failed to update videographer')
      console.error(err)
      return false
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setOperationError(null)

    try {
      const response = await fetch(`/api/videographers/${deleteTarget.slug}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setVideographers(
          videographers.filter((v) => v.slug !== deleteTarget.slug)
        )
        setDeleteTarget(null)
      } else {
        const data = await response.json()
        setOperationError(data.error || 'Failed to delete videographer')
      }
    } catch (err) {
      setOperationError('Failed to delete videographer')
      console.error(err)
    } finally {
      setIsDeleting(false)
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
    setNewEventIds([])
    setError(null)
  }

  return (
    <div className="space-y-6">
      <ErrorBanner
        message={operationError}
        onDismiss={() => setOperationError(null)}
      />

      {/* Add Button */}
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setIsAdding(true)}>
          <PlusIcon size={20} />
          Add Videographer
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-4">
            Add New Videographer
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
                  placeholder="e.g., Jane Smith"
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
                  value={newSlug || nameToSlug(newName)}
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
                  placeholder="e.g., Melbourne, Australia"
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
                  placeholder="@username or full URL"
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Events filmed
                </label>
                <EventPicker
                  events={events}
                  selected={newEventIds}
                  onToggle={(id) => setNewEventIds((s) => toggle(s, id))}
                />
              </div>
            </div>

            <ErrorBanner message={error} className="py-2" />

            <div className="flex gap-3">
              <Button type="submit" variant="accent" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Videographer'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Videographers List */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            Videographers ({videographers.length})
          </h2>
        </div>

        {videographers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No videographers found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first videographer to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {videographers.map((videographer) => (
              <VideographerRow
                key={videographer.slug}
                videographer={videographer}
                events={events}
                assignedEventIds={eventIdsBySlug[videographer.slug] || []}
                onUpdate={handleUpdate}
                onRequestDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Videographer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}

interface VideographerRowProps {
  videographer: VideographerWithStats
  events: EventOption[]
  assignedEventIds: string[]
  onUpdate: (
    slug: string,
    updates: {
      name?: string
      bio?: string | null
      location?: string | null
      website?: string | null
      instagram?: string | null
      email?: string | null
      event_ids?: string[]
    }
  ) => Promise<boolean>
  onRequestDelete: (videographer: VideographerWithStats) => void
}

function VideographerRow({
  videographer,
  events,
  assignedEventIds,
  onUpdate,
  onRequestDelete,
}: VideographerRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(videographer.name)
  const [editBio, setEditBio] = useState(videographer.bio || '')
  const [editLocation, setEditLocation] = useState(videographer.location || '')
  const [editWebsite, setEditWebsite] = useState(videographer.website || '')
  const [editInstagram, setEditInstagram] = useState(
    videographer.instagram || ''
  )
  const [editEmail, setEditEmail] = useState(videographer.email || '')
  const [editEventIds, setEditEventIds] = useState<string[]>(assignedEventIds)
  const [isSaving, setIsSaving] = useState(false)

  const toggle = (id: string) =>
    setEditEventIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    )

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onUpdate(videographer.slug, {
      name: editName,
      bio: editBio || null,
      location: editLocation || null,
      website: editWebsite || null,
      instagram: editInstagram || null,
      email: editEmail || null,
      event_ids: editEventIds,
    })
    if (success) {
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName(videographer.name)
    setEditBio(videographer.bio || '')
    setEditLocation(videographer.location || '')
    setEditWebsite(videographer.website || '')
    setEditInstagram(videographer.instagram || '')
    setEditEmail(videographer.email || '')
    setEditEventIds(assignedEventIds)
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
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">
              Events filmed
            </p>
            <EventPicker
              events={events}
              selected={editEventIds}
              onToggle={toggle}
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
            {videographer.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={videographer.avatar_url}
                alt={videographer.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <VideoIcon size={20} className="text-gray-400" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white">{videographer.name}</h3>
            <p className="text-sm text-gray-400">
              {videographer.slug}
              {videographer.location && ` • ${videographer.location}`}
            </p>
            {videographer.bio && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {videographer.bio}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="text-center px-4">
            <div className="text-lg font-semibold text-white">
              {videographer.event_count}
            </div>
            <div className="text-xs text-gray-400">events</div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-2 px-4 text-sm text-gray-400">
            {videographer.website && (
              <a
                href={videographer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                Web
              </a>
            )}
            {videographer.instagram && (
              <a
                href={
                  videographer.instagram.startsWith('http')
                    ? videographer.instagram
                    : `https://instagram.com/${videographer.instagram.replace('@', '')}`
                }
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
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Edit"
            >
              <EditIcon size={18} />
            </button>
            <button
              onClick={() => onRequestDelete(videographer)}
              className="p-2 hover:bg-error/20 text-gray-400 hover:text-error rounded-lg transition-colors cursor-pointer"
              title="Delete"
            >
              <DeleteIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
