"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  BulletSuggestionResponse,
  JobDeepAnalysisResponse,
  KnockoutBlock,
  KeywordBlock,
  BulletsBlock,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface DeepAnalysisResultProps {
  data: JobDeepAnalysisResponse;
  onRerun: () => void;
  className?: string;
}

/**
 * Inline expand of the deep-analysis response rendered below the CTA on
 * /jobs/{id}. Three stacked sections (knockout, keywords, bullets) with
 * per-stage warning chips for partial failures. "Continue in Tailor"
 * points to the tailor flow for deeper editing.
 */
export function DeepAnalysisResult({
  data,
  onRerun,
  className,
}: DeepAnalysisResultProps) {
  const warningByStage = new Map(data.warnings.map((w) => [w.stage, w]));

  return (
    <section className={cn("space-y-3", className)}>
      <CacheBadge data={data} onRerun={onRerun} />

      <KnockoutSection
        block={data.knockout}
        warning={warningByStage.get("knockout")?.error ?? null}
      />
      <KeywordsSection
        block={data.keywords}
        warning={warningByStage.get("keywords")?.error ?? null}
      />
      <BulletsSection
        block={data.bullets}
        warning={warningByStage.get("bullets")?.error ?? null}
      />

      <div className="flex items-center justify-end">
        <Link
          href={`/tailor?job_listing_id=${data.job_listing_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-400"
        >
          Continue in Tailor
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ----- cache + rerun header ------------------------------------------------

function CacheBadge({
  data,
  onRerun,
}: {
  data: JobDeepAnalysisResponse;
  onRerun: () => void;
}) {
  const label = data.cached
    ? `Cached · generated ${formatAgo(data.cached_at ?? data.generated_at)}`
    : `Fresh run · ${data.ai_usage.total_tokens} tokens · ${Math.round(
        data.ai_usage.latency_ms / 1000,
      )}s`;

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRerun}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Rerun
      </button>
    </div>
  );
}

// ----- knockout section ---------------------------------------------------

function KnockoutSection({
  block,
  warning,
}: {
  block: KnockoutBlock | null;
  warning: string | null;
}) {
  if (warning) {
    return (
      <SectionShell title="Knockout risks">
        <WarningChip error={warning} />
      </SectionShell>
    );
  }
  if (!block) return null;

  const critical = block.risks.filter((r) => r.severity === "critical");
  const warnings = block.risks.filter((r) => r.severity === "warning");

  return (
    <SectionShell title="Knockout risks">
      {block.passes_all_checks ? (
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{block.summary}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {critical.length > 0 && (
            <RiskGroup
              title={`${critical.length} critical risk${critical.length > 1 ? "s" : ""}`}
              tone="critical"
              risks={critical}
            />
          )}
          {warnings.length > 0 && (
            <RiskGroup
              title={`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`}
              tone="warning"
              risks={warnings}
            />
          )}
          <p className="text-xs text-muted-foreground italic">
            {block.recommendation}
          </p>
        </div>
      )}
    </SectionShell>
  );
}

type RiskTone = "critical" | "warning";

function RiskGroup({
  title,
  tone,
  risks,
}: {
  title: string;
  tone: RiskTone;
  risks: KnockoutBlock["risks"];
}) {
  const palette =
    tone === "critical"
      ? {
          border: "border-red-500/40",
          bg: "bg-red-500/10",
          text: "text-red-700 dark:text-red-300",
          icon: <XCircle className="h-4 w-4 shrink-0" />,
        }
      : {
          border: "border-amber-500/40",
          bg: "bg-amber-500/10",
          text: "text-amber-700 dark:text-amber-200",
          icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
        };

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        palette.border,
        palette.bg,
        palette.text,
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {palette.icon}
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 pl-6 list-disc">
        {risks.map((r, i) => (
          <li key={`${r.risk_type}-${i}`} className="text-xs">
            <span className="font-medium">{r.description}</span>
            <div className="mt-0.5 opacity-80">
              Job requires: {r.job_requires}
              {r.user_has && <> &middot; Your resume: {r.user_has}</>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----- keyword section ----------------------------------------------------

function KeywordsSection({
  block,
  warning,
}: {
  block: KeywordBlock | null;
  warning: string | null;
}) {
  if (warning) {
    return (
      <SectionShell title="Keyword coverage">
        <WarningChip error={warning} />
      </SectionShell>
    );
  }
  if (!block) return null;

  const coveragePct = Math.round(block.coverage_score * 100);

  return (
    <SectionShell title="Keyword coverage">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{coveragePct}% overall coverage</span>
        <span>
          required {Math.round(block.required_coverage * 100)}% &middot;
          preferred {Math.round(block.preferred_coverage * 100)}%
        </span>
      </div>

      <KeywordTier
        label="Required"
        matched={block.required_matched}
        missing={block.required_missing}
        tone="required"
        defaultExpanded
      />
      <KeywordTier
        label="Preferred"
        matched={block.preferred_matched}
        missing={block.preferred_missing}
        tone="preferred"
      />
      <KeywordTier
        label="Nice to have"
        matched={block.nice_to_have_matched}
        missing={block.nice_to_have_missing}
        tone="nice"
      />

      {block.suggestions.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suggestions
          </p>
          {block.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-foreground/80 dark:text-zinc-200">
              · {s}
            </p>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

type TierTone = "required" | "preferred" | "nice";

function KeywordTier({
  label,
  matched,
  missing,
  tone,
  defaultExpanded = false,
}: {
  label: string;
  matched: string[];
  missing: string[];
  tone: TierTone;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const total = matched.length + missing.length;
  if (total === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {matched.length}/{total} matched
        </span>
      </button>
      {expanded && (
        <div className="mt-2 pl-5 flex flex-wrap gap-1.5">
          {matched.map((kw) => (
            <KeywordPill key={`m-${kw}`} text={kw} variant="matched" />
          ))}
          {missing.map((kw) => (
            <KeywordPill
              key={`x-${kw}`}
              text={kw}
              variant={tone === "required" ? "missing-required" : "missing"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordPill({
  text,
  variant,
}: {
  text: string;
  variant: "matched" | "missing" | "missing-required";
}) {
  const styles = {
    matched:
      "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30",
    missing:
      "text-amber-700 dark:text-amber-300 border border-dashed border-amber-500/60 bg-amber-500/5",
    "missing-required":
      "text-red-700 dark:text-red-300 border border-dashed border-red-500/60 bg-red-500/5 font-medium",
  } as const;
  return (
    <span
      className={cn("px-2 py-0.5 rounded-full text-xs", styles[variant])}
    >
      {text}
    </span>
  );
}

// ----- bullets section ----------------------------------------------------

function BulletsSection({
  block,
  warning,
}: {
  block: BulletsBlock | null;
  warning: string | null;
}) {
  if (warning) {
    return (
      <SectionShell title="Bullet suggestions">
        <WarningChip error={warning} />
      </SectionShell>
    );
  }
  if (!block) return null;

  if (block.total_analyzed === 0) {
    return (
      <SectionShell title="Bullet suggestions">
        <p className="text-sm text-muted-foreground">
          No work-experience bullets found on your master resume to analyze.
        </p>
      </SectionShell>
    );
  }

  if (block.suggestions_count === 0) {
    return (
      <SectionShell title="Bullet suggestions">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            All {block.total_analyzed} bullets already look ATS-ready for this
            role.
          </span>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title={`Bullet suggestions · ${block.suggestions_count} of ${block.total_analyzed}`}
    >
      <div className="space-y-3">
        {block.suggestions.map((s) => (
          <BulletSuggestionCard key={s.bullet_id} suggestion={s} />
        ))}
      </div>
    </SectionShell>
  );
}

function BulletSuggestionCard({
  suggestion,
}: {
  suggestion: BulletSuggestionResponse;
}) {
  const [expanded, setExpanded] = useState(false);
  const impactColor = {
    high: "text-green-700 dark:text-green-300 border-green-500/40 bg-green-500/10",
    medium:
      "text-blue-500 dark:text-blue-300 border-blue-500/40 bg-blue-500/10",
    low: "text-muted-foreground border-border dark:border-zinc-600 bg-zinc-500/10",
  }[suggestion.impact];

  return (
    <article className="rounded-md border border-border dark:border-zinc-600 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[10px]">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wider border",
            impactColor,
          )}
        >
          {suggestion.impact} impact
        </span>
        {suggestion.metrics_added && (
          <span className="text-muted-foreground">+ metrics added</span>
        )}
        {suggestion.keywords_added.length > 0 && (
          <span className="text-muted-foreground truncate">
            + keywords: {suggestion.keywords_added.join(", ")}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground line-through decoration-muted-foreground/40">
          {suggestion.original}
        </p>
        <p className="text-foreground/90 dark:text-zinc-100">
          {suggestion.suggested}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? "Hide reasoning" : "Why this change?"}
      </button>
      {expanded && (
        <p className="text-xs text-foreground/80 dark:text-zinc-300 italic border-l-2 border-border dark:border-zinc-600 pl-2">
          {suggestion.reason}
        </p>
      )}
    </article>
  );
}

// ----- shared primitives --------------------------------------------------

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card dark:bg-zinc-800 rounded-lg border border-border dark:border-zinc-600 p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function WarningChip({ error }: { error: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-200">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span>This section failed to load: {error}</span>
    </div>
  );
}

function formatAgo(iso: string | null): string {
  if (!iso) return "just now";
  const then = new Date(iso);
  const now = new Date();
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
