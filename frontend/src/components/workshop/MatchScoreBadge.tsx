"use client";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  // Determine color based on score
  const getColorClasses = () => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${getColorClasses()} ${sizeClasses[size]}`}
    >
      {Math.round(score)}% Match
    </span>
  );
}
