"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useATSStaleness } from "../hooks/useATSStaleness";

interface ATSScoreBadgeProps {
  size?: "sm" | "md";
  onClick?: () => void;
}

export function ATSScoreBadge({ size = "md", onClick }: ATSScoreBadgeProps) {
  const { hasScore, isStale, score, hasKnockouts, hasHardKnockouts } = useATSStaleness();

  if (!hasScore || score === null) {
    return null;
  }

  const isSmall = size === "sm";

  // Determine color based on state
  const getBadgeColor = () => {
    if (hasHardKnockouts) return "bg-red-100 text-red-800 border-red-200";
    if (isStale) return "bg-amber-100 text-amber-800 border-amber-200";
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 border rounded-full font-medium transition-colors hover:opacity-80",
        getBadgeColor(),
        isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {hasHardKnockouts && (
        <AlertTriangle className={cn("text-red-600", isSmall ? "w-3 h-3" : "w-3.5 h-3.5")} />
      )}
      {isStale && !hasHardKnockouts && (
        <Clock className={cn("text-amber-600", isSmall ? "w-3 h-3" : "w-3.5 h-3.5")} />
      )}
      <span>ATS: {Math.round(score)}</span>
    </button>
  );
}
