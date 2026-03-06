"use client";

import { cn } from "@/lib/utils";

interface StageScoreBarProps {
  label: string;
  score: number;
  weight: number;
  failed?: boolean;
}

export function StageScoreBar({
  label,
  score,
  weight,
  failed,
}: StageScoreBarProps) {
  const percentage = Math.round(weight * 100);
  const barColor = failed
    ? "bg-gray-300"
    : score >= 80 ? "bg-green-500"
    : score >= 60 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={cn(failed && "text-muted-foreground line-through")}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {percentage}% weight
          </span>
          <span className={cn(
            "font-medium",
            failed ? "text-muted-foreground" : ""
          )}>
            {failed ? "Failed" : `${Math.round(score)}/100`}
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${failed ? 0 : score}%` }}
        />
      </div>
    </div>
  );
}
