'use client'

import { Card, BandThumbnail, CompanyBadge } from '@/components/ui'
import { ScoringVersion, getCategories, getScoringFormula } from '@/lib/scoring'

export interface BandResultData {
  id: string
  name: string
  companySlug?: string
  companyName?: string
  companyIconUrl?: string
  rank: number
  logoUrl?: string
  heroThumbnailUrl?: string
  // Scores
  songChoice: number
  performance: number
  crowdVibe: number
  crowdVote: number
  crowdVoteCount?: number
  // Version-specific
  screamOMeter?: number // 2025.1
  visuals?: number // 2026.1
  totalScore: number
}

export interface ScoreBreakdownProps {
  /** Scoring version determines which columns to show */
  scoringVersion: ScoringVersion
  /** Results data for all bands */
  results: BandResultData[]
  /** Total number of voters */
  totalVoters?: number
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1:
      return 'text-warning'
    case 2:
      return 'text-text-muted'
    case 3:
      return 'text-warning/60'
    default:
      return 'text-text-dim'
  }
}

export function ScoreBreakdown({
  scoringVersion,
  results,
  totalVoters,
}: ScoreBreakdownProps) {
  const categories = getCategories(scoringVersion)
  const formula = getScoringFormula(scoringVersion)

  if (categories.length === 0) {
    return null // No breakdown for 2022.1
  }

  const is2025 = scoringVersion === '2025.1'
  const is2026 = scoringVersion === '2026.1'

  return (
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
                  <th className="text-left py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Rank
                  </th>
                  <th className="text-left py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Band
                  </th>
                  <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Song
                  </th>
                  <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Perf
                  </th>
                  <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Vibe
                  </th>
                  <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Vote
                  </th>
                  {is2025 && (
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                      Noise
                    </th>
                  )}
                  {is2026 && (
                    <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                      Visuals
                    </th>
                  )}
                  <th className="text-center py-4 px-4 text-xs tracking-wider uppercase text-text-muted">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((band) => (
                  <tr
                    key={band.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-4 px-4">
                      <span
                        className={`text-lg font-bold ${getRankColor(band.rank)}`}
                      >
                        {band.rank}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <BandThumbnail
                          logoUrl={band.logoUrl}
                          heroThumbnailUrl={band.heroThumbnailUrl}
                          bandName={band.name}
                          size="xs"
                        />
                        <div>
                          <span className="font-medium">{band.name}</span>
                          {band.companySlug && band.companyName && (
                            <div className="mt-0.5">
                              <CompanyBadge
                                slug={band.companySlug}
                                name={band.companyName}
                                iconUrl={band.companyIconUrl}
                                variant="default"
                                size="sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-text-muted">
                      {band.songChoice.toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-center text-text-muted">
                      {band.performance.toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-center text-text-muted">
                      {band.crowdVibe.toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-center text-text-muted">
                      <div>{Math.round(band.crowdVote)}</div>
                      {band.crowdVoteCount !== undefined && (
                        <div className="text-xs text-text-dim">
                          {band.crowdVoteCount} votes
                        </div>
                      )}
                    </td>
                    {is2025 && (
                      <td className="py-4 px-4 text-center text-text-muted">
                        {Math.round(band.screamOMeter || 0)}
                      </td>
                    )}
                    {is2026 && (
                      <td className="py-4 px-4 text-center text-text-muted">
                        {(band.visuals || 0).toFixed(1)}
                      </td>
                    )}
                    <td className="py-4 px-4 text-center font-bold">
                      <span className={band.rank === 1 ? 'text-warning' : ''}>
                        {band.totalScore.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with scoring formula */}
          <div className="p-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted">
            <span>Scoring: {formula}</span>
            {totalVoters !== undefined && (
              <span>
                Total voters:{' '}
                <span className="text-white font-medium">{totalVoters}</span>
              </span>
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
