'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatEventDate } from '@/lib/date-utils'
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
} from '@/components/icons'
import {
  VinylSpinner,
  Modal,
  ConfirmModal,
  Button,
  Card,
} from '@/components/ui'

interface Event {
  id: string
  name: string
  date: string
  location: string
  timezone: string
  status: string
  description?: string | null
}

interface Band {
  id: string
  name: string
  description: string | null
  company_slug: string | null
  company_name?: string | null
  order: number
}

interface Company {
  slug: string
  name: string
}

interface EventAdminDashboardProps {
  eventId: string
}

export default function EventAdminDashboard({
  eventId,
}: EventAdminDashboardProps) {
  const [event, setEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [clearSuccess, setClearSuccess] = useState<string | null>(null)
  const [bands, setBands] = useState<Band[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(true)
  const [operationError, setOperationError] = useState<string | null>(null)

  // Event description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  // Delete band confirmation modal state
  const [deleteBandTarget, setDeleteBandTarget] = useState<Band | null>(null)
  const [isDeletingBand, setIsDeletingBand] = useState(false)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`)
        if (response.ok) {
          const data = await response.json()
          setEvent(data)
        }
      } catch (error) {
        console.error('Error fetching event:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvent()
  }, [eventId])

  // Fetch bands and companies for this event
  useEffect(() => {
    const fetchBandsAndCompanies = async () => {
      setIsLoadingBands(true)
      try {
        const [bandsRes, companiesRes] = await Promise.all([
          fetch(`/api/events/${eventId}/bands`),
          fetch('/api/companies?mode=list'),
        ])

        if (bandsRes.ok) {
          const bandsData = await bandsRes.json()
          setBands(Array.isArray(bandsData) ? bandsData : [])
        }

        if (companiesRes.ok) {
          const companiesData = await companiesRes.json()
          setCompanies(companiesData.companies || [])
        }
      } catch (error) {
        console.error('Error fetching bands/companies:', error)
      } finally {
        setIsLoadingBands(false)
      }
    }

    fetchBandsAndCompanies()
  }, [eventId])

  const handleClearScores = async () => {
    setIsClearing(true)
    setOperationError(null)
    setClearSuccess(null)
    try {
      const response = await fetch(`/api/events/${eventId}/clear-scores`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        setClearSuccess(result.message)
        setShowClearConfirm(false)
      } else {
        const error = await response.json()
        setOperationError(error.error || 'Failed to clear scores')
      }
    } catch (error) {
      console.error('Error clearing scores:', error)
      setOperationError('Failed to clear scores')
    } finally {
      setIsClearing(false)
    }
  }

  const handleSaveDescription = async () => {
    setIsSavingDescription(true)
    setOperationError(null)
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription || null }),
      })

      if (response.ok) {
        const data = await response.json()
        setEvent({ ...event!, description: data.event.description })
        setIsEditingDescription(false)
      } else {
        const error = await response.json()
        setOperationError(error.error || 'Failed to save description')
      }
    } catch (error) {
      console.error('Error saving description:', error)
      setOperationError('Failed to save description')
    } finally {
      setIsSavingDescription(false)
    }
  }

  const startEditingDescription = () => {
    setEditDescription(event?.description || '')
    setIsEditingDescription(true)
  }

  const cancelEditingDescription = () => {
    setIsEditingDescription(false)
    setEditDescription('')
  }

  // Band management handlers
  const handleAddBand = async (name: string, companySlug: string | null) => {
    setOperationError(null)
    try {
      const response = await fetch('/api/bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          name,
          company_slug: companySlug,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newBand = {
          ...data.band,
          company_name: companies.find((c) => c.slug === companySlug)?.name,
        }
        setBands([...bands, newBand])
        return true
      } else {
        const error = await response.json()
        setOperationError(error.error || 'Failed to add band')
        return false
      }
    } catch (error) {
      console.error('Error adding band:', error)
      setOperationError('Failed to add band')
      return false
    }
  }

  const handleUpdateBand = async (
    bandId: string,
    updates: {
      name?: string
      company_slug?: string | null
      description?: string | null
    }
  ) => {
    setOperationError(null)
    try {
      const response = await fetch(`/api/band/${bandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setBands(
          bands.map((b) =>
            b.id === bandId
              ? {
                  ...b,
                  ...data.band,
                  company_name: companies.find(
                    (c) => c.slug === data.band.company_slug
                  )?.name,
                }
              : b
          )
        )
        return true
      } else {
        const error = await response.json()
        setOperationError(error.error || 'Failed to update band')
        return false
      }
    } catch (error) {
      console.error('Error updating band:', error)
      setOperationError('Failed to update band')
      return false
    }
  }

  const confirmDeleteBand = async () => {
    if (!deleteBandTarget) return

    setIsDeletingBand(true)
    setOperationError(null)

    try {
      const response = await fetch(`/api/band/${deleteBandTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setBands(bands.filter((b) => b.id !== deleteBandTarget.id))
        setDeleteBandTarget(null)
      } else {
        const error = await response.json()
        setOperationError(error.error || 'Failed to delete band')
      }
    } catch (error) {
      console.error('Error deleting band:', error)
      setOperationError('Failed to delete band')
    } finally {
      setIsDeletingBand(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Event not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Operation Error Banner */}
      {operationError && (
        <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{operationError}</span>
          <button
            onClick={() => setOperationError(null)}
            className="text-error hover:text-white cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {clearSuccess && (
        <div className="bg-success/20 border border-success/50 text-success px-4 py-3 rounded-lg flex items-center justify-between">
          <span>✅ {clearSuccess}</span>
          <button
            onClick={() => setClearSuccess(null)}
            className="text-success hover:text-white cursor-pointer"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            event.status === 'voting'
              ? 'bg-green-600 text-white'
              : event.status === 'finalized'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-600 text-white'
          }`}
        >
          {event.status.toUpperCase()}
        </span>
        <span className="text-muted">
          {formatEventDate(event.date, event.timezone)}
        </span>
      </div>

      {/* Event Description */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Description
            </h3>
            {isEditingDescription ? (
              <div className="space-y-3">
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter a description for this event..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDescription}
                    disabled={isSavingDescription}
                    className="px-4 py-2 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingDescription ? (
                      <VinylSpinner size="xxs" />
                    ) : (
                      <CheckIcon size={16} />
                    )}
                    Save
                  </button>
                  <button
                    onClick={cancelEditingDescription}
                    disabled={isSavingDescription}
                    className="px-4 py-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-300">
                {event.description || (
                  <span className="text-gray-500 italic">
                    No description set
                  </span>
                )}
              </p>
            )}
          </div>
          {!isEditingDescription && (
            <button
              onClick={startEditingDescription}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Edit description"
            >
              <EditIcon size={18} />
            </button>
          )}
        </div>
      </Card>

      {/* Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Crowd Voting */}
        <Link
          href={`/live/events/${eventId}/voting-qr`}
          className="bg-elevated rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-3xl sm:text-6xl mb-2 sm:mb-4">📱</div>
          <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-4">
            Crowd Voting
          </h2>
          <p className="text-gray-300 text-xs sm:text-lg mb-3 sm:mb-6 hidden sm:block">
            Display QR code for audience voting
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors text-xs sm:text-base">
            Voting QR
          </div>
        </Link>

        {/* Judge Scoring */}
        <Link
          href={`/live/events/${eventId}/judge-qr`}
          className="bg-elevated rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-3xl sm:text-6xl mb-2 sm:mb-4">⚖️</div>
          <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-4">
            Judge Scoring
          </h2>
          <p className="text-gray-300 text-xs sm:text-lg mb-3 sm:mb-6 hidden sm:block">
            Display QR code for judge scoring
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors text-xs sm:text-base">
            Judge QR
          </div>
        </Link>

        {/* Crowd Noise Measurement */}
        <Link
          href={`/admin/events/${eventId}/crowd-noise`}
          className="bg-elevated rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-3xl sm:text-6xl mb-2 sm:mb-4">🎤</div>
          <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-4">
            Crowd Noise
          </h2>
          <p className="text-gray-300 text-xs sm:text-lg mb-3 sm:mb-6 hidden sm:block">
            Measure crowd energy and noise levels
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors text-xs sm:text-base">
            Measure
          </div>
        </Link>

        {/* Setlist Management */}
        <Link
          href={`/admin/events/${eventId}/setlists`}
          className="bg-elevated rounded-xl sm:rounded-2xl p-4 sm:p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-3xl sm:text-6xl mb-2 sm:mb-4">🎵</div>
          <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-4">
            Setlists
          </h2>
          <p className="text-gray-300 text-xs sm:text-lg mb-3 sm:mb-6 hidden sm:block">
            Manage band setlists and detect conflicts
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-2 sm:py-3 px-3 sm:px-6 rounded-lg sm:rounded-xl transition-colors text-xs sm:text-base">
            Manage
          </div>
        </Link>
      </div>

      {/* Band Management */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">
            Bands ({bands.length})
          </h3>
          <AddBandForm companies={companies} onAdd={handleAddBand} />
        </div>

        {isLoadingBands ? (
          <div className="flex items-center justify-center py-8">
            <VinylSpinner size="sm" />
          </div>
        ) : bands.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No bands added to this event yet
          </div>
        ) : (
          <div className="space-y-3">
            {bands
              .sort((a, b) => a.order - b.order)
              .map((band, index) => (
                <BandRow
                  key={band.id}
                  band={band}
                  index={index}
                  companies={companies}
                  onUpdate={handleUpdateBand}
                  onRequestDelete={setDeleteBandTarget}
                />
              ))}
          </div>
        )}
      </Card>

      {/* Additional Actions */}
      <Card padding="lg">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 text-center">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href={`/results/${eventId}`}
            className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-center transition-colors text-sm sm:text-base"
          >
            📊 Results
          </Link>
          <Link
            href={`/vote/crowd/${eventId}`}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-center transition-colors text-sm sm:text-base"
          >
            🎵 Test Crowd
          </Link>
          <Link
            href={`/vote/judge/${eventId}`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-center transition-colors text-sm sm:text-base"
          >
            ⚖️ Test Judge
          </Link>
          <Button
            variant="danger"
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearing}
            className="py-3 sm:py-4 text-sm sm:text-base"
          >
            {isClearing ? '⏳ Clearing...' : '🗑️ Clear'}
          </Button>
        </div>
      </Card>

      {/* Clear Scores Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Scores?"
        disabled={isClearing}
        size="md"
        footer={
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleClearScores}
              disabled={isClearing}
              className="flex-1"
            >
              {isClearing ? (
                <>
                  <VinylSpinner size="xxs" />
                  Clearing...
                </>
              ) : (
                'Yes, Clear All Scores'
              )}
            </Button>
          </div>
        }
      >
        <p className="text-text-muted mb-4">
          This will permanently delete all voting data for{' '}
          <strong className="text-white">{event?.name}</strong>:
        </p>
        <ul className="text-text-muted mb-4 ml-4 list-disc space-y-1">
          <li>All judge votes (song choice, performance, crowd vibe)</li>
          <li>All crowd votes</li>
          <li>
            All crowd noise measurements (energy levels, peak volume, crowd
            scores)
          </li>
        </ul>
        <p className="text-error">This action cannot be undone.</p>
      </Modal>

      {/* Delete Band Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteBandTarget}
        onClose={() => setDeleteBandTarget(null)}
        onConfirm={confirmDeleteBand}
        title="Delete Band"
        message={`Are you sure you want to delete "${deleteBandTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeletingBand}
        variant="danger"
      />
    </div>
  )
}

// Add Band Form component
function AddBandForm({
  companies,
  onAdd,
}: {
  companies: Company[]
  onAdd: (name: string, companySlug: string | null) => Promise<boolean>
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    const success = await onAdd(name.trim(), companySlug || null)
    if (success) {
      setName('')
      setCompanySlug('')
      setIsAdding(false)
    }
    setIsSubmitting(false)
  }

  if (!isAdding) {
    return (
      <Button variant="accent" onClick={() => setIsAdding(true)}>
        <PlusIcon size={20} />
        Add Band
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Band name"
        className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
        autoFocus
        required
      />
      <select
        value={companySlug}
        onChange={(e) => setCompanySlug(e.target.value)}
        className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
      >
        <option value="">No Company</option>
        {companies.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isSubmitting || !name.trim()}
        className="px-4 py-2 bg-success hover:bg-success-light text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
      >
        {isSubmitting ? <VinylSpinner size="xxs" /> : <CheckIcon size={18} />}
        Add
      </button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setIsAdding(false)
          setName('')
          setCompanySlug('')
        }}
      >
        Cancel
      </Button>
    </form>
  )
}

// Band Row component
function BandRow({
  band,
  index,
  companies,
  onUpdate,
  onRequestDelete,
}: {
  band: Band
  index: number
  companies: Company[]
  onUpdate: (
    bandId: string,
    updates: {
      name?: string
      company_slug?: string | null
      description?: string | null
    }
  ) => Promise<boolean>
  onRequestDelete: (band: Band) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(band.name)
  const [editCompanySlug, setEditCompanySlug] = useState(
    band.company_slug || ''
  )
  const [editDescription, setEditDescription] = useState(band.description || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onUpdate(band.id, {
      name: editName,
      company_slug: editCompanySlug || null,
      description: editDescription || null,
    })
    if (success) {
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName(band.name)
    setEditCompanySlug(band.company_slug || '')
    setEditDescription(band.description || '')
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
      {/* Order number */}
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0 self-start mt-1">
        {index + 1}
      </div>

      {/* Band info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white"
                autoFocus
              />
              <select
                value={editCompanySlug}
                onChange={(e) => setEditCompanySlug(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white"
              >
                <option value="">No Company</option>
                {companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Band description (optional)"
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm resize-none placeholder-gray-500"
            />
          </div>
        ) : (
          <>
            <h4 className="font-medium text-white">{band.name}</h4>
            {band.company_name && (
              <p className="text-sm text-gray-400">{band.company_name}</p>
            )}
            {band.description && (
              <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                {band.description}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors disabled:opacity-50"
              title="Save"
            >
              {isSaving ? <VinylSpinner size="xxs" /> : <CheckIcon size={18} />}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Cancel"
            >
              <CloseIcon size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Edit"
            >
              <EditIcon size={18} />
            </button>
            <button
              onClick={() => onRequestDelete(band)}
              className="p-2 hover:bg-error/20 text-gray-400 hover:text-error rounded-lg transition-colors cursor-pointer"
              title="Delete"
            >
              <DeleteIcon size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
