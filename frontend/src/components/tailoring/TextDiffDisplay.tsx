/**
 * TextDiffDisplay Component
 *
 * Renders word-level diff highlighting for text content.
 * Shows additions in green and removals in red with strikethrough.
 */

"use client";

import { useMemo } from "react";
import {
  computeWordDiff,
  type DiffPart,
} from "@/lib/tailoring/textDiff";

interface TextDiffDisplayProps {
  /** Original text */
  original: string;
  /** Tailored (AI-proposed) text */
  tailored: string;
  /** Whether to show both versions or just the tailored with highlights */
  mode?: "combined" | "original" | "tailored";
  /** Additional class name */
  className?: string;
}

/**
 * Renders a word-level diff display showing changes between original and tailored text.
 */
export function TextDiffDisplay({
  original,
  tailored,
  mode = "combined",
  className = "",
}: TextDiffDisplayProps) {
  const diff = useMemo(
    () => computeWordDiff(original, tailored),
    [original, tailored]
  );

  if (mode === "original") {
    return <span className={className}>{original}</span>;
  }

  if (mode === "tailored") {
    return <span className={className}>{tailored}</span>;
  }

  // Combined mode - show inline diff
  return (
    <span className={className}>
      {diff.parts.map((part, index) => (
        <DiffSpan key={index} part={part} />
      ))}
    </span>
  );
}

interface DiffSpanProps {
  part: DiffPart;
}

function DiffSpan({ part }: DiffSpanProps) {
  if (part.added) {
    return (
      <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded px-0.5">
        {part.value}
      </span>
    );
  }

  if (part.removed) {
    return (
      <span className="bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300 rounded px-0.5">
        {part.value}
      </span>
    );
  }

  return <span>{part.value}</span>;
}

/**
 * Side-by-side text diff display.
 * Shows original and tailored text in separate columns.
 */
interface SideBySideDiffProps {
  original: string;
  tailored: string;
  className?: string;
}

export function SideBySideDiff({
  original,
  tailored,
  className = "",
}: SideBySideDiffProps) {
  const diff = useMemo(
    () => computeWordDiff(original, tailored),
    [original, tailored]
  );

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {/* Original */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Original
        </div>
        <div className="p-3 bg-muted/50 rounded-md text-sm">
          {diff.parts.map((part, index) => {
            if (part.added) return null;
            if (part.removed) {
              return (
                <span
                  key={index}
                  className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded px-0.5"
                >
                  {part.value}
                </span>
              );
            }
            return <span key={index}>{part.value}</span>;
          })}
        </div>
      </div>

      {/* Tailored */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          AI Suggested
        </div>
        <div className="p-3 bg-muted/50 rounded-md text-sm">
          {diff.parts.map((part, index) => {
            if (part.removed) return null;
            if (part.added) {
              return (
                <span
                  key={index}
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded px-0.5"
                >
                  {part.value}
                </span>
              );
            }
            return <span key={index}>{part.value}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
