"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Band {
  id: string;
  name: string;
  description?: string;
  order: number;
}

export default function CrowdVotingPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBand, setSelectedBand] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchBands = async () => {
      try {
        const response = await fetch(`/api/bands/${eventId}`);
        const data = await response.json();
        setBands(data);
      } catch (error) {
        console.error("Error fetching bands:", error);
      }
    };

    fetchBands();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBand) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: eventId,
          band_id: selectedBand,
          voter_type: "crowd",
          crowd_vote: 20, // Crowd gets full points for crowd vote
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        throw new Error("Failed to submit vote");
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Vote Submitted!
          </h2>
          <p className="text-gray-300">
            Thank you for voting! Your vote has been recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Crowd Voting</h1>
          <p className="text-gray-300 text-lg">Vote for your favorite band!</p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              Select Your Favorite Band
            </h2>

            <div className="space-y-4">
              {bands.map((band, index) => (
                <label
                  key={band.id}
                  className={`block p-4 rounded-xl cursor-pointer transition-colors ${
                    selectedBand === band.id
                      ? "bg-slate-600/30 border-2 border-slate-400"
                      : "bg-white/10 hover:bg-white/20 border-2 border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name="band"
                    value={band.id}
                    checked={selectedBand === band.id}
                    onChange={(e) => setSelectedBand(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className="text-2xl font-bold text-white mr-4">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {band.name}
                      </h3>
                      {band.description && (
                        <p className="text-gray-300 mt-1">{band.description}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={!selectedBand || isSubmitting}
              className="w-full mt-8 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
