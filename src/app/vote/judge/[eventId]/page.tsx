"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
// No fingerprinting needed for judge voting
import { BandThumbnail } from "@/components/ui";
import { ScoringVersion, parseScoringVersion } from "@/lib/scoring";

interface Band {
  id: string;
  name: string;
  description?: string;
  order: number;
  hero_thumbnail_url?: string;
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

interface EventInfo {
  scoring_version?: string;
  [key: string]: unknown;
}

interface JudgeScores {
  song_choice: number;
  performance: number;
  crowd_vibe: number;
  visuals: number; // 2026.1 only
}

export default function JudgeVotingPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [bands, setBands] = useState<Band[]>([]);
  const [scores, setScores] = useState<Record<string, JudgeScores>>({});
  const [name, setName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicateError, setDuplicateError] = useState<string>("");
  const [scoringVersion, setScoringVersion] = useState<ScoringVersion>("2026.1");

  // Scoring config based on version
  const is2026 = scoringVersion === "2026.1";
  const crowdVibeMax = is2026 ? 20 : 30;
  const maxJudgeScore = is2026 ? 90 : 80; // 20+30+20+20 vs 20+30+30

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event to get scoring version
        const eventResponse = await fetch(`/api/events/${eventId}`);
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          const eventInfo = eventData.info as EventInfo | null;
          const version = parseScoringVersion(eventInfo);
          setScoringVersion(version);
        }

        // Fetch bands
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
            visuals: 0,
          };
        });
        setScores(initialScores);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Set empty array on error to prevent map errors
        setBands([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Note: We don't check for cookies here anymore
    // Cookies allow vote updates, only fingerprints block voting

    fetchData();
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
    return (
      name.trim() !== "" && // Name is required
      bands.every((band) => {
        const bandScores = scores[band.id];
        const baseValid =
          bandScores &&
          bandScores.song_choice > 0 &&
          bandScores.performance > 0 &&
          bandScores.crowd_vibe > 0;
        
        // For 2026.1, visuals is also required
        if (is2026) {
          return baseValid && bandScores.visuals > 0;
        }
        return baseValid;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    try {
      // No fingerprinting needed for judge voting - admins can vote multiple times

      const votes = bands.map((band) => {
        const voteData: Record<string, unknown> = {
          event_id: eventId,
          band_id: band.id,
          voter_type: "judge" as const,
          name: name, // Name is required for judges
          vote_fingerprint: `${eventId}-${name.toLowerCase().trim()}-${band.id}`, // Unique per event, judge, and band
          song_choice: scores[band.id].song_choice,
          performance: scores[band.id].performance,
          crowd_vibe: scores[band.id].crowd_vibe,
        };
        // Only include visuals for 2026.1
        if (is2026) {
          voteData.visuals = scores[band.id].visuals;
        }
        return voteData;
      });

      const response = await fetch("/api/votes/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          votes,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // No cookie needed for judge voting - admins can vote multiple times
        setIsSubmitted(true);
      } else {
        if (response.status === 403) {
          // Event status validation error
          setDuplicateError(
            data.error || "Voting is not currently open for this event"
          );
          return;
        } else if (response.status === 404) {
          // Event not found
          setDuplicateError("Event not found");
          return;
        } else if (response.status === 409) {
          // Duplicate judge vote
          setDuplicateError(data.error);
          return;
        } else {
          console.error("Error submitting votes:", response.status);
          // Show error but don't block future submissions
        }
      }
    } catch (error) {
      console.error("Error submitting votes:", error);
      // Show error but don't block future submissions
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Scores Submitted!
          </h2>
          <p className="text-gray-300 mb-6">
            Your scores have been recorded. Thank you for judging!
          </p>
          <button
            onClick={() => {
              // Reset form for next judge
              setName("");
              setScores({});
              setIsSubmitted(false);
              setIsSubmitting(false);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            Enter Next Judge&apos;s Scores
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-3xl font-bold text-white mb-4">Loading...</h2>
          <p className="text-gray-300">Fetching bands for this event</p>
        </div>
      </div>
    );
  }

  return (
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

            {duplicateError && (
              <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="text-yellow-400 mr-3">⚠️</div>
                  <div>
                    <p className="text-yellow-100 font-medium">
                      {duplicateError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={`grid gap-4 text-sm ${is2026 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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
                  Crowd Vibe ({crowdVibeMax} points)
                </h3>
                <p className="text-gray-300 text-xs">
                  Getting crowd moving, singing, clapping, energy transfer
                </p>
              </div>
              {is2026 && (
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Visuals (20 points)
                  </h3>
                  <p className="text-gray-300 text-xs">
                    Costumes, backdrops, set design, visual presentation
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Name input field */}
          <div className="mt-6">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter judge's name"
              className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-8 mt-8">
            {bands.map((band, index) => (
              <div key={band.id} className="bg-white/10 rounded-xl p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="text-xl font-semibold text-white">
                    {index + 1}.
                  </div>
                  {/* Band Logo */}
                  <BandThumbnail
                    logoUrl={band.info?.logo_url}
                    heroThumbnailUrl={band.hero_thumbnail_url}
                    bandName={band.name}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {band.name}
                    </h3>
                    {band.description && (
                      <p className="text-gray-300">{band.description}</p>
                    )}
                  </div>
                </div>

                <div className={`grid gap-6 ${is2026 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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
                      Crowd Vibe: {scores[band.id]?.crowd_vibe || 0}/{crowdVibeMax}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={crowdVibeMax}
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
                          ((scores[band.id]?.crowd_vibe || 0) / crowdVibeMax) * 100
                        }%, #374151 ${
                          ((scores[band.id]?.crowd_vibe || 0) / crowdVibeMax) * 100
                        }%, #374151 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0</span>
                      <span>{crowdVibeMax}</span>
                    </div>
                  </div>

                  {is2026 && (
                    <div>
                      <label className="block text-white font-medium mb-2">
                        Visuals: {scores[band.id]?.visuals || 0}/20
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={scores[band.id]?.visuals || 0}
                        onChange={(e) =>
                          handleScoreChange(
                            band.id,
                            "visuals",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        aria-label={`Visuals for ${band.name}`}
                        style={{
                          background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${
                            ((scores[band.id]?.visuals || 0) / 20) * 100
                          }%, #374151 ${
                            ((scores[band.id]?.visuals || 0) / 20) * 100
                          }%, #374151 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <span>20</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-right">
                  <span className="text-white font-medium">
                    Total:{" "}
                    {(scores[band.id]?.song_choice || 0) +
                      (scores[band.id]?.performance || 0) +
                      (scores[band.id]?.crowd_vibe || 0) +
                      (is2026 ? (scores[band.id]?.visuals || 0) : 0)}
                    /{maxJudgeScore}
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
  );
}
