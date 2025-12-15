/**
 * Scoring Version Configurations
 * 
 * This module defines the scoring systems used across different events:
 * - 2022.1: Single winner display only (no detailed breakdown)
 * - 2025.1: Full breakdown with Scream-o-meter
 * - 2026.1: Full breakdown with Costumes/Backgrounds (replacing Scream-o-meter)
 */

export type ScoringVersion = "2022.1" | "2025.1" | "2026.1";

export interface ScoringCategory {
  id: string;
  label: string;
  shortLabel: string;
  maxPoints: number;
  emoji: string;
  description: string;
  type: "judge" | "crowd" | "measurement";
}

export interface ScoringConfig {
  version: ScoringVersion;
  totalPoints: number;
  categories: ScoringCategory[];
  hasDetailedBreakdown: boolean;
  description: string;
}

/**
 * Scoring category definitions
 */
const CATEGORIES = {
  songChoice: {
    id: "song_choice",
    label: "Song Choice",
    shortLabel: "Song",
    maxPoints: 20,
    emoji: "🎵",
    description: "Engaging, recognizable, suited to style",
    type: "judge" as const,
  },
  performance: {
    id: "performance",
    label: "Performance",
    shortLabel: "Perf",
    maxPoints: 30,
    emoji: "🎤",
    description: "Musical ability, stage presence, having fun",
    type: "judge" as const,
  },
  crowdVibe30: {
    id: "crowd_vibe",
    label: "Crowd Vibe",
    shortLabel: "Vibe",
    maxPoints: 30,
    emoji: "🔥",
    description: "Getting crowd moving, energy transfer",
    type: "judge" as const,
  },
  crowdVibe20: {
    id: "crowd_vibe",
    label: "Crowd Vibe",
    shortLabel: "Vibe",
    maxPoints: 20,
    emoji: "🔥",
    description: "Getting crowd moving, energy transfer",
    type: "judge" as const,
  },
  crowdVote: {
    id: "crowd_vote",
    label: "Crowd Vote",
    shortLabel: "Votes",
    maxPoints: 10,
    emoji: "👥",
    description: "Audience voting",
    type: "crowd" as const,
  },
  screamOMeter: {
    id: "scream_o_meter",
    label: "Scream-o-Meter",
    shortLabel: "Noise",
    maxPoints: 10,
    emoji: "🔊",
    description: "Crowd noise energy measurement",
    type: "measurement" as const,
  },
  visuals: {
    id: "visuals",
    label: "Visuals",
    shortLabel: "Visuals",
    maxPoints: 20,
    emoji: "🎨",
    description: "Costumes, backdrops, set design, and visual presentation",
    type: "judge" as const,
  },
};

/**
 * Scoring configurations by version
 */
const SCORING_CONFIGS: Record<ScoringVersion, ScoringConfig> = {
  "2022.1": {
    version: "2022.1",
    totalPoints: 0, // No detailed scoring
    categories: [],
    hasDetailedBreakdown: false,
    description: "Single winner display only",
  },
  "2025.1": {
    version: "2025.1",
    totalPoints: 100,
    categories: [
      CATEGORIES.songChoice,
      CATEGORIES.performance,
      CATEGORIES.crowdVibe30,
      CATEGORIES.crowdVote,
      CATEGORIES.screamOMeter,
    ],
    hasDetailedBreakdown: true,
    description: "Song (20) + Performance (30) + Crowd Vibe (30) + Crowd Vote (10) + Scream-o-Meter (10)",
  },
  "2026.1": {
    version: "2026.1",
    totalPoints: 100,
    categories: [
      CATEGORIES.songChoice,
      CATEGORIES.performance,
      CATEGORIES.crowdVibe20,
      CATEGORIES.crowdVote,
      CATEGORIES.visuals,
    ],
    hasDetailedBreakdown: true,
    description: "Song (20) + Performance (30) + Crowd Vibe (20) + Crowd Vote (10) + Visuals (20)",
  },
};

/**
 * Get scoring configuration for a version
 */
export function getScoringConfig(version: ScoringVersion): ScoringConfig {
  return SCORING_CONFIGS[version];
}

/**
 * Get all categories for a scoring version
 */
export function getCategories(version: ScoringVersion): ScoringCategory[] {
  return SCORING_CONFIGS[version].categories;
}

/**
 * Check if a version has detailed breakdown
 */
export function hasDetailedBreakdown(version: ScoringVersion): boolean {
  return SCORING_CONFIGS[version].hasDetailedBreakdown;
}

/**
 * Get the default scoring version for new events
 */
export function getDefaultScoringVersion(): ScoringVersion {
  return "2026.1";
}

/**
 * Validate a scoring version string
 */
export function isValidScoringVersion(version: string): version is ScoringVersion {
  return version === "2022.1" || version === "2025.1" || version === "2026.1";
}

/**
 * Parse scoring version from event info, with fallback
 */
export function parseScoringVersion(eventInfo?: { scoring_version?: string } | null): ScoringVersion {
  const version = eventInfo?.scoring_version;
  if (version && isValidScoringVersion(version)) {
    return version;
  }
  // Default to 2026.1 for new events without a version
  return "2026.1";
}

/**
 * Score data structure for calculations
 */
export interface BandScoreData {
  avg_song_choice?: number;
  avg_performance?: number;
  avg_crowd_vibe?: number;
  avg_visuals?: number;
  crowd_vote_count?: number;
  total_crowd_votes?: number;
  crowd_score?: number; // Scream-o-meter score (1-10)
}

/**
 * Calculate total score for a band based on scoring version
 */
export function calculateTotalScore(
  scores: BandScoreData,
  version: ScoringVersion,
  allScores?: BandScoreData[] // For calculating normalized crowd vote
): number {
  if (version === "2022.1") {
    return 0; // No scoring for 2022.1
  }

  // Judge scores
  const songChoice = Number(scores.avg_song_choice || 0);
  const performance = Number(scores.avg_performance || 0);
  const crowdVibe = Number(scores.avg_crowd_vibe || 0);

  // Crowd vote (normalized - band with most votes gets 10 points)
  let crowdVoteScore = 0;
  if (allScores && allScores.length > 0) {
    const maxVoteCount = Math.max(
      ...allScores.map((s) => Number(s.crowd_vote_count || 0))
    );
    if (maxVoteCount > 0) {
      crowdVoteScore = (Number(scores.crowd_vote_count || 0) / maxVoteCount) * 10;
    }
  }

  // Version-specific category
  if (version === "2025.1") {
    // Scream-o-meter (already 1-10 scale)
    const screamOMeter = Number(scores.crowd_score || 0);
    return songChoice + performance + crowdVibe + crowdVoteScore + screamOMeter;
  } else if (version === "2026.1") {
    // Visuals (costumes, backdrops, themes)
    const visuals = Number(scores.avg_visuals || 0);
    return songChoice + performance + crowdVibe + crowdVoteScore + visuals;
  }

  return 0;
}

/**
 * Calculate judge-only score (excludes crowd vote and special categories)
 */
export function calculateJudgeScore(
  scores: BandScoreData,
  version: ScoringVersion
): number {
  if (version === "2022.1") {
    return 0;
  }

  const songChoice = Number(scores.avg_song_choice || 0);
  const performance = Number(scores.avg_performance || 0);
  const crowdVibe = Number(scores.avg_crowd_vibe || 0);

  if (version === "2026.1") {
    const visuals = Number(scores.avg_visuals || 0);
    return songChoice + performance + crowdVibe + visuals;
  }

  // 2025.1 - no costumes, crowd vibe is 30
  return songChoice + performance + crowdVibe;
}

/**
 * Get max judge points for a version
 */
export function getMaxJudgePoints(version: ScoringVersion): number {
  if (version === "2022.1") return 0;
  if (version === "2025.1") return 80; // 20 + 30 + 30
  if (version === "2026.1") return 90; // 20 + 30 + 20 + 20
  return 0;
}

/**
 * Get scoring formula description
 */
export function getScoringFormula(version: ScoringVersion): string {
  return SCORING_CONFIGS[version].description;
}

/**
 * Get category by ID for a specific version
 */
export function getCategoryById(
  version: ScoringVersion,
  categoryId: string
): ScoringCategory | undefined {
  return SCORING_CONFIGS[version].categories.find((c) => c.id === categoryId);
}

/**
 * Get winner info from event
 */
export interface EventWinnerInfo {
  scoringVersion: ScoringVersion;
  hasDetailedResults: boolean;
  winnerName?: string;
}

export function getEventWinnerInfo(eventInfo?: { 
  scoring_version?: string; 
  winner?: string;
} | null): EventWinnerInfo {
  const scoringVersion = parseScoringVersion(eventInfo);
  return {
    scoringVersion,
    hasDetailedResults: hasDetailedBreakdown(scoringVersion),
    winnerName: eventInfo?.winner,
  };
}

