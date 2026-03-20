/**
 * KeywordReviewPanel Component
 *
 * Main panel for reviewing extracted keywords.
 * Groups keywords by importance tier and allows editing.
 */

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KeywordCard } from "./KeywordCard";
import { ImportanceBadge } from "./ImportanceSelector";
import { AddKeywordModal } from "./AddKeywordModal";
import type {
  KeywordWithContext,
  KeywordImportanceEnhanced,
} from "@/lib/api/types";

interface KeywordReviewPanelProps {
  keywords: KeywordWithContext[];
  onChangeImportance: (
    keyword: string,
    importance: KeywordImportanceEnhanced
  ) => void;
  onRemove: (keyword: string) => void;
  onAdd: (keyword: KeywordWithContext) => void;
  onReset: () => void;
  onConfirm: () => void;
  hasChanges: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
}

const IMPORTANCE_ORDER: KeywordImportanceEnhanced[] = [
  "required",
  "strongly_preferred",
  "preferred",
  "nice_to_have",
];

const TIER_CONFIG: Record<
  KeywordImportanceEnhanced,
  { title: string; description: string }
> = {
  required: {
    title: "Required",
    description: "Must-have skills explicitly stated as required",
  },
  strongly_preferred: {
    title: "Strongly Preferred",
    description: "Highly desired skills emphasized in the job posting",
  },
  preferred: {
    title: "Preferred",
    description: "Nice-to-have skills mentioned as preferred or bonus",
  },
  nice_to_have: {
    title: "Nice to Have",
    description: "Skills mentioned but not emphasized",
  },
};

export function KeywordReviewPanel({
  keywords,
  onChangeImportance,
  onRemove,
  onAdd,
  onReset,
  onConfirm,
  hasChanges,
  isLoading = false,
  isSaving = false,
}: KeywordReviewPanelProps) {
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(
    new Set(IMPORTANCE_ORDER)
  );
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Group keywords by importance
  const groupedKeywords = useMemo(() => {
    const groups: Record<KeywordImportanceEnhanced, KeywordWithContext[]> = {
      required: [],
      strongly_preferred: [],
      preferred: [],
      nice_to_have: [],
    };

    for (const kw of keywords) {
      groups[kw.importance].push(kw);
    }

    return groups;
  }, [keywords]);

  // Stats
  const stats = useMemo(
    () => ({
      total: keywords.length,
      required: groupedKeywords.required.length,
      userAdded: keywords.filter((k) => k.user_added).length,
      userModified: keywords.filter((k) => k.user_modified).length,
    }),
    [keywords, groupedKeywords]
  );

  const toggleTier = (tier: string) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Extracting keywords...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Review Keywords</h2>
          <p className="text-sm text-muted-foreground">
            {stats.total} keywords extracted
            {stats.required > 0 && ` (${stats.required} required)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Keyword
          </Button>
        </div>
      </div>

      {/* Changes Indicator */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            You have unsaved changes
            {stats.userAdded > 0 && ` (${stats.userAdded} added)`}
            {stats.userModified > 0 && ` (${stats.userModified} modified)`}
          </span>
        </div>
      )}

      {/* Keyword Tiers */}
      <div className="space-y-4">
        {IMPORTANCE_ORDER.map((tier) => {
          const tierKeywords = groupedKeywords[tier];
          const isExpanded = expandedTiers.has(tier);
          const config = TIER_CONFIG[tier];

          return (
            <div
              key={tier}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Tier Header */}
              <button
                onClick={() => toggleTier(tier)}
                className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <ImportanceBadge importance={tier} size="sm" />
                  <span className="text-sm text-muted-foreground">
                    {config.description}
                  </span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {tierKeywords.length}
                </span>
              </button>

              {/* Tier Content */}
              <AnimatePresence>
                {isExpanded && tierKeywords.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-2 bg-card">
                      {tierKeywords.map((kw) => (
                        <KeywordCard
                          key={kw.keyword}
                          keyword={kw}
                          onChangeImportance={onChangeImportance}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty State */}
              {isExpanded && tierKeywords.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No keywords in this category
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={onConfirm} disabled={isSaving} className="min-w-[160px]">
          {isSaving ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Keywords
            </>
          )}
        </Button>
      </div>

      {/* Add Keyword Modal */}
      <AddKeywordModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={onAdd}
        existingKeywords={keywords.map((k) => k.keyword)}
      />
    </div>
  );
}

export default KeywordReviewPanel;
