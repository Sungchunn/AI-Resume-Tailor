# Phase 2: Core ATS Panel

**Parent Document:** `070326_master-plan.md`
**Status:** Planning

---

## Overview

Create the main ATS panel as the 4th tab in `WorkshopControlPanel`. Implement core visualization components: score summary, stage breakdown, and knockout alerts.

---

## Panel Structure

```text
ATSPanel.tsx
├── ATSScoreSummary.tsx (always visible)
│   ├── Circular gauge (0-100)
│   ├── Stale indicator
│   └── Re-analyze button
│
├── KnockoutAlerts.tsx (conditional)
│   └── KnockoutRiskCard (per risk)
│
└── StageBreakdown.tsx (collapsible)
    └── StageScoreBar.tsx (per stage)
```

---

## Component: ATSPanel.tsx

Main container following the pattern from `StylePanel.tsx`:

```typescript
"use client";

import { useWorkshop } from "../../WorkshopContext";
import { useATSProgressiveAnalysis } from "../../hooks/useATSProgressiveAnalysis";
import { ATSScoreSummary } from "./ATSScoreSummary";
import { KnockoutAlerts } from "./KnockoutAlerts";
import { StageBreakdown } from "./StageBreakdown";
import { KeywordAnalysis } from "./KeywordAnalysis";

export function ATSPanel() {
  const { state } = useWorkshop();
  const { analyze, isAnalyzing, progress } = useATSProgressiveAnalysis();

  const hasScore = state.atsCompositeScore !== null;
  const hasKnockouts = state.atsKnockoutRisks.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Score Summary - Always Visible */}
        <ATSScoreSummary
          score={state.atsCompositeScore?.final_score ?? null}
          isStale={state.atsIsStale}
          isAnalyzing={isAnalyzing}
          progress={progress}
          lastAnalyzed={state.atsLastAnalyzedAt}
          onReanalyze={analyze}
        />

        {/* Knockout Alerts - If Any */}
        {hasKnockouts && (
          <KnockoutAlerts risks={state.atsKnockoutRisks} />
        )}

        {/* Stage Breakdown - Collapsible */}
        {hasScore && (
          <StageBreakdown
            breakdown={state.atsCompositeScore!.stage_breakdown}
            weights={state.atsCompositeScore!.weights_used}
            stageResults={state.atsStageResults}
            failedStages={state.atsCompositeScore!.failed_stages}
          />
        )}

        {/* Keyword Analysis - Collapsible */}
        {hasScore && (
          <KeywordAnalysis />
        )}

        {/* Empty State */}
        {!hasScore && !isAnalyzing && (
          <EmptyState onAnalyze={analyze} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
        <Target className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-2">No ATS Analysis Yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Run an ATS analysis to see how well your resume matches this job posting.
      </p>
      <Button onClick={onAnalyze}>
        <Play className="w-4 h-4 mr-2" />
        Analyze Resume
      </Button>
    </div>
  );
}
```

---

## Component: ATSScoreSummary.tsx

Circular gauge with re-analyze button:

```typescript
"use client";

import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ATSScoreSummaryProps {
  score: number | null;
  isStale: boolean;
  isAnalyzing: boolean;
  progress: number;
  lastAnalyzed: Date | null;
  hasKnockouts?: boolean;
  onReanalyze: () => void;
}

export function ATSScoreSummary({
  score,
  isStale,
  isAnalyzing,
  progress,
  lastAnalyzed,
  hasKnockouts,
  onReanalyze,
}: ATSScoreSummaryProps) {
  const scoreColor = score !== null
    ? score >= 80 ? "text-green-600"
    : score >= 60 ? "text-amber-600"
    : "text-red-600"
    : "text-muted-foreground";

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Score Gauge */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <ScoreGauge
            score={score}
            isAnalyzing={isAnalyzing}
            progress={progress}
          />
        </div>

        {/* Score Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", scoreColor)}>
              {score !== null ? score : "--"}
            </span>
            {isStale && !isAnalyzing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                <Clock className="w-3 h-3" />
                Outdated
              </span>
            )}
            {hasKnockouts && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Risks
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {isAnalyzing
              ? `Analyzing... ${progress}%`
              : lastAnalyzed
                ? `Analyzed ${formatDistanceToNow(lastAnalyzed, { addSuffix: true })}`
                : "Not yet analyzed"
            }
          </p>
        </div>

        {/* Re-analyze Button */}
        <Button
          variant={isStale ? "default" : "outline"}
          size="sm"
          onClick={onReanalyze}
          disabled={isAnalyzing}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? "Analyzing" : isStale ? "Re-analyze" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}

function ScoreGauge({
  score,
  isAnalyzing,
  progress,
}: {
  score: number | null;
  isAnalyzing: boolean;
  progress: number;
}) {
  const displayValue = isAnalyzing ? progress : (score ?? 0);
  const circumference = 2 * Math.PI * 36; // radius = 36
  const strokeDashoffset = circumference - (displayValue / 100) * circumference;

  const strokeColor = isAnalyzing
    ? "stroke-blue-500"
    : score !== null
      ? score >= 80 ? "stroke-green-500"
      : score >= 60 ? "stroke-amber-500"
      : "stroke-red-500"
    : "stroke-muted";

  return (
    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
      {/* Background circle */}
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted"
      />
      {/* Progress circle */}
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className={cn(strokeColor, isAnalyzing && "animate-pulse")}
        style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
      />
    </svg>
  );
}
```

---

## Component: KnockoutAlerts.tsx

Critical warnings displayed prominently:

```typescript
"use client";

import { AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnockoutRisk } from "../../WorkshopContext";

interface KnockoutAlertsProps {
  risks: KnockoutRisk[];
}

export function KnockoutAlerts({ risks }: KnockoutAlertsProps) {
  const hardRisks = risks.filter(r => r.severity === "hard");
  const softRisks = risks.filter(r => r.severity === "soft");

  return (
    <div className="space-y-3">
      {/* Hard Knockouts - Critical */}
      {hardRisks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-900">
              Knockout Risk Detected
            </h3>
          </div>
          <p className="text-sm text-red-800 mb-3">
            These requirements may auto-reject your application:
          </p>
          <ul className="space-y-2">
            {hardRisks.map((risk, i) => (
              <KnockoutRiskItem key={i} risk={risk} />
            ))}
          </ul>
        </div>
      )}

      {/* Soft Warnings */}
      {softRisks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-medium text-amber-900">
              Potential Concerns
            </h3>
          </div>
          <ul className="space-y-2">
            {softRisks.map((risk, i) => (
              <KnockoutRiskItem key={i} risk={risk} variant="soft" />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KnockoutRiskItem({
  risk,
  variant = "hard",
}: {
  risk: KnockoutRisk;
  variant?: "hard" | "soft";
}) {
  const categoryLabels: Record<string, string> = {
    experience: "Experience",
    education: "Education",
    certification: "Certification",
    location: "Location",
  };

  return (
    <li className="text-sm">
      <span className={cn(
        "font-medium",
        variant === "hard" ? "text-red-900" : "text-amber-900"
      )}>
        {categoryLabels[risk.category]}:
      </span>{" "}
      <span className={variant === "hard" ? "text-red-800" : "text-amber-800"}>
        {risk.message}
      </span>
      <div className="mt-1 text-xs opacity-75">
        Job requires: {risk.job_requirement} | Your resume: {risk.resume_value}
      </div>
    </li>
  );
}
```

---

## Component: StageBreakdown.tsx

Collapsible section showing 5-stage scores:

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  stageResults: Record<string, unknown>;
  failedStages: string[];
}

const STAGE_CONFIG = [
  { key: "structure", label: "Structure", icon: "FileText" },
  { key: "keywords", label: "Keywords", icon: "Key" },
  { key: "content_quality", label: "Content Quality", icon: "CheckCircle" },
  { key: "role_proximity", label: "Role Proximity", icon: "Target" },
] as const;

export function StageBreakdown({
  breakdown,
  weights,
  failedStages,
}: StageBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border rounded-lg">
      {/* Header */}
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

      {/* Content */}
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
```

---

## Component: StageScoreBar.tsx

Individual stage visualization:

```typescript
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
```

---

## WorkshopControlPanel Integration

Update `WorkshopControlPanel.tsx`:

```typescript
// Add import
import { ATSPanel } from "./panels/ats";

// Update TABS array
const TABS: { key: WorkshopTab; label: string }[] = [
  { key: "ai-rewrite", label: "AI Rewrite" },
  { key: "editor", label: "Editor" },
  { key: "style", label: "Style" },
  { key: "ats", label: "ATS Score" },
];

// Update renderTabContent switch
case "ats":
  return <ATSPanel />;

// Add badge for ATS tab (after ai-rewrite badge)
{tab.key === "ats" && state.atsCompositeScore && (
  <span className={cn(
    "ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium rounded-full",
    state.atsIsStale
      ? "text-amber-800 bg-amber-100"
      : state.atsKnockoutRisks.length > 0
        ? "text-red-800 bg-red-100"
        : "text-green-800 bg-green-100"
  )}>
    {Math.round(state.atsCompositeScore.final_score)}
  </span>
)}
```

---

## Files to Create

| File | Purpose |
| ---- | ------- |
| `panels/ats/ATSPanel.tsx` | Main container |
| `panels/ats/ATSScoreSummary.tsx` | Score gauge + controls |
| `panels/ats/KnockoutAlerts.tsx` | Risk warnings |
| `panels/ats/StageBreakdown.tsx` | Collapsible breakdown |
| `panels/ats/StageScoreBar.tsx` | Individual bar |
| `panels/ats/index.ts` | Barrel export |

## Files to Modify

| File | Changes |
| ---- | ------- |
| `WorkshopControlPanel.tsx` | Add 4th tab, render ATSPanel |
| `panels/index.ts` | Add ATSPanel export |

---

## Verification

- [ ] ATS tab appears as 4th option
- [ ] Score gauge renders with correct colors (green/amber/red)
- [ ] Stale indicator shows "Outdated" badge
- [ ] Re-analyze button triggers progressive analysis
- [ ] Knockout alerts render with correct severity styling
- [ ] Stage breakdown shows 4 stages with weights
- [ ] Failed stages show as grayed out
- [ ] Tab badge shows score with appropriate color
- [ ] Empty state renders when no analysis exists
- [ ] Progress updates during analysis
