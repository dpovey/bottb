"use client";

import { Card, Badge, BandThumbnail } from "@/components/ui";
import { ScoringVersion, hasDetailedBreakdown } from "@/lib/scoring";

export interface WinnerDisplayProps {
  /** Name of the winning band */
  winnerName: string;
  /** Company/organization the band represents */
  company?: string;
  /** Total score (only shown for detailed breakdown versions) */
  totalScore?: number;
  /** Logo URL for the band */
  logoUrl?: string;
  /** Hero thumbnail URL for the band */
  heroThumbnailUrl?: string;
  /** Scoring version */
  scoringVersion: ScoringVersion;
  /** Event name */
  eventName?: string;
  /** Event date */
  eventDate?: string;
  /** Event location */
  eventLocation?: string;
}

export function WinnerDisplay({
  winnerName,
  company,
  totalScore,
  logoUrl,
  heroThumbnailUrl,
  scoringVersion,
  eventName,
  eventDate,
  eventLocation,
}: WinnerDisplayProps) {
  const showScore = hasDetailedBreakdown(scoringVersion) && totalScore !== undefined;

  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-warning/20 via-warning/10 to-warning/20 rounded-3xl blur-2xl" />
      
      <Card
        className="relative text-center py-12 bg-gradient-to-br from-warning/20 via-warning/10 to-transparent border-warning/30"
        style={{
          boxShadow: "0 0 60px rgba(245, 166, 35, 0.3), 0 0 100px rgba(245, 166, 35, 0.1)",
        }}
      >
        {/* Trophy */}
        <div className="text-7xl mb-4">🏆</div>
        
        {/* Label */}
        <Badge variant="warning" className="mb-4">
          {scoringVersion === "2022.1" ? "Winner" : "Champion"}
        </Badge>
        
        {/* Winner Name */}
        <h2 className="text-3xl lg:text-5xl font-semibold text-white mb-4">
          {winnerName}
        </h2>
        
        {/* Company/Logo */}
        {(company || logoUrl || heroThumbnailUrl) && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <BandThumbnail
              logoUrl={logoUrl}
              heroThumbnailUrl={heroThumbnailUrl}
              bandName={winnerName}
              size="md"
            />
            {company && (
              <span className="text-text-muted">representing {company}</span>
            )}
          </div>
        )}
        
        {/* Score (only for detailed breakdown versions) */}
        {showScore && (
          <div className="inline-flex items-baseline gap-1">
            <span className="text-5xl lg:text-6xl font-bold text-warning">
              {totalScore.toFixed(1)}
            </span>
            <span className="text-xl text-text-muted">/ 100 points</span>
          </div>
        )}
        
        {/* Event info for 2022.1 single winner display */}
        {!showScore && eventName && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-text-muted">
              {eventName}
              {eventDate && ` • ${eventDate}`}
              {eventLocation && ` • ${eventLocation}`}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

