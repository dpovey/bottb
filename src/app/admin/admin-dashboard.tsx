"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Event {
  id: string;
  name: string;
  location: string;
  status: "upcoming" | "voting" | "finalized";
  date: string;
}

interface Session {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    isAdmin?: boolean;
  };
}

interface AdminDashboardProps {
  session: Session;
}

export default function AdminDashboard({
  session: _session,
}: AdminDashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/events");
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        const eventsData = Array.isArray(data) ? data : [];
        setEvents(eventsData);
      } else {
        const errorData = await response.json();
        console.error("Error fetching events:", response.status, errorData);
        setEvents([]);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setUpdatingStatus(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update the local state
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  status: newStatus as "upcoming" | "voting" | "finalized",
                }
              : event
          )
        );
        alert(`✅ ${result.message}`);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error updating event status:", error);
      alert("❌ Failed to update event status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/videos"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Manage Videos
              </h3>
              <p className="text-sm text-muted">Add YouTube videos to events</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/social"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Social Accounts
              </h3>
              <p className="text-sm text-muted">
                Connect social media accounts
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/photos"
          className="bg-elevated rounded-xl p-6 hover:bg-white/10 transition-colors group border border-white/5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                Photo Gallery
              </h3>
              <p className="text-sm text-muted">Manage event photos</p>
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
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <select
                      value={event.status}
                      onChange={(e) =>
                        handleStatusChange(event.id, e.target.value)
                      }
                      disabled={updatingStatus === event.id}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${
                        event.status === "voting"
                          ? "bg-green-500/30 text-green-300 border-green-400 hover:bg-green-500/40"
                          : event.status === "upcoming"
                          ? "bg-blue-500/30 text-blue-300 border-blue-400 hover:bg-blue-500/40"
                          : "bg-gray-500/30 text-gray-300 border-gray-400 hover:bg-gray-500/40"
                      } ${
                        updatingStatus === event.id
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer transition-all duration-200 hover:scale-105"
                      }`}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="voting">Voting</option>
                      <option value="finalized">Finalized</option>
                    </select>
                    {updatingStatus === event.id && (
                      <span className="text-xs text-dim">Updating...</span>
                    )}
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="bg-accent hover:bg-accent-light text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    Manage Event
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
