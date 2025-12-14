import {
  getEventById,
  getBandsForEvent,
  getBandScores,
} from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatEventDate } from "@/lib/date-utils";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { WebLayout } from "@/components/layouts";
import { Card, Badge, Button, BandThumbnail } from "@/components/ui";

interface BandScore {
  id: string;
  name: string;
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

interface DisplayResult {
  id: string;
  name: string;
  avg_song_choice: number;
  avg_performance: number;
  avg_crowd_vibe: number;
  crowd_vote_count: number;
  total_crowd_votes: number;
  crowd_noise_energy?: number;
  crowdNoiseScore: number;
  judgeScore: number;
  crowdScore: number;
  totalScore: number;
  hero_thumbnail_url?: string;
  info?: BandScore["info"];
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await auth();
  const isAdmin = session?.user?.isAdmin || false;
  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  if (event.status !== "finalized" && !isAdmin) {
    redirect(`/vote/crowd/${eventId}`);
  }

  const bands = await getBandsForEvent(eventId);
  
  // Calculate scores dynamically from current vote data
  const scores = (await getBandScores(eventId)) as BandScore[];
  const bandResults: DisplayResult[] = scores
      .map((score) => {
        const judgeScore =
          Number(score.avg_song_choice || 0) +
          Number(score.avg_performance || 0) +
          Number(score.avg_crowd_vibe || 0);

        const maxVoteCount = Math.max(
          ...scores.map((s) => Number(s.crowd_vote_count || 0))
        );
        const crowdScore =
          maxVoteCount > 0
            ? (Number(score.crowd_vote_count || 0) / maxVoteCount) * 10
            : 0;

        const crowdNoiseScore = score.crowd_score
          ? Number(score.crowd_score)
          : 0;

        const totalScore = judgeScore + crowdScore + crowdNoiseScore;

        return {
          id: score.id,
          name: score.name,
          avg_song_choice: Number(score.avg_song_choice || 0),
          avg_performance: Number(score.avg_performance || 0),
          avg_crowd_vibe: Number(score.avg_crowd_vibe || 0),
          crowd_vote_count: Number(score.crowd_vote_count || 0),
          total_crowd_votes: Number(score.total_crowd_votes || 0),
          crowd_noise_energy: score.crowd_noise_energy,
          hero_thumbnail_url: score.hero_thumbnail_url,
          info: score.info,
          judgeScore,
          crowdScore,
          crowdNoiseScore,
          totalScore,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);

  // Find category winners
  const categoryWinners = bandResults.length > 0 ? {
    songChoice: bandResults.reduce((prev, current) =>
      Number(current.avg_song_choice || 0) > Number(prev.avg_song_choice || 0) ? current : prev
    ),
    performance: bandResults.reduce((prev, current) =>
      Number(current.avg_performance || 0) > Number(prev.avg_performance || 0) ? current : prev
    ),
    crowdVibe: bandResults.reduce((prev, current) =>
      Number(current.avg_crowd_vibe || 0) > Number(prev.avg_crowd_vibe || 0) ? current : prev
    ),
    crowdVote: bandResults.reduce((prev, current) =>
      (current.crowdScore || 0) > (prev.crowdScore || 0) ? current : prev
    ),
    crowdNoise: bandResults.reduce((prev, current) =>
      (current.crowdNoiseScore || 0) > (prev.crowdNoiseScore || 0) ? current : prev
    ),
  } : null;

  const overallWinner = bandResults[0];

  const breadcrumbs = [
    { label: "Events", href: "/" },
    { label: event.name, href: `/event/${eventId}` },
    { label: "Results" },
  ];

  if (bandResults.length === 0) {
    return (
      <WebLayout breadcrumbs={breadcrumbs}>
        <div className="py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-semibold text-white mb-4">Results</h1>
            <p className="text-text-muted mb-8">{event.name}</p>
            <Card className="max-w-md mx-auto py-12">
              <h2 className="text-xl font-semibold text-white mb-2">No Results Yet</h2>
              <p className="text-text-muted">
                Voting hasn&apos;t started yet or no votes have been submitted.
              </p>
            </Card>
          </div>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout breadcrumbs={breadcrumbs}>
      {/* Page Header */}
      <section className="py-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-sm tracking-widest uppercase text-text-muted mb-3">
            Battle Results
          </h1>
          <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-2">
            {event.name}
          </h2>
          <p className="text-text-muted">
            {formatEventDate(event.date)} • {event.location}
          </p>
        </div>
      </section>

      {/* Overall Winner */}
      <section className="py-12 bg-bg-muted">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Card
            className="text-center py-12 bg-gradient-to-br from-warning/20 via-warning/10 to-transparent border-warning/30"
          >
            <Badge variant="warning" className="mb-4">Champion</Badge>
            <h2 className="text-3xl lg:text-4xl font-semibold text-white mb-2">
              {overallWinner.name}
            </h2>
            <p className="text-2xl font-bold text-warning">
              {(overallWinner.totalScore || 0).toFixed(1)} points
            </p>
          </Card>
        </div>
      </section>

      {/* Category Winners */}
      {categoryWinners && (
        <section className="py-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6 text-center">
              Category Winners
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Song Choice", winner: categoryWinners.songChoice, score: `${Number(categoryWinners.songChoice.avg_song_choice || 0).toFixed(1)}/20` },
                { label: "Performance", winner: categoryWinners.performance, score: `${Number(categoryWinners.performance.avg_performance || 0).toFixed(1)}/30` },
                { label: "Crowd Vibe", winner: categoryWinners.crowdVibe, score: `${Number(categoryWinners.crowdVibe.avg_crowd_vibe || 0).toFixed(1)}/30` },
                { label: "Crowd Vote", winner: categoryWinners.crowdVote, score: `${Math.round(categoryWinners.crowdVote.crowdScore || 0)}/10` },
                { label: "Crowd Noise", winner: categoryWinners.crowdNoise, score: `${Math.round(categoryWinners.crowdNoise.crowdNoiseScore || 0)}/10` },
              ].map((category) => (
                <Card key={category.label} className="text-center">
                  <p className="text-xs tracking-wider uppercase text-text-dim mb-2">
                    {category.label}
                  </p>
                  <p className="font-semibold text-white truncate mb-1">
                    {category.winner?.name || "N/A"}
                  </p>
                  <p className="text-sm text-text-muted">{category.score}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Full Results Table */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6">
            Complete Results
          </h3>
          
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-white">
                <thead>
                  <tr className="border-b border-white/10 bg-bg-surface">
                    <th className="text-left py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Rank</th>
                    <th className="text-left py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Band</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Song</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Perf</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Vibe</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Vote</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Noise</th>
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bandResults.map((band, index) => (
                    <tr key={band.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4 px-4">
                        <span
                          className={`text-lg font-bold ${
                            index === 0
                              ? "text-warning"
                              : index === 1
                              ? "text-text-muted"
                              : index === 2
                              ? "text-warning/60"
                              : "text-text-dim"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <BandThumbnail
                            logoUrl={band.info?.logo_url}
                            heroThumbnailUrl={band.hero_thumbnail_url}
                            bandName={band.name}
                            size="xs"
                          />
                          <span className="font-medium">{band.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Number(band.avg_song_choice || 0).toFixed(1)}
                      </td>
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Number(band.avg_performance || 0).toFixed(1)}
                      </td>
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Number(band.avg_crowd_vibe || 0).toFixed(1)}
                      </td>
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Math.round(band.crowdScore || 0)}
                      </td>
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Math.round(band.crowdNoiseScore || 0)}
                      </td>
                      <td className="py-4 px-4 text-center font-bold">
                        {Number(band.totalScore || 0).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-white/5 text-right">
              <p className="text-sm text-text-muted">
                Total voters: {bandResults.length > 0 ? bandResults[0].total_crowd_votes || 0 : 0}
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Band Links */}
      <section className="py-12 bg-bg-muted">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6 text-center">
            Band Details
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bands.map((band) => (
              <Link key={band.id} href={`/band/${band.id}`}>
                <Card variant="interactive" className="h-full">
                  <div className="flex items-center gap-3">
                    <BandThumbnail
                      logoUrl={band.info?.logo_url}
                      heroThumbnailUrl={band.hero_thumbnail_url}
                      bandName={band.name}
                      size="sm"
                    />
                    <div>
                      <h4 className="font-semibold text-white">{band.name}</h4>
                      <p className="text-sm text-text-muted">View breakdown</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Back to Event */}
      <section className="py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <Link href={`/event/${eventId}`}>
            <Button variant="outline">Back to Event</Button>
          </Link>
        </div>
      </section>
    </WebLayout>
  );
}
