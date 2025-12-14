import { getBandScores, getPhotosByLabel, PHOTO_LABELS } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatEventDate } from "@/lib/date-utils";
import Image from "next/image";
import { auth } from "@/lib/auth";
import Link from "next/link";

interface BandScore {
  id: string;
  name: string;
  order: number;
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  avg_crowd_vote: number;
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
  crowd_noise_energy?: number;
  crowd_noise_peak?: number;
  crowd_score?: number;
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
    SELECT b.*, e.name as event_name, e.date, e.location, e.status
    FROM bands b
    JOIN events e ON b.event_id = e.id
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

  // If we need scores but don't have them, show not found
  if ((eventStatus === "finalized" || isAdmin) && !bandScore) {
    notFound();
  }

  // Calculate scores only if we have band score data
  const judgeScore = bandScore
    ? Number(bandScore.avg_song_choice || 0) +
      Number(bandScore.avg_performance || 0) +
      Number(bandScore.avg_crowd_vibe || 0)
    : 0;

  // Crowd score is normalized - band with most votes gets 20, others proportional
  const crowdScore =
    bandScore && scores.length > 0
      ? (() => {
          const maxVoteCount = Math.max(
            ...scores.map((s) => Number(s.crowd_vote_count || 0))
          );
          return maxVoteCount > 0
            ? (Number(bandScore.crowd_vote_count || 0) / maxVoteCount) * 10
            : 0;
        })()
      : 0;

  // Scream-o-meter score from crowd noise measurements (out of 10 points)
  const hasScreamOMeterMeasurement = bandScore
    ? bandScore.crowd_score !== null && bandScore.crowd_score !== undefined
    : false;
  const screamOMeterScore = hasScreamOMeterMeasurement
    ? Number(bandScore!.crowd_score)
    : 0; // Use 1-10 scale as-is for 0-10 points
  const totalScore = judgeScore + crowdScore + screamOMeterScore;

  // Calculate percentage scores
  const songChoicePercent = bandScore
    ? (Number(bandScore.avg_song_choice || 0) / 20) * 100
    : 0;
  const performancePercent = bandScore
    ? (Number(bandScore.avg_performance || 0) / 30) * 100
    : 0;
  const crowdVibePercent = bandScore
    ? (Number(bandScore.avg_crowd_vibe || 0) / 30) * 100
    : 0;
  const crowdVotePercent = bandScore
    ? bandScore.total_crowd_votes > 0
      ? (Number(bandScore.crowd_vote_count || 0) /
          Number(bandScore.total_crowd_votes || 1)) *
        100
      : 0
    : 0;
  const screamOMeterPercent = hasScreamOMeterMeasurement
    ? (Number(bandScore!.crowd_score) / 10) * 100
    : 0;

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
              <h1 className="text-4xl lg:text-5xl font-semibold text-white mb-2">
                {band.name}
              </h1>
              <Link 
                href={`/event/${eventId}`}
                className="text-lg text-text-muted hover:text-accent transition-colors"
              >
                {band.event_name}
              </Link>
              <div className="text-text-dim mt-1">
                {formatEventDate(band.date)} • {band.location}
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

        {/* Total Score - Only show if event is finalized or user is admin */}
        {(eventStatus === "finalized" || isAdmin) && bandScore && (
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl p-8 mb-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Total Score</h2>
            <div className="text-6xl font-bold text-white mb-2">
              {totalScore.toFixed(1)}
            </div>
            <div className="text-xl text-gray-200">out of 100 points</div>
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

        {/* Score Breakdown - Only show if event is finalized or user is admin */}
        {(eventStatus === "finalized" || isAdmin) && bandScore && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Judge Scores */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Judge Scores
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">Song Choice</span>
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
                  <p className="text-gray-300 text-sm mt-1">
                    {songChoicePercent.toFixed(1)}% - Engaging, recognizable,
                    suited to style
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">Performance</span>
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
                  <p className="text-gray-300 text-sm mt-1">
                    {performancePercent.toFixed(1)}% - Musical ability, stage
                    presence, having fun
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">Crowd Vibe</span>
                    <span className="text-white font-bold">
                      {Number(bandScore.avg_crowd_vibe || 0).toFixed(1)}/30
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${crowdVibePercent}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-300 text-sm mt-1">
                    {crowdVibePercent.toFixed(1)}% - Getting crowd moving,
                    energy transfer
                  </p>
                </div>
              </div>
            </div>

            {/* Crowd Vote */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Crowd Vote
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">Crowd Vote</span>
                    <span className="text-white font-bold">
                      {Math.round(crowdScore)}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-slate-400 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${(crowdScore / 10) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-gray-300 text-sm mt-1">
                    <span>{bandScore?.crowd_vote_count || 0} votes</span>
                    <span>{crowdVotePercent.toFixed(1)}% of total votes</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">
                      Scream-o-meter
                    </span>
                    <span className="text-white font-bold">
                      {hasScreamOMeterMeasurement
                        ? `Score: ${screamOMeterScore.toFixed(
                            1
                          )} | Energy: ${Number(
                            bandScore!.crowd_noise_energy || 0
                          ).toFixed(2)}`
                        : "No measurement"}
                    </span>
                  </div>
                  {hasScreamOMeterMeasurement ? (
                    <>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-purple-500 h-3 rounded-full transition-all duration-1000"
                          style={{ width: `${screamOMeterPercent}%` }}
                        ></div>
                      </div>
                      <p className="text-gray-300 text-sm mt-1">
                        {screamOMeterPercent.toFixed(1)}% - Crowd noise energy
                        measurement
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm mt-1">
                      No crowd noise measurement recorded
                    </p>
                  )}
                </div>

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
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
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
                      <span className="text-gray-300">Song Choice (20%):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_song_choice || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Performance (30%):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_performance || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Crowd Vibe (30%):</span>
                      <span className="text-white">
                        {Number(bandScore.avg_crowd_vibe || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="border-t border-white/20 pt-3">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">Judge Total:</span>
                        <span className="text-white">
                          {judgeScore.toFixed(1)}/80
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
                        {Math.round(crowdScore)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Scream-o-meter:</span>
                      <span className="text-white">
                        {hasScreamOMeterMeasurement
                          ? screamOMeterScore.toFixed(1)
                          : "No measurement"}
                      </span>
                    </div>
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
