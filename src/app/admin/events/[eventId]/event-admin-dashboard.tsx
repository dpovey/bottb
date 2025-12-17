"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatEventDate } from "@/lib/date-utils";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  timezone: string;
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearScores = async () => {
    setIsClearing(true);
    try {
      const response = await fetch(`/api/events/${eventId}/clear-scores`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        setShowClearConfirm(false);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error clearing scores:", error);
      alert("❌ Failed to clear scores");
    } finally {
      setIsClearing(false);
    }
  };

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
    <div className="space-y-8">
      {/* Status Badge */}
      <div className="flex items-center gap-4">
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
              {isClearing ? "⏳ Clearing..." : "🗑️ Clear Scores"}
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
              This will permanently delete all voting data for{" "}
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
                {isClearing ? "Clearing..." : "Yes, Clear All Scores"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
