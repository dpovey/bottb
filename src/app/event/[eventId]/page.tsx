"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatEventDate } from "@/lib/date-utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
}

interface Band {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  order: number;
  created_at: string;
}

export default function EventPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventResponse, bandsResponse] = await Promise.all([
          fetch(`/api/events/${eventId}`),
          fetch(`/api/bands/${eventId}`),
        ]);

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          setEvent(eventData);
        }

        if (bandsResponse.ok) {
          const bandsData = await bandsResponse.json();
          setBands(bandsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Event not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Events
            </Link>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">{event.name}</h1>
          <div className="text-2xl text-gray-300 mb-2">{event.location}</div>
          <div className="text-xl text-gray-400">
            {formatEventDate(event.date)}
          </div>
          <div className="mt-4">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                event.status === "voting"
                  ? "bg-green-600 text-white"
                  : event.status === "finalized"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-600 text-white"
              }`}
            >
              {event.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Conditional Content Based on Status */}
        {event.status === "voting" && (
          <div className="max-w-2xl mx-auto mb-12">
            <Link
              href={`/vote/crowd/${eventId}`}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-2xl text-center transition-colors block text-2xl"
            >
              🎵 Vote for Bands
            </Link>
          </div>
        )}

        {event.status === "finalized" && (
          <div className="max-w-2xl mx-auto mb-12">
            <Link
              href={`/results/${eventId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-2xl text-center transition-colors block text-2xl"
            >
              📊 View Results
            </Link>
          </div>
        )}

        {/* Bands List */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <h3 className="text-3xl font-bold text-white mb-8 text-center">
              Bands
            </h3>
            {bands.length === 0 ? (
              <div className="text-center text-gray-400 text-lg">
                No bands registered for this event yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {bands.map((band) => (
                  <div
                    key={band.id}
                    className="bg-white/5 rounded-xl p-6 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-white w-8">
                          {band.order}
                        </div>
                        {/* Band Logo */}
                        <div className="w-16 h-16 flex-shrink-0">
                          {band.info?.logo_url ? (
                            <Image
                              src={band.info.logo_url}
                              alt={`${band.name} logo`}
                              width={64}
                              height={64}
                              className="w-full h-full object-contain rounded-lg"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-xs">
                                No Logo
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-white">
                            {band.name}
                          </h4>
                          {band.description && (
                            <p className="text-gray-300 text-sm mt-1">
                              {band.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
