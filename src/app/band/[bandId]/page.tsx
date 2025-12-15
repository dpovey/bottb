import { getBandScores, getPhotosByLabel, PHOTO_LABELS } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatEventDate } from "@/lib/date-utils";
import Image from "next/image";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { CompanyBadge } from "@/components/ui";
import {
  parseScoringVersion,
  hasDetailedBreakdown,
  calculateTotalScore,
  getCategories,
  getScoringFormula,
  type BandScoreData,
} from "@/lib/scoring";

interface BandScore {
  id: string;
  name: string;
  order: number;
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  avg_visuals?: number;
  avg_crowd_vote: number;
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  crowd_noise_energy?: number;
  crowd_noise_peak?: number;
  crowd_score?: number;
}

interface EventInfo {
  scoring_version?: string;
  winner?: string;
  [key: string]: unknown;
}

export default async function BandPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;

  // Check if user is admin
  const session = await auth();
  const isAdmin = session?.user?.isAdmin || false;

  // Get all events to find which one contains this band
  const { sql } = await import("@vercel/postgres");
  const { rows: bandData } = await sql`
    SELECT b.*, e.name as event_name, e.date, e.location, e.timezone, e.status, e.info as event_info,
           c.name as company_name, c.slug as company_slug
    FROM bands b
    JOIN events e ON b.event_id = e.id
    LEFT JOIN companies c ON b.company_slug = c.slug
    WHERE b.id = ${bandId}
  `;

  if (bandData.length === 0) {
    notFound();
  }

  const band = bandData[0];
  if (!band || !band.event_id) {
    notFound();
  }

  const eventId = band.event_id;
  const eventStatus = band.status;
  const eventInfo = band.event_info as EventInfo | null;
  const scoringVersion = parseScoringVersion(eventInfo);
  const showDetailedBreakdown = hasDetailedBreakdown(scoringVersion);

  // Fetch band hero photos
  const bandHeroPhotos = await getPhotosByLabel(PHOTO_LABELS.BAND_HERO, { bandId });
  const heroPhoto = bandHeroPhotos.length > 0 ? bandHeroPhotos[0] : null;
  const heroPhotoUrl = heroPhoto?.blob_url ?? null;
  const heroFocalPoint = heroPhoto?.hero_focal_point ?? { x: 50, y: 50 };

  // Only fetch scores if event is finalized or user is admin
  let scores: BandScore[] = [];
  let bandScore: BandScore | null = null;

  if (eventStatus === "finalized" || isAdmin) {
    scores = (await getBandScores(eventId)) as BandScore[];
    bandScore = scores.find((score) => score.id === bandId) || null;
  }

  // For 2022.1 events, check if this band is the winner
  const isWinner = !showDetailedBreakdown && eventInfo?.winner === band.name;

  // Calculate scores only if we have band score data and detailed breakdown
  let totalScore = 0;
  let judgeScore = 0;
  let crowdVoteScore = 0;
  let screamOMeterScore = 0;
  let visualsScore = 0;

  if (showDetailedBreakdown && bandScore) {
    const scoreData: BandScoreData = {
      avg_song_choice: bandScore.avg_song_choice,
      avg_performance: bandScore.avg_performance,
      avg_crowd_vibe: bandScore.avg_crowd_vibe,
      avg_visuals: bandScore.avg_visuals,
      crowd_vote_count: bandScore.crowd_vote_count,
      total_crowd_votes: bandScore.total_crowd_votes,
      crowd_score: bandScore.crowd_score,
    };

    // Calculate normalized crowd vote score
    const maxVoteCount = Math.max(
      ...scores.map((s) => Number(s.crowd_vote_count || 0))
    );
    crowdVoteScore = maxVoteCount > 0
      ? (Number(bandScore.crowd_vote_count || 0) / maxVoteCount) * 10
      : 0;

    // Version-specific scores
    if (scoringVersion === "2025.1") {
      screamOMeterScore = bandScore.crowd_score ? Number(bandScore.crowd_score) : 0;
    } else if (scoringVersion === "2026.1") {
      visualsScore = Number(bandScore.avg_visuals || 0);
    }

    // Calculate total
    totalScore = calculateTotalScore(
      scoreData,
      scoringVersion,
      scores.map((s) => ({
        avg_song_choice: s.avg_song_choice,
        avg_performance: s.avg_performance,
        avg_crowd_vibe: s.avg_crowd_vibe,
        avg_visuals: s.avg_visuals,
        crowd_vote_count: s.crowd_vote_count,
        total_crowd_votes: s.total_crowd_votes,
        crowd_score: s.crowd_score,
      }))
    );

    judgeScore =
      Number(bandScore.avg_song_choice || 0) +
      Number(bandScore.avg_performance || 0) +
      Number(bandScore.avg_crowd_vibe || 0);
    
    if (scoringVersion === "2026.1") {
      judgeScore += visualsScore;
    }
  }

  // Calculate percentage scores
  const songChoicePercent = bandScore
    ? (Number(bandScore.avg_song_choice || 0) / 20) * 100
    : 0;
  const performancePercent = bandScore
    ? (Number(bandScore.avg_performance || 0) / 30) * 100
    : 0;
  const crowdVibeMax = scoringVersion === "2026.1" ? 20 : 30;
  const crowdVibePercent = bandScore
    ? (Number(bandScore.avg_crowd_vibe || 0) / crowdVibeMax) * 100
    : 0;
  const crowdVotePercent = bandScore
    ? bandScore.total_crowd_votes > 0
      ? (Number(bandScore.crowd_vote_count || 0) /
          Number(bandScore.total_crowd_votes || 1)) *
        100
      : 0
    : 0;
  const visualsPercent = bandScore
    ? (Number(bandScore.avg_visuals || 0) / 20) * 100
    : 0;
  const screamOMeterPercent = bandScore?.crowd_score
    ? (Number(bandScore.crowd_score) / 10) * 100
    : 0;

  const _categories = getCategories(scoringVersion);
  const scoringFormula = getScoringFormula(scoringVersion);
  const maxJudgePoints = scoringVersion === "2026.1" ? 90 : 80;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[40vh] flex items-end">
        {/* Background Image */}
        {heroPhotoUrl ? (
          <Image
            src={heroPhotoUrl}
            alt={`${band.name}`}
            fill
            className="object-cover"
            style={{ objectPosition: `${heroFocalPoint.x}% ${heroFocalPoint.y}%` }}
            priority
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bg-surface via-bg to-bg-elevated" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Band Logo */}
            {band.info?.logo_url && (
              <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-xl overflow-hidden bg-bg-surface border border-white/10">
                <Image
                  src={band.info.logo_url}
                  alt={`${band.name} logo`}
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* Band Info */}
            <div className="flex-1">
              {/* Winner badge for 2022.1 events */}
              {isWinner && (
                <div className="mb-2">
                  <span className="bg-warning/20 border border-warning/30 text-warning px-3 py-1 rounded text-sm font-medium">
                    🏆 Champion
                  </span>
                </div>
              )}
              <h1 className="text-4xl lg:text-5xl font-semibold text-white mb-2">
                {band.name}
              </h1>
              {/* Company badge */}
              {band.company_slug && band.company_name && (
                <div className="mb-2">
                  <CompanyBadge
                    slug={band.company_slug}
                    name={band.company_name}
                    variant="default"
                    size="md"
                  />
                </div>
              )}
              <Link 
                href={`/event/${eventId}`}
                className="text-lg text-text-muted hover:text-accent transition-colors"
              >
                {band.event_name}
              </Link>
              <div className="text-text-dim mt-1">
                {formatEventDate(band.date, band.timezone)} • {band.location}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Description Section */}
      {band.description && (
        <section className="py-8 border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <p className="text-text-muted text-lg">
              {band.description}
            </p>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

        {/* For 2022.1 events - Simple winner/participant display */}
        {!showDetailedBreakdown && (eventStatus === "finalized" || isAdmin) && (
          <div className={`rounded-2xl p-8 mb-12 text-center ${
            isWinner 
              ? "bg-gradient-to-r from-warning/20 via-warning/10 to-warning/20 border border-warning/30"
              : "bg-white/5 border border-white/10"
          }`}>
            <h2 className="text-3xl font-bold text-white mb-4">
              {isWinner ? "🏆 Champion" : "Participant"}
            </h2>
            <div className="text-xl text-gray-200">
              {isWinner 
                ? `${band.name} won ${band.event_name}!`
                : "Detailed scoring not available for this event"}
            </div>
          </div>
        )}

        {/* Total Score - Only show for detailed breakdown versions */}
        {showDetailedBreakdown && (eventStatus === "finalized" || isAdmin) && bandScore && (
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl p-8 mb-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Total Score</h2>
            <div className="text-6xl font-bold text-white mb-2">
              {totalScore.toFixed(1)}
            </div>
            <div className="text-xl text-gray-200">out of 100 points</div>
            <p className="text-sm text-gray-400 mt-2">{scoringFormula}</p>
          </div>
        )}

        {/* Event Status Message for Non-Admin Users */}
        {eventStatus !== "finalized" && !isAdmin && (
          <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-2xl p-8 mb-12 text-center">
            <h2 className="text-3xl font-bold text-yellow-400 mb-4">
              {eventStatus === "upcoming"
                ? "Event Upcoming"
                : "Event In Progress"}
            </h2>
            <div className="text-xl text-yellow-200">
              Scores will be available after the event is finalized
            </div>
          </div>
        )}

        {/* Score Breakdown - Only show for detailed breakdown versions */}
        {showDetailedBreakdown && (eventStatus === "finalized" || isAdmin) && bandScore && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Judge Scores */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Judge Scores
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">🎵 Song Choice</span>
                    <span className="text-white font-bold">
                      {Number(bandScore.avg_song_choice || 0).toFixed(1)}/20
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${songChoicePercent}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">🎤 Performance</span>
                    <span className="text-white font-bold">
                      {Number(bandScore.avg_performance || 0).toFixed(1)}/30
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${performancePercent}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">🔥 Crowd Vibe</span>
                    <span className="text-white font-bold">
                      {Number(bandScore.avg_crowd_vibe || 0).toFixed(1)}/{crowdVibeMax}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${crowdVibePercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Visuals - Only for 2026.1 */}
                {scoringVersion === "2026.1" && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">🎨 Visuals</span>
                      <span className="text-white font-bold">
                        {visualsScore.toFixed(1)}/20
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-purple-500 h-3 rounded-full transition-all duration-1000"
                        style={{ width: `${visualsPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Crowd Vote & Special Category */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Crowd Scoring
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">👥 Crowd Vote</span>
                    <span className="text-white font-bold">
                      {Math.round(crowdVoteScore)}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-slate-400 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${(crowdVoteScore / 10) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-gray-300 text-sm mt-1">
                    <span>{bandScore?.crowd_vote_count || 0} votes</span>
                    <span>{crowdVotePercent.toFixed(1)}% of total votes</span>
                  </div>
                </div>

                {/* Scream-o-meter - Only for 2025.1 */}
                {scoringVersion === "2025.1" && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">🔊 Scream-o-meter</span>
                      <span className="text-white font-bold">
                        {bandScore.crowd_score
                          ? `${screamOMeterScore.toFixed(1)}/10`
                          : "No measurement"}
                      </span>
                    </div>
                    {bandScore.crowd_score ? (
                      <>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-amber-500 h-3 rounded-full transition-all duration-1000"
                            style={{ width: `${screamOMeterPercent}%` }}
                          ></div>
                        </div>
                        <p className="text-gray-300 text-sm mt-1">
                          Energy: {Number(bandScore.crowd_noise_energy || 0).toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm mt-1">
                        No crowd noise measurement recorded
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-2">
                    Vote Statistics
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Judge Votes:</span>
                      <span className="text-white">
                        {bandScore.judge_vote_count}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Crowd Votes:</span>
                      <span className="text-white">
                        {bandScore.crowd_vote_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Summary */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 md:col-span-2">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Score Summary
              </h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Judge Score Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Song Choice (20):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_song_choice || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Performance (30):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_performance || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Crowd Vibe ({crowdVibeMax}):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_crowd_vibe || 0).toFixed(1)}
                      </span>
                    </div>
                    {scoringVersion === "2026.1" && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Visuals (20):</span>
                        <span className="text-white">
                          {visualsScore.toFixed(1)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-white/20 pt-3">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">Judge Total:</span>
                        <span className="text-white">
                          {judgeScore.toFixed(1)}/{maxJudgePoints}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">
                    Final Calculation
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Judge Score:</span>
                      <span className="text-white">
                        {judgeScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Crowd Vote:</span>
                      <span className="text-white">
                        {Math.round(crowdVoteScore)}
                      </span>
                    </div>
                    {scoringVersion === "2025.1" && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Scream-o-meter:</span>
                        <span className="text-white">
                          {bandScore.crowd_score
                            ? screamOMeterScore.toFixed(1)
                            : "N/A"}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-white/20 pt-3">
                      <div className="flex justify-between font-bold text-xl">
                        <span className="text-white">Total Score:</span>
                        <span className="text-white">
                          {totalScore.toFixed(1)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back to Results - Only show if event is finalized or user is admin */}
        {(eventStatus === "finalized" || isAdmin) && (
          <div className="text-center mt-12">
            <Link
              href={`/results/${eventId}`}
              className="bg-accent hover:bg-accent-light text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors inline-block"
            >
              ← Back to Full Results
            </Link>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
