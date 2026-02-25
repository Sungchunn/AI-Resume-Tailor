"use client";

interface MatchScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { radius: 24, stroke: 5, fontSize: "text-sm", labelSize: "text-xs" },
  md: { radius: 40, stroke: 6, fontSize: "text-xl", labelSize: "text-sm" },
  lg: { radius: 56, stroke: 8, fontSize: "text-2xl", labelSize: "text-base" },
};

function getScoreColor(score: number): { stroke: string; text: string; bg: string } {
  if (score >= 80) {
    return {
      stroke: "#22c55e", // green-500
      text: "text-green-600",
      bg: "bg-green-50",
    };
  }
  if (score >= 60) {
    return {
      stroke: "#eab308", // yellow-500
      text: "text-yellow-600",
      bg: "bg-yellow-50",
    };
  }
  return {
    stroke: "#ef4444", // red-500
    text: "text-red-600",
    bg: "bg-red-50",
  };
}

export function MatchScoreGauge({
  score,
  size = "md",
  showLabel = true,
  className = "",
}: MatchScoreGaugeProps) {
  const config = SIZE_CONFIG[size];
  const { stroke: strokeColor, text: textColor } = getScoreColor(score);

  // SVG arc calculations
  const normalizedRadius = config.radius - config.stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const svgSize = config.radius * 2;
  const center = config.radius;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg
          height={svgSize}
          width={svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            stroke="#e5e7eb"
            fill="transparent"
            strokeWidth={config.stroke}
            r={normalizedRadius}
            cx={center}
            cy={center}
          />
          {/* Progress arc */}
          <circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: "stroke-dashoffset 0.5s ease-in-out",
            }}
            r={normalizedRadius}
            cx={center}
            cy={center}
          />
        </svg>
        {/* Score text in center */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: "translateY(1px)" }}
        >
          <span className={`font-bold ${config.fontSize} ${textColor}`}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className={`mt-1 ${config.labelSize} text-gray-500`}>
          Match Score
        </span>
      )}
    </div>
  );
}

// Compact inline version for headers
interface MatchScoreInlineProps {
  score: number;
  showDelta?: boolean;
  previousScore?: number;
  className?: string;
}

export function MatchScoreInline({
  score,
  showDelta = false,
  previousScore,
  className = "",
}: MatchScoreInlineProps) {
  const { text: textColor, bg: bgColor } = getScoreColor(score);
  const delta = previousScore !== undefined ? score - previousScore : 0;
  const deltaPositive = delta > 0;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${textColor} ${bgColor}`}>
        {Math.round(score)}%
      </span>
      {showDelta && delta !== 0 && (
        <span
          className={`text-xs font-medium ${
            deltaPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {deltaPositive ? "+" : ""}
          {delta.toFixed(1)}
        </span>
      )}
    </div>
  );
}
