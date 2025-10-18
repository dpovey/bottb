"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  getClientUserContext,
  setVotingCookie,
  getFingerprintJSData,
} from "@/lib/user-context";

interface Band {
  id: string;
  name: string;
  description?: string;
  order: number;
  info?: {
    logo_url?: string;
    website?: string;
    social_media?: {
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    genre?: string;
    members?: string[];
    [key: string]: unknown;
  };
}

interface JudgeScores {
  song_choice: number;
  performance: number;
  crowd_vibe: number;
}

export default function JudgeVotingPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [bands, setBands] = useState<Band[]>([]);
  const [scores, setScores] = useState<Record<string, JudgeScores>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false);

  useEffect(() => {
    const fetchBands = async () => {
      try {
        const response = await fetch(`/api/bands/${eventId}`);
        const data = await response.json();

        // Ensure data is an array
        const bandsData = Array.isArray(data) ? data : [];
        setBands(bandsData);

        // Initialize scores
        const initialScores: Record<string, JudgeScores> = {};
        bandsData.forEach((band: Band) => {
          initialScores[band.id] = {
            song_choice: 0,
            performance: 0,
            crowd_vibe: 0,
          };
        });
        setScores(initialScores);
      } catch (error) {
        console.error("Error fetching bands:", error);
        // Set empty array on error to prevent map errors
        setBands([]);
      }
    };

    // Note: We don't check for cookies here anymore
    // Cookies allow vote updates, only fingerprints block voting

    fetchBands();
  }, [eventId]);

  const handleScoreChange = (
    bandId: string,
    criterion: keyof JudgeScores,
    value: number
  ) => {
    setScores((prev) => ({
      ...prev,
      [bandId]: {
        ...prev[bandId],
        [criterion]: value,
      },
    }));
  };

  const isFormValid = () => {
    return bands.every((band) => {
      const bandScores = scores[band.id];
      return (
        bandScores &&
        bandScores.song_choice > 0 &&
        bandScores.performance > 0 &&
        bandScores.crowd_vibe > 0
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    try {
      // Get client-side user context
      const clientContext = getClientUserContext();

      // Get FingerprintJS data
      let fingerprintData;
      try {
        fingerprintData = await getFingerprintJSData();
      } catch (error) {
        console.warn("FingerprintJS failed, continuing without it:", error);
        fingerprintData = null;
      }

      const votes = bands.map((band) => ({
        event_id: eventId,
        band_id: band.id,
        voter_type: "judge" as const,
        ...scores[band.id],
      }));

      const response = await fetch("/api/votes/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Send client context as headers
          "X-Screen-Resolution": clientContext.screen_resolution || "",
          "X-Timezone": clientContext.timezone || "",
          "X-Language": clientContext.language || "",
          // Send FingerprintJS visitor ID and confidence as headers (small data)
          "X-FingerprintJS-Visitor-ID": fingerprintData?.visitorId || "",
          "X-FingerprintJS-Confidence":
            fingerprintData?.confidence?.toString() || "",
          "X-FingerprintJS-Confidence-Comment":
            fingerprintData?.confidenceComment || "",
        },
        body: JSON.stringify({
          votes,
          // Only send essential fingerprint data, not all components
          fingerprintjs_visitor_id: fingerprintData?.visitorId,
          fingerprintjs_confidence: fingerprintData?.confidence,
          fingerprintjs_confidence_comment: fingerprintData?.confidenceComment,
        }),
      });

      if (response.ok) {
        // Set voting cookie to prevent future votes
        setVotingCookie(eventId);
        setIsSubmitted(true);
      } else {
        if (response.status === 409) {
          setHasAlreadyVoted(true);
          return; // Exit early for duplicate vote
        } else {
          setHasAlreadyVoted(true);
          return; // Exit early for other errors
        }
      }
    } catch (error) {
      console.error("Error submitting votes:", error);
      setHasAlreadyVoted(true);
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
            Scores Submitted!
          </h2>
          <p className="text-gray-300">
            Your scores have been recorded. Thank you for participating!
          </p>
        </div>
      </div>
    );
  }

  if (hasAlreadyVoted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-3xl font-bold text-white mb-4">Already Voted</h2>
          <p className="text-gray-300">
            It looks like you may have already voted for this event. Each judge
            can only vote once.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Judge Scoring</h1>
          <p className="text-gray-300 text-lg">
            Score each band on the judging criteria
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Judging Criteria
              </h2>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Song Choice (20 points)
                  </h3>
                  <p className="text-gray-300 text-xs">
                    Engaging, recognizable, suited to band&apos;s style, fits
                    event energy
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Performance (30 points)
                  </h3>
                  <p className="text-gray-300 text-xs">
                    Musical ability, tightness, stage presence, having fun while
                    nailing it
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Crowd Vibe (30 points)
                  </h3>
                  <p className="text-gray-300 text-xs">
                    Getting crowd moving, singing, clapping, energy transfer
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {bands.map((band, index) => (
                <div key={band.id} className="bg-white/10 rounded-xl p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="text-xl font-semibold text-white">
                      {index + 1}.
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
                          <span className="text-gray-400 text-xs">No Logo</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {band.name}
                      </h3>
                      {band.description && (
                        <p className="text-gray-300">{band.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-white font-medium mb-2">
                        Song Choice: {scores[band.id]?.song_choice || 0}/20
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={scores[band.id]?.song_choice || 0}
                        onChange={(e) =>
                          handleScoreChange(
                            band.id,
                            "song_choice",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        aria-label={`Song Choice for ${band.name}`}
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                            ((scores[band.id]?.song_choice || 0) / 20) * 100
                          }%, #374151 ${
                            ((scores[band.id]?.song_choice || 0) / 20) * 100
                          }%, #374151 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <span>20</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">
                        Performance: {scores[band.id]?.performance || 0}/30
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={scores[band.id]?.performance || 0}
                        onChange={(e) =>
                          handleScoreChange(
                            band.id,
                            "performance",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        aria-label={`Performance for ${band.name}`}
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                            ((scores[band.id]?.performance || 0) / 30) * 100
                          }%, #374151 ${
                            ((scores[band.id]?.performance || 0) / 30) * 100
                          }%, #374151 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <span>30</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">
                        Crowd Vibe: {scores[band.id]?.crowd_vibe || 0}/30
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={scores[band.id]?.crowd_vibe || 0}
                        onChange={(e) =>
                          handleScoreChange(
                            band.id,
                            "crowd_vibe",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        aria-label={`Crowd Vibe for ${band.name}`}
                        style={{
                          background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${
                            ((scores[band.id]?.crowd_vibe || 0) / 30) * 100
                          }%, #374151 ${
                            ((scores[band.id]?.crowd_vibe || 0) / 30) * 100
                          }%, #374151 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <span>30</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-right">
                    <span className="text-white font-medium">
                      Total:{" "}
                      {(scores[band.id]?.song_choice || 0) +
                        (scores[band.id]?.performance || 0) +
                        (scores[band.id]?.crowd_vibe || 0)}
                      /80
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit All Scores"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
