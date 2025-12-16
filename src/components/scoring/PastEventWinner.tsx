"use client";

import { Badge } from "@/components/ui";

export interface PastEventWinnerProps {
  /** Name of the winning band */
  winnerName: string;
  /** Whether to show as a compact badge */
  variant?: "badge" | "inline" | "full";
  /** Additional className */
  className?: string;
}

export function PastEventWinner({
  winnerName,
  variant = "badge",
  className = "",
}: PastEventWinnerProps) {
  if (variant === "badge") {
    return (
      <Badge variant="warning" className={className}>
        🏆 {winnerName}
      </Badge>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`text-warning ${className}`}>
        <span className="font-medium">Winner:</span>{" "}
        <span className="text-white font-semibold">{winnerName}</span>
      </span>
    );
  }

  // Full variant
  return (
    <div className={`p-3 bg-warning/10 border border-warning/20 rounded-lg ${className}`}>
      <div className="text-warning text-sm">
        <span className="font-medium">🏆 Winner:</span>{" "}
        <span className="text-white font-semibold">{winnerName}</span>
      </div>
    </div>
  );
}


