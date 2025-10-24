"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  getClientUserContext,
  hasVotingCookie,
  getFingerprintJSData,
  getVoteFromCookie,
} from "@/lib/user-context-client";

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

export default function CrowdVotingPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBand, setSelectedBand] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicateError, setDuplicateError] = useState<string>("");
  const [voteStatus, setVoteStatus] = useState<"approved" | "pending">(
    "approved"
  );
  const [previousVote, setPreviousVote] = useState<{
    bandId: string;
    bandName: string;
  } | null>(null);

  useEffect(() => {
    const fetchBands = async () => {
      try {
        const response = await fetch(`/api/bands/${eventId}`);
        const data = await response.json();

        // Ensure data is an array
        const bandsData = Array.isArray(data) ? data : [];
        setBands(bandsData);
      } catch (error) {
        console.error("Error fetching bands:", error);
        // Set empty array on error to prevent map errors
        setBands([]);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPreviousVote = () => {
      // Check if user has a voting cookie and get vote data
      if (hasVotingCookie(eventId)) {
        const voteData = getVoteFromCookie(eventId);
        if (voteData) {
          setPreviousVote(voteData);
          setSelectedBand(voteData.bandId); // Pre-select the previous choice
        }
      }
    };

    fetchBands();
    fetchPreviousVote();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBand) return;

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

      const response = await fetch("/api/votes", {
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
          event_id: eventId,
          band_id: selectedBand,
          voter_type: "crowd",
          crowd_vote: 20, // Crowd gets full points for crowd vote
          email: email || undefined, // Only send email if provided
          // Only send essential fingerprint data, not all components
          fingerprintjs_visitor_id: fingerprintData?.visitorId,
          fingerprintjs_confidence: fingerprintData?.confidence,
          fingerprintjs_confidence_comment: fingerprintData?.confidenceComment,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Cookie is set by server with vote data
        setVoteStatus(data.status || "approved");
        setIsSubmitted(true);
      } else {
        if (response.status === 400 && data.duplicateDetected) {
          // Duplicate detected but no email provided
          setDuplicateError(data.message);
          return;
        } else if (response.status === 403) {
          // Event status validation error
          setDuplicateError(
            data.message || "Voting is not currently open for this event"
          );
          return;
        } else if (response.status === 404) {
          // Event not found
          setDuplicateError("Event not found");
          return;
        } else if (response.status === 409) {
          setHasAlreadyVoted(true);
          return; // Exit early for other duplicate vote scenarios
        } else {
          setHasAlreadyVoted(true);
          return; // Exit early for other errors
        }
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      setHasAlreadyVoted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">
            {voteStatus === "pending" ? "⏳" : "✅"}
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {voteStatus === "pending" ? "Vote Under Review" : "Vote Submitted!"}
          </h2>
          <p className="text-gray-300">
            {voteStatus === "pending"
              ? "Your vote has been recorded and will be reviewed for approval. Thank you for participating!"
              : "Your vote has been recorded. Thank you for participating!"}
          </p>
        </div>
      </div>
    );
  }

  if (hasAlreadyVoted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-3xl font-bold text-white mb-4">Already Voted</h2>
          <p className="text-gray-300">
            It looks like you may have already voted for this event. Each person
            can only vote once.
          </p>
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
        <h1 className="text-4xl font-bold text-white mb-4">Crowd Voting</h1>
        <p className="text-gray-300 text-lg">Vote for your favorite band!</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            Select Your Favorite Band
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

          {previousVote && (
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="text-blue-400 mr-3">ℹ️</div>
                <div>
                  <p className="text-blue-100 font-medium">
                    You previously voted for{" "}
                    <span className="text-blue-300 font-bold">
                      {previousVote.bandName}
                    </span>
                  </p>
                  <p className="text-blue-200 text-sm mt-1">
                    You can change your vote by selecting a different band
                    below.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                  {/* Band Logo */}
                  <div className="w-12 h-12 flex-shrink-0 mr-4">
                    {band.info?.logo_url ? (
                      <Image
                        src={band.info.logo_url}
                        alt={`${band.name} logo`}
                        width={48}
                        height={48}
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
                      <p className="text-gray-300 mt-1">{band.description}</p>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Email input field */}
          <div className="mt-6">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email (Optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email to receive updates"
              className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              Providing your email is optional and helps us prevent duplicate
              votes.
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedBand || isSubmitting}
            className="w-full mt-8 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors"
          >
            {isSubmitting
              ? "Submitting..."
              : previousVote
              ? "Update Vote"
              : "Submit Vote"}
          </button>
        </div>
      </form>
    </div>
  );
}
