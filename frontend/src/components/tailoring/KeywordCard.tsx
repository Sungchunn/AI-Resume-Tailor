/**
 * KeywordCard Component
 *
 * Displays a single keyword with its context sentence and importance level.
 * Supports editing importance and removing keywords.
 */

"use client";

import { X, Quote, Hash, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportanceSelector } from "./ImportanceSelector";
import type {
  KeywordWithContext,
  KeywordImportanceEnhanced,
} from "@/lib/api/types";

interface KeywordCardProps {
  keyword: KeywordWithContext;
  onChangeImportance: (
    keyword: string,
    importance: KeywordImportanceEnhanced
  ) => void;
  onRemove: (keyword: string) => void;
  showContext?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  requirements: "Requirements",
  qualifications: "Qualifications",
  nice_to_have: "Nice to Have",
  responsibilities: "Responsibilities",
  about: "About",
  benefits: "Benefits",
  other: "Other",
};

export function KeywordCard({
  keyword,
  onChangeImportance,
  onRemove,
  showContext = true,
}: KeywordCardProps) {
  return (
    <div
      className={`
        group flex flex-col gap-2 p-3 rounded-lg border transition-colors
        ${keyword.user_added ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20" : "border-border bg-card"}
        ${keyword.user_modified ? "border-yellow-300 dark:border-yellow-700" : ""}
        hover:border-primary/50
      `}
    >
      {/* Top Row: Keyword + Importance + Actions */}
      <div className="flex items-center gap-3">
        {/* Keyword Text */}
        <span className="font-medium text-foreground flex-1 truncate">
          {keyword.keyword}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {keyword.user_added && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              Added
            </span>
          )}
          {keyword.user_modified && !keyword.user_added && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Edited
            </span>
          )}
        </div>

        {/* Importance Selector */}
        <ImportanceSelector
          value={keyword.importance}
          onChange={(importance) =>
            onChangeImportance(keyword.keyword, importance)
          }
          size="sm"
        />

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(keyword.keyword)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Context Sentence */}
      {showContext && keyword.context && (
        <div className="flex items-start gap-2 pl-1">
          <Quote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground italic line-clamp-2">
            {keyword.context}
          </p>
        </div>
      )}

      {/* Metadata Row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-1">
        {/* Frequency */}
        {keyword.frequency > 1 && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {keyword.frequency}x in JD
          </span>
        )}

        {/* Source Section */}
        {keyword.source_section && (
          <span className="flex items-center gap-1">
            From: {SECTION_LABELS[keyword.source_section] || keyword.source_section}
          </span>
        )}
      </div>
    </div>
  );
}

export default KeywordCard;
