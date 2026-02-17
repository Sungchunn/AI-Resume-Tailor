"use client";

interface MatchScoreProps {
  score: number;
  label?: string;
  showBar?: boolean;
}

export function MatchScore({ score, label = "Match Score", showBar = true }: MatchScoreProps) {
  const getColorClass = (score: number) => {
    if (score >= 80) return { bg: "bg-green-500", text: "text-green-700" };
    if (score >= 60) return { bg: "bg-yellow-500", text: "text-yellow-700" };
    if (score >= 40) return { bg: "bg-orange-500", text: "text-orange-700" };
    return { bg: "bg-red-500", text: "text-red-700" };
  };

  const colors = getColorClass(score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-lg font-bold ${colors.text}`}>{Math.round(score)}%</span>
      </div>
      {showBar && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bg} transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      )}
    </div>
  );
}
