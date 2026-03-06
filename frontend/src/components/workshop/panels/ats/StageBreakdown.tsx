"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StageScoreBar } from "./StageScoreBar";

interface StageBreakdownProps {
  breakdown: {
    structure: number;
    keywords: number;
    content_quality: number;
    role_proximity: number;
  };
  weights: {
    structure: number;
    keywords: number;
    content_quality: number;
    role_proximity: number;
  };
  failedStages: string[];
}

const STAGE_CONFIG = [
  { key: "structure", label: "Structure" },
  { key: "keywords", label: "Keywords" },
  { key: "content_quality", label: "Content Quality" },
  { key: "role_proximity", label: "Role Proximity" },
] as const;

export function StageBreakdown({
  breakdown,
  weights,
  failedStages,
}: StageBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50"
      >
        <span className="font-medium">Score Breakdown</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {STAGE_CONFIG.map(({ key, label }) => (
            <StageScoreBar
              key={key}
              label={label}
              score={breakdown[key]}
              weight={weights[key]}
              failed={failedStages.includes(key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
