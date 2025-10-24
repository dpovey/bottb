"use client";

import { signOut } from "next-auth/react";
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

export default function AdminDashboard({ session }: AdminDashboardProps) {
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-300">
            Welcome, {session.user?.name || session.user?.email}
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Events List */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Events</h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-white text-xl">Loading events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No events found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {event.name}
                  </h3>
                  <p className="text-gray-300">{event.location}</p>
                  <p className="text-sm text-gray-400">{event.date}</p>
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
                      <span className="text-xs text-gray-400">Updating...</span>
                    )}
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
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
