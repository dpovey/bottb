'use client'

import { Card } from '@/components/ui'
import { ScoringVersion, getCategories, getScoringFormula } from '@/lib/scoring'

export interface ScoringLegendProps {
  /** Scoring version */
  scoringVersion: ScoringVersion
  /** Whether to show in compact mode */
  compact?: boolean
}

export function ScoringLegend({
  scoringVersion,
  compact = false,
}: ScoringLegendProps) {
  const categories = getCategories(scoringVersion)
  const formula = getScoringFormula(scoringVersion)

  if (categories.length === 0) {
    return null // No legend for 2022.1
  }

  if (compact) {
    return (
      <div className="text-sm text-text-muted">
        <span className="text-text-dim">Scoring: </span>
        {formula}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      <h4 className="text-xs tracking-widest uppercase text-text-muted mb-4">
        Scoring System
      </h4>

      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category.id} className="flex items-start gap-3">
            <span className="text-xl">{category.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{category.label}</span>
                <span className="text-accent">{category.maxPoints} pts</span>
              </div>
              <p className="text-sm text-text-dim">{category.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Total</span>
          <span className="font-semibold text-white">100 points</span>
        </div>
      </div>
    </Card>
  )
}
