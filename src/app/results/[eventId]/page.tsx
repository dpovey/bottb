import { getEventById, getBandsForEvent, getBandScores } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatEventDate } from "@/lib/date-utils";
import Image from "next/image";

interface BandScore {
  id: string;
  name: string;
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
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  avg_crowd_vote: number;
  crowd_vote_count: number;
  judge_vote_count: number;
  total_crowd_votes: number;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  // Redirect to crowd voting if event is not finalized
  if (event.status !== "finalized") {
    redirect(`/vote/crowd/${eventId}`);
  }

  const bands = await getBandsForEvent(eventId);
  const scores = (await getBandScores(eventId)) as BandScore[];

  // Calculate final scores and rankings
  const bandResults = scores
    .map((score) => {
      const judgeScore =
        Number(score.avg_song_choice || 0) +
        Number(score.avg_performance || 0) +
        Number(score.avg_crowd_vibe || 0);
      const crowdScore =
        score.total_crowd_votes > 0
          ? (Number(score.crowd_vote_count || 0) /
              Number(score.total_crowd_votes || 1)) *
            20
          : 0;
      const totalScore = judgeScore + crowdScore;

      return {
        ...score,
        judgeScore,
        crowdScore,
        totalScore,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  // Find category winners
  const songChoiceWinner =
    bandResults.length > 0
      ? bandResults.reduce((prev, current) =>
          Number(current.avg_song_choice || 0) >
          Number(prev.avg_song_choice || 0)
            ? current
            : prev
        )
      : null;

  const performanceWinner =
    bandResults.length > 0
      ? bandResults.reduce((prev, current) =>
          Number(current.avg_performance || 0) >
          Number(prev.avg_performance || 0)
            ? current
            : prev
        )
      : null;

  const crowdVibeWinner =
    bandResults.length > 0
      ? bandResults.reduce((prev, current) =>
          Number(current.avg_crowd_vibe || 0) > Number(prev.avg_crowd_vibe || 0)
            ? current
            : prev
        )
      : null;

  const crowdVoteWinner =
    bandResults.length > 0
      ? bandResults.reduce((prev, current) =>
          (current.crowdScore || 0) > (prev.crowdScore || 0) ? current : prev
        )
      : null;

  const overallWinner = bandResults[0];

  // If no results, show message
  if (bandResults.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              Battle Results
            </h1>
            <h2 className="text-2xl text-gray-300 mb-2">{event.name}</h2>
            <p className="text-gray-400">
              {formatEventDate(event.date)} • {event.location}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              No Results Yet
            </h2>
            <p className="text-gray-300 text-lg">
              Voting hasn&apos;t started yet or no votes have been submitted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Battle Results</h1>
          <h2 className="text-2xl text-gray-300 mb-2">{event.name}</h2>
          <p className="text-gray-400">
            {formatEventDate(event.date)} • {event.location}
          </p>
        </div>

        {/* Overall Winner */}
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-8 mb-12 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-4xl font-bold text-white mb-2">Overall Winner</h2>
          <h3 className="text-3xl font-semibold text-white mb-4">
            {overallWinner.name}
          </h3>
          <div className="text-2xl font-bold text-white">
            {(overallWinner.totalScore || 0).toFixed(1)} points
          </div>
        </div>

        {/* Category Winners */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🎵</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Song Choice
            </h3>
            <p className="text-xl font-bold text-green-400">
              {songChoiceWinner?.name || "N/A"}
            </p>
            <p className="text-sm text-gray-300">
              {songChoiceWinner
                ? Number(songChoiceWinner.avg_song_choice || 0).toFixed(1) +
                  "/20"
                : "N/A"}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🎤</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Performance
            </h3>
            <p className="text-xl font-bold text-blue-400">
              {performanceWinner?.name || "N/A"}
            </p>
            <p className="text-sm text-gray-300">
              {performanceWinner
                ? Number(performanceWinner.avg_performance || 0).toFixed(1) +
                  "/30"
                : "N/A"}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🔥</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Crowd Vibe
            </h3>
            <p className="text-xl font-bold text-red-400">
              {crowdVibeWinner?.name || "N/A"}
            </p>
            <p className="text-sm text-gray-300">
              {crowdVibeWinner
                ? Number(crowdVibeWinner.avg_crowd_vibe || 0).toFixed(1) + "/30"
                : "N/A"}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Crowd Vote
            </h3>
            <p className="text-xl font-bold text-slate-300">
              {crowdVoteWinner?.name || "N/A"}
            </p>
            <p className="text-sm text-gray-300">
              {crowdVoteWinner
                ? Math.round(crowdVoteWinner.crowdScore || 0) + "/20"
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Full Results Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Complete Results
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-4 px-2">Rank</th>
                  <th className="text-left py-4 px-2">Band</th>
                  <th className="text-center py-4 px-2">Song Choice</th>
                  <th className="text-center py-4 px-2">Performance</th>
                  <th className="text-center py-4 px-2">Crowd Vibe</th>
                  <th className="text-center py-4 px-2">Crowd Vote</th>
                  <th className="text-center py-4 px-2">Total</th>
                  <th className="text-center py-4 px-2">Votes</th>
                </tr>
              </thead>
              <tbody>
                {bandResults.map((band, index) => (
                  <tr key={band.id} className="border-b border-white/10">
                    <td className="py-4 px-2">
                      <span
                        className={`text-2xl font-bold ${
                          index === 0
                            ? "text-yellow-400"
                            : index === 1
                            ? "text-gray-300"
                            : index === 2
                            ? "text-orange-400"
                            : "text-gray-400"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-4 px-2 font-semibold">
                      <div className="flex items-center space-x-3">
                        {/* Band Logo */}
                        <div className="w-8 h-8 flex-shrink-0">
                          {band.info?.logo_url ? (
                            <Image
                              src={band.info.logo_url}
                              alt={`${band.name} logo`}
                              width={32}
                              height={32}
                              className="w-full h-full object-contain rounded"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-700 rounded flex items-center justify-center">
                              <span className="text-gray-400 text-xs">?</span>
                            </div>
                          )}
                        </div>
                        <span>{band.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                      {Number(band.avg_song_choice || 0).toFixed(1)}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {Number(band.avg_performance || 0).toFixed(1)}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {Number(band.avg_crowd_vibe || 0).toFixed(1)}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {Math.round(band.crowdScore || 0)}
                    </td>
                    <td className="py-4 px-2 text-center font-bold">
                      {Number(band.totalScore || 0).toFixed(1)}
                    </td>
                    <td className="py-4 px-2 text-center text-sm text-gray-300">
                      {band.judge_vote_count}J, {band.crowd_vote_count}C
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Band Links */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">
            Individual Band Breakdowns
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bands.map((band) => (
              <a
                key={band.id}
                href={`/band/${band.id}`}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-2">
                  {/* Band Logo */}
                  <div className="w-12 h-12 flex-shrink-0">
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
                  <h3 className="text-lg font-semibold text-white">
                    {band.name}
                  </h3>
                </div>
                <p className="text-gray-300 text-sm">View detailed breakdown</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
