'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/layouts'
import { VinylSpinner } from '@/components/ui'

export default function CreateEventPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [timezone, setTimezone] = useState('Australia/Brisbane')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-generate ID from name
  const generateId = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id || generateId(name),
          name,
          date,
          location,
          timezone,
          status: 'upcoming',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/admin/events/${data.event.id}`)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create event')
      }
    } catch (err) {
      setError('Failed to create event')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout
      title="Create Event"
      subtitle="Add a new event to the system"
      breadcrumbs={[
        { label: 'Events', href: '/admin/events' },
        { label: 'Create Event' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-elevated rounded-2xl p-6 border border-white/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Battle of the Bands 2025"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event ID (URL-friendly)
              </label>
              <input
                type="text"
                value={id || generateId(name)}
                onChange={(e) => setId(e.target.value)}
                placeholder="auto-generated from name"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be used in URLs: /event/
                {id || generateId(name) || 'event-id'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:border-accent focus:outline-hidden"
                >
                  <option value="Australia/Brisbane">Australia/Brisbane</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                  <option value="Australia/Melbourne">
                    Australia/Melbourne
                  </option>
                  <option value="Australia/Perth">Australia/Perth</option>
                  <option value="Australia/Adelaide">Australia/Adelaide</option>
                  <option value="Pacific/Auckland">Pacific/Auckland</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Location *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Brisbane Convention Centre"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-accent hover:bg-accent-light text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <VinylSpinner size="xxs" />
                    Creating...
                  </>
                ) : (
                  'Create Event'
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}
