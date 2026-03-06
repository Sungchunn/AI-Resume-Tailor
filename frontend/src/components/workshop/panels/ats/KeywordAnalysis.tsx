"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkshop } from "../../WorkshopContext";
import { KeywordSection } from "./KeywordSection";
import { InsertKeywordModal } from "./InsertKeywordModal";

interface KeywordToInsert {
  keyword: string;
  importance: string;
}

export function KeywordAnalysis() {
  const { state } = useWorkshop();
  const [isExpanded, setIsExpanded] = useState(true);
  const [insertModal, setInsertModal] = useState<KeywordToInsert | null>(null);

  const analysis = state.atsAnalysis;
  if (!analysis) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-sm text-muted-foreground text-center">
          No keyword analysis available. Run ATS analysis to see keyword coverage.
        </p>
      </div>
    );
  }

  const {
    required_matched = [],
    required_missing = [],
    preferred_matched = [],
    preferred_missing = [],
    nice_to_have_matched = [],
    nice_to_have_missing = [],
    missing_available_in_vault = [],
    missing_not_in_vault = [],
    all_keywords = [],
  } = analysis;

  const totalMatched = required_matched.length + preferred_matched.length + nice_to_have_matched.length;
  const totalMissing = required_missing.length + preferred_missing.length + nice_to_have_missing.length;
  const totalKeywords = totalMatched + totalMissing;
  const coveragePercent = totalKeywords > 0
    ? Math.round((totalMatched / totalKeywords) * 100)
    : 0;

  const vaultAvailableSet = new Set(missing_available_in_vault);
  const notInVaultSet = new Set(missing_not_in_vault);

  const handleInsertKeyword = (keyword: string, importance: string) => {
    setInsertModal({ keyword, importance });
  };

  const handleAddToVault = (keyword: string) => {
    window.open(`/library/blocks/new?skill=${encodeURIComponent(keyword)}`, "_blank");
  };

  return (
    <>
      <div className="border rounded-lg">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium">Keyword Analysis</span>
            <span className="text-sm text-muted-foreground">
              {coveragePercent}% coverage ({totalMatched}/{totalKeywords})
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <KeywordSection
              title="Required"
              importance="required"
              matched={required_matched}
              vaultAvailable={required_missing.filter(k => vaultAvailableSet.has(k))}
              missing={required_missing.filter(k => notInVaultSet.has(k))}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded
            />

            <KeywordSection
              title="Preferred"
              importance="preferred"
              matched={preferred_matched}
              vaultAvailable={preferred_missing.filter(k => vaultAvailableSet.has(k))}
              missing={preferred_missing.filter(k => notInVaultSet.has(k))}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded
            />

            <KeywordSection
              title="Nice to Have"
              importance="nice_to_have"
              matched={nice_to_have_matched}
              vaultAvailable={nice_to_have_missing.filter(k => vaultAvailableSet.has(k))}
              missing={nice_to_have_missing.filter(k => notInVaultSet.has(k))}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded={false}
            />
          </div>
        )}
      </div>

      {insertModal && (
        <InsertKeywordModal
          keyword={insertModal.keyword}
          onClose={() => setInsertModal(null)}
          onInsert={() => {
            setInsertModal(null);
          }}
        />
      )}
    </>
  );
}
