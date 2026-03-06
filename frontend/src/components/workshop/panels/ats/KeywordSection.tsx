"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { KeywordChip } from "./KeywordChip";

interface KeywordSectionProps {
  title: string;
  importance: string;
  matched: string[];
  vaultAvailable: string[];
  missing: string[];
  onInsert: (keyword: string, importance: string) => void;
  onAddToVault: (keyword: string) => void;
  defaultExpanded?: boolean;
}

export function KeywordSection({
  title,
  importance,
  matched,
  vaultAvailable,
  missing,
  onInsert,
  onAddToVault,
  defaultExpanded = true,
}: KeywordSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const total = matched.length + vaultAvailable.length + missing.length;
  if (total === 0) return null;

  const matchedCount = matched.length;
  const actionableCount = vaultAvailable.length;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm hover:text-foreground"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">
          {matchedCount}/{total} matched
          {actionableCount > 0 && (
            <span className="text-amber-600 ml-1">
              ({actionableCount} can insert)
            </span>
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="flex flex-wrap gap-2 pl-5">
          {matched.map(kw => (
            <KeywordChip
              key={kw}
              keyword={kw}
              variant="matched"
            />
          ))}

          {vaultAvailable.map(kw => (
            <KeywordChip
              key={kw}
              keyword={kw}
              variant="vault-available"
              onAction={() => onInsert(kw, importance)}
              actionLabel="Insert"
            />
          ))}

          {missing.map(kw => (
            <KeywordChip
              key={kw}
              keyword={kw}
              variant="missing"
              onAction={() => onAddToVault(kw)}
              actionLabel="Add to Vault"
            />
          ))}
        </div>
      )}
    </div>
  );
}
