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
import { VinylSpinner } from '@/components/ui'

interface Event {
  id: string
  name: string
  date: string
  location: string
  timezone: string
  status: string
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
  const [bands, setBands] = useState<Band[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingBands, setIsLoadingBands] = useState(true)

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
    try {
      const response = await fetch(`/api/events/${eventId}/clear-scores`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        alert(`✅ ${result.message}`)
        setShowClearConfirm(false)
      } else {
        const error = await response.json()
        alert(`❌ Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error clearing scores:', error)
      alert('❌ Failed to clear scores')
    } finally {
      setIsClearing(false)
    }
  }

  // Band management handlers
  const handleAddBand = async (name: string, companySlug: string | null) => {
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
        alert(`Error: ${error.error}`)
        return false
      }
    } catch (error) {
      console.error('Error adding band:', error)
      alert('Failed to add band')
      return false
    }
  }

  const handleUpdateBand = async (
    bandId: string,
    updates: { name?: string; company_slug?: string | null }
  ) => {
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
        alert(`Error: ${error.error}`)
        return false
      }
    } catch (error) {
      console.error('Error updating band:', error)
      return false
    }
  }

  const handleDeleteBand = async (bandId: string) => {
    const band = bands.find((b) => b.id === bandId)
    if (!band) return

    if (!confirm(`Delete band "${band.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/band/${bandId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setBands(bands.filter((b) => b.id !== bandId))
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting band:', error)
      alert('Failed to delete band')
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

      {/* Action Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Crowd Voting */}
        <Link
          href={`/live/events/${eventId}/voting-qr`}
          className="bg-elevated rounded-2xl p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-3xl font-bold text-white mb-4">Crowd Voting</h2>
          <p className="text-gray-300 text-lg mb-6">
            Display QR code for audience voting
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors">
            Show Voting QR Code
          </div>
        </Link>

        {/* Judge Scoring */}
        <Link
          href={`/live/events/${eventId}/judge-qr`}
          className="bg-elevated rounded-2xl p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-3xl font-bold text-white mb-4">Judge Scoring</h2>
          <p className="text-gray-300 text-lg mb-6">
            Display QR code for judge scoring
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors">
            Show Judge QR Code
          </div>
        </Link>

        {/* Crowd Noise Measurement */}
        <Link
          href={`/admin/events/${eventId}/crowd-noise`}
          className="bg-elevated rounded-2xl p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-6xl mb-4">🎤</div>
          <h2 className="text-3xl font-bold text-white mb-4">Crowd Noise</h2>
          <p className="text-gray-300 text-lg mb-6">
            Measure crowd energy and noise levels
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors">
            Start Measurement
          </div>
        </Link>

        {/* Setlist Management */}
        <Link
          href={`/admin/events/${eventId}/setlists`}
          className="bg-elevated rounded-2xl p-8 text-center hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="text-6xl mb-4">🎵</div>
          <h2 className="text-3xl font-bold text-white mb-4">Setlists</h2>
          <p className="text-gray-300 text-lg mb-6">
            Manage band setlists and detect conflicts
          </p>
          <div className="bg-slate-600 group-hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors">
            Manage Setlists
          </div>
        </Link>
      </div>

      {/* Band Management */}
      <div className="bg-elevated rounded-2xl p-6 border border-white/5">
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
                  onDelete={handleDeleteBand}
                />
              ))}
          </div>
        )}
      </div>

      {/* Additional Actions */}
      <div className="bg-elevated rounded-2xl p-8 border border-white/5">
        <h3 className="text-2xl font-bold text-white mb-6 text-center">
          Quick Actions
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={`/results/${eventId}`}
            className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-xl text-center transition-colors"
          >
            📊 View Results
          </Link>
          <Link
            href={`/vote/crowd/${eventId}`}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl text-center transition-colors"
          >
            🎵 Test Crowd Voting
          </Link>
          <Link
            href={`/vote/judge/${eventId}`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-center transition-colors"
          >
            ⚖️ Test Judge Scoring
          </Link>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl text-center transition-colors"
            disabled={isClearing}
          >
            {isClearing ? '⏳ Clearing...' : '🗑️ Clear Scores'}
          </button>
        </div>
      </div>

      {/* Clear Scores Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Clear All Scores?
            </h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete all voting data for{' '}
              <strong>{event?.name}</strong>:
            </p>
            <ul className="text-gray-600 mb-6 ml-4 list-disc">
              <li>All judge votes (song choice, performance, crowd vibe)</li>
              <li>All crowd votes</li>
              <li>
                All crowd noise measurements (energy levels, peak volume, crowd
                scores)
              </li>
            </ul>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearScores}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear All Scores'}
              </button>
            </div>
          </div>
        </div>
      )}
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
      <button
        onClick={() => setIsAdding(true)}
        className="bg-accent hover:bg-accent-light text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
      >
        <PlusIcon size={20} />
        Add Band
      </button>
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
        className="px-4 py-2 bg-success hover:bg-success-light text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {isSubmitting ? <VinylSpinner size="xxs" /> : <CheckIcon size={18} />}
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setIsAdding(false)
          setName('')
          setCompanySlug('')
        }}
        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
      >
        Cancel
      </button>
    </form>
  )
}

// Band Row component
function BandRow({
  band,
  index,
  companies,
  onUpdate,
  onDelete,
}: {
  band: Band
  index: number
  companies: Company[]
  onUpdate: (
    bandId: string,
    updates: { name?: string; company_slug?: string | null }
  ) => Promise<boolean>
  onDelete: (bandId: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(band.name)
  const [editCompanySlug, setEditCompanySlug] = useState(
    band.company_slug || ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onUpdate(band.id, {
      name: editName,
      company_slug: editCompanySlug || null,
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
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(band.id)
    setIsDeleting(false)
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
      {/* Order number */}
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
        {index + 1}
      </div>

      {/* Band info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
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
        ) : (
          <>
            <h4 className="font-medium text-white">{band.name}</h4>
            {band.company_name && (
              <p className="text-sm text-gray-400">{band.company_name}</p>
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
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Edit"
            >
              <EditIcon size={18} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 hover:bg-error/20 text-gray-400 hover:text-error rounded-lg transition-colors disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <VinylSpinner size="xxs" />
              ) : (
                <DeleteIcon size={18} />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
