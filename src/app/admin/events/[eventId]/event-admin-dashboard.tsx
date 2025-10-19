"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatEventDate } from "@/lib/date-utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
}

interface EventAdminDashboardProps {
  eventId: string;
}

export default function EventAdminDashboard({
  eventId,
}: EventAdminDashboardProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-xl">Event not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Event Header */}
      <div className="text-center mb-12">
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

      {/* Action Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
        {/* Crowd Voting */}
        <Link
          href={`/live/events/${eventId}/voting-qr`}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center hover:bg-white/20 transition-colors group"
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
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center hover:bg-white/20 transition-colors group"
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
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center hover:bg-white/20 transition-colors group"
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
      </div>

      {/* Additional Actions */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Event Management
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
