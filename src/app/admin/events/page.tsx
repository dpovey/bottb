"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layouts";

interface Event {
  id: string;
  name: string;
  location: string;
  status: string;
  date: string;
}

export default function AdminEventsPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events");
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (status === "loading" || loading) {
    return (
      <AdminLayout title="Events" breadcrumbs={[{ label: "Events" }]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  if (!session) {
    return (
      <AdminLayout title="Events" breadcrumbs={[{ label: "Events" }]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white text-xl">Unauthorized</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Event Management"
      subtitle="Manage all events in the system"
      breadcrumbs={[{ label: "Events" }]}
      actions={
        <Link
          href="/admin/events/create"
          className="bg-accent hover:bg-accent-light text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          + Create New Event
        </Link>
      }
    >
      {/* Events List */}
      <div className="bg-elevated rounded-2xl p-6 border border-white/5">
        <h2 className="text-xl font-bold text-white mb-6">All Events</h2>

        {events.length === 0 ? (
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
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      event.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : event.status === "upcoming"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {event.status}
                  </span>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="bg-accent hover:bg-accent-light text-white font-bold py-1 px-3 rounded-lg text-sm transition-colors"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
