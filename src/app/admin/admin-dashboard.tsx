'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  VideoIcon,
  ShareIcon,
  PhotoIcon,
  BuildingIcon,
  CameraIcon,
  StarIcon,
} from '@/components/icons'
import { Button, VinylSpinner } from '@/components/ui'

interface Event {
  id: string
  name: string
  location: string
  status: 'upcoming' | 'voting' | 'finalized'
  date: string
}

interface Session {
  user: {
    id: string
    name?: string | null
    email?: string | null
    isAdmin?: boolean
  }
}

interface AdminDashboardProps {
  session: Session
}

export default function AdminDashboard({
  session: _session,
}: AdminDashboardProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      if (response.ok) {
        const data = await response.json()
        // Ensure data is an array
        const eventsData = Array.isArray(data) ? data : []
        setEvents(eventsData)
      } else {
        const errorData = await response.json()
        console.error('Error fetching events:', response.status, errorData)
        setEvents([])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setUpdatingStatus(eventId)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const result = await response.json()
        // Update the local state
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  status: newStatus as 'upcoming' | 'voting' | 'finalized',
                }
              : event
          )
        )
        setStatusMessage({ type: 'success', text: result.message })
        // Auto-dismiss after 3 seconds
        setTimeout(() => setStatusMessage(null), 3000)
      } else {
        const error = await response.json()
        setStatusMessage({ type: 'error', text: error.error })
      }
    } catch (error) {
      console.error('Error updating event status:', error)
      setStatusMessage({ type: 'error', text: 'Failed to update event status' })
    } finally {
      setUpdatingStatus(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Status Message */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-lg flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-success/20 border border-success/50 text-success'
              : 'bg-error/20 border border-error/50 text-error'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link
          href="/admin/videos"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <VideoIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Videos
              </h3>
              <p className="text-sm text-muted">YouTube videos</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/photos"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <PhotoIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Photos
              </h3>
              <p className="text-sm text-muted">Edit metadata</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/heroes"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-warning/20 rounded-lg flex items-center justify-center">
              <StarIcon className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Heroes
              </h3>
              <p className="text-sm text-muted">Focal points</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/companies"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <BuildingIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Companies
              </h3>
              <p className="text-sm text-muted">Manage orgs</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/photographers"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <CameraIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Photographers
              </h3>
              <p className="text-sm text-muted">Manage credits</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/social"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <ShareIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Social
              </h3>
              <p className="text-sm text-muted">Connections</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Events List */}
      <div className="bg-elevated rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Events</h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-white text-xl">Loading events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted text-lg">No events found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-surface rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {event.name}
                  </h3>
                  <p className="text-muted">{event.location}</p>
                  <p className="text-sm text-dim">{event.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={event.status}
                      onChange={(e) =>
                        handleStatusChange(event.id, e.target.value)
                      }
                      disabled={updatingStatus === event.id}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium
                        bg-bg border border-white/10 
                        focus:outline-hidden focus:border-accent 
                        hover:border-white/20 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed
                        appearance-none cursor-pointer
                        bg-[url('data:image/svg+xml,%3csvg%20xmlns%3d%27http%3a%2f%2fwww.w3.org%2f2000%2fsvg%27%20fill%3d%27none%27%20viewBox%3d%270%200%2020%2020%27%3e%3cpath%20stroke%3d%27%23666666%27%20stroke-linecap%3d%27round%27%20stroke-linejoin%3d%27round%27%20stroke-width%3d%271.5%27%20d%3d%27M6%208l4%204%204-4%27%2f%3e%3c%2fsvg%3e')]
                        bg-[length:1.25em_1.25em] bg-[position:right_0.5rem_center] bg-no-repeat
                        pr-8
                        ${
                          event.status === 'voting'
                            ? 'text-success'
                            : event.status === 'upcoming'
                              ? 'text-blue-400'
                              : 'text-text-muted'
                        }
                      `}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="voting">Voting</option>
                      <option value="finalized">Finalized</option>
                    </select>
                    {updatingStatus === event.id && <VinylSpinner size="xxs" />}
                  </div>
                  <Link href={`/admin/events/${event.id}`}>
                    <Button variant="accent" size="sm">
                      Manage Event
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
