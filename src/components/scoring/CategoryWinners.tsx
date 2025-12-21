'use client'

import { Card } from '@/components/ui'
import { ScoringVersion, getCategories, ScoringCategory } from '@/lib/scoring'

export interface CategoryWinnerData {
  /** Category ID */
  categoryId: string
  /** Winning band name */
  winnerName: string
  /** Score achieved */
  score: number
  /** Max possible score for this category */
  maxScore: number
}

export interface CategoryWinnersProps {
  /** Scoring version determines which categories to show */
  scoringVersion: ScoringVersion
  /** Winner data for each category */
  categoryWinners: CategoryWinnerData[]
}

function CategoryCard({
  category,
  winnerName,
  score,
  maxScore,
}: {
  category: ScoringCategory
  winnerName: string
  score: number
  maxScore: number
}) {
  return (
    <Card className="text-center hover:border-white/10 transition-colors">
      <div className="text-3xl mb-3">{category.emoji}</div>
      <h3 className="text-xs tracking-widest uppercase text-text-muted mb-3">
        {category.shortLabel}
      </h3>
      <p className="font-medium text-white truncate mb-1">{winnerName}</p>
      <p className="text-sm text-accent">
        {score.toFixed(1)}
        <span className="text-text-dim">/{maxScore}</span>
      </p>
    </Card>
  )
}

export function CategoryWinners({
  scoringVersion,
  categoryWinners,
}: CategoryWinnersProps) {
  const categories = getCategories(scoringVersion)

  if (categories.length === 0) {
    return null // No categories for 2022.1
  }

  return (
    <section className="py-12 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h3 className="text-sm tracking-widest uppercase text-text-muted mb-6 text-center">
          Category Winners
        </h3>
        <div
          className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${categories.length} gap-4`}
        >
          {categories.map((category) => {
            const winnerData = categoryWinners.find(
              (w) => w.categoryId === category.id
            )

            if (!winnerData) {
              return (
                <Card key={category.id} className="text-center">
                  <div className="text-3xl mb-3">{category.emoji}</div>
                  <h3 className="text-xs tracking-widest uppercase text-text-muted mb-3">
                    {category.shortLabel}
                  </h3>
                  <p className="font-medium text-text-dim">N/A</p>
                </Card>
              )
            }

            return (
              <CategoryCard
                key={category.id}
                category={category}
                winnerName={winnerData.winnerName}
                score={winnerData.score}
                maxScore={winnerData.maxScore}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
