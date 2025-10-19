import { getBandScores } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatEventDate } from "@/lib/date-utils";

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
}

export default async function BandPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  // Get all events to find which one contains this band
  const { sql } = await import("@vercel/postgres");
  const { rows: bandData } = await sql`
    SELECT b.*, e.name as event_name, e.date, e.location
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

  const scores = (await getBandScores(eventId)) as BandScore[];
  const bandScore = scores.find((score) => score.id === bandId);

  if (!bandScore) {
    notFound();
  }

  const judgeScore =
    Number(bandScore?.avg_song_choice || 0) +
    Number(bandScore?.avg_performance || 0) +
    Number(bandScore?.avg_crowd_vibe || 0);

  // Crowd score is the percentage of total crowd votes this band received
  const crowdScore =
    bandScore.total_crowd_votes > 0
      ? (Number(bandScore.crowd_vote_count || 0) /
          Number(bandScore.total_crowd_votes || 1)) *
        20
      : 0;
  const totalScore = judgeScore + crowdScore;

  // Calculate percentage scores
  const songChoicePercent = (Number(bandScore.avg_song_choice || 0) / 20) * 100;
  const performancePercent =
    (Number(bandScore.avg_performance || 0) / 30) * 100;
  const crowdVibePercent = (Number(bandScore.avg_crowd_vibe || 0) / 30) * 100;
  const crowdVotePercent =
    bandScore.total_crowd_votes > 0
      ? (Number(bandScore.crowd_vote_count || 0) /
          Number(bandScore.total_crowd_votes || 1)) *
        100
      : 0;

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">{band.name}</h1>
            <div className="text-xl text-gray-300 mb-2">{band.event_name}</div>
            <div className="text-gray-400">
              {formatEventDate(band.date)} • {band.location}
            </div>
            {band.description && (
              <p className="text-gray-300 mt-4 max-w-2xl mx-auto">
                {band.description}
              </p>
            )}
          </div>

          {/* Total Score */}
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl p-8 mb-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Total Score</h2>
            <div className="text-6xl font-bold text-white mb-2">
              {totalScore.toFixed(1)}
            </div>
            <div className="text-xl text-gray-200">out of 100 points</div>
          </div>

          {/* Score Breakdown */}
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
                      {Math.round(crowdScore)}/20
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-slate-400 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${crowdVotePercent}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-300 text-sm mt-1">
                    {crowdVotePercent.toFixed(1)}% - Direct crowd voting
                  </p>
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
                    <span className="text-white">{judgeScore.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Crowd Vote:</span>
                    <span className="text-white">{Math.round(crowdScore)}</span>
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

          {/* Back to Results */}
          <div className="text-center mt-12">
            <a
              href={`/results/${eventId}`}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors inline-block"
            >
              ← Back to Full Results
            </a>
          </div>
        </div>
    </div>
  );
}
