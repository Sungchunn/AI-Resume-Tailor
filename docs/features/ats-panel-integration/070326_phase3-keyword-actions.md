# Phase 3: Keyword Actions

**Parent Document:** `070326_master-plan.md`
**Status:** Planning
**Priority:** HIGH - Core actionability feature

---

## Overview

Implement the keyword analysis section with actionable chips. Users can insert vault-backed keywords into their resume or add missing keywords to their vault. This phase maintains vault integrity (no fabricated skills).

---

## Keyword Flow

```text
Job Description Keywords
         │
         ▼
┌────────────────────────────────────────┐
│          ATS Keyword Analysis          │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │ matched_keywords                │   │
│  │ ✓ Python  ✓ React  ✓ AWS       │   │
│  │ (green, no action needed)       │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │ missing_available_in_vault      │   │
│  │ + Docker  + Kubernetes          │   │
│  │ (yellow, "Insert" action)       │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │ missing_not_in_vault            │   │
│  │ ○ GraphQL  ○ Terraform          │   │
│  │ (gray, "Add to Vault" action)   │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

## Component Structure

```text
KeywordAnalysis.tsx
├── CoverageHeader (stats)
│
├── KeywordSection (Required)
│   ├── MatchedKeywordChip[]
│   ├── VaultAvailableKeywordChip[]
│   └── MissingKeywordChip[]
│
├── KeywordSection (Preferred)
│   └── ... same chips
│
└── KeywordSection (Nice to Have, collapsed)
    └── ... same chips
```

---

## Component: KeywordAnalysis.tsx

```typescript
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

  // Get keyword data from atsAnalysis
  const analysis = state.atsAnalysis;
  if (!analysis) return null;

  const {
    matched_keywords = [],
    missing_available_in_vault = [],
    missing_not_in_vault = [],
    keyword_breakdown = {},
  } = analysis;

  // Calculate coverage stats
  const totalKeywords = matched_keywords.length +
    missing_available_in_vault.length +
    missing_not_in_vault.length;
  const coveragePercent = totalKeywords > 0
    ? Math.round((matched_keywords.length / totalKeywords) * 100)
    : 0;

  // Group by importance tier
  const groupByImportance = (keywords: string[]) => {
    const groups: Record<string, string[]> = {
      required: [],
      strongly_preferred: [],
      preferred: [],
      nice_to_have: [],
    };
    keywords.forEach(kw => {
      const tier = keyword_breakdown[kw]?.importance ?? "nice_to_have";
      if (groups[tier]) groups[tier].push(kw);
    });
    return groups;
  };

  const matchedByTier = groupByImportance(matched_keywords);
  const vaultAvailableByTier = groupByImportance(missing_available_in_vault);
  const missingByTier = groupByImportance(missing_not_in_vault);

  const handleInsertKeyword = (keyword: string, importance: string) => {
    setInsertModal({ keyword, importance });
  };

  const handleAddToVault = (keyword: string) => {
    // Navigate to vault creation with pre-filled keyword
    // Or open inline modal (implementation choice)
    window.open(`/library/blocks/new?skill=${encodeURIComponent(keyword)}`, "_blank");
  };

  return (
    <>
      <div className="border rounded-lg">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium">Keyword Analysis</span>
            <span className="text-sm text-muted-foreground">
              {coveragePercent}% coverage ({matched_keywords.length}/{totalKeywords})
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Required Keywords - Always Expanded */}
            <KeywordSection
              title="Required"
              importance="required"
              matched={matchedByTier.required}
              vaultAvailable={vaultAvailableByTier.required}
              missing={missingByTier.required}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded
            />

            {/* Preferred Keywords */}
            <KeywordSection
              title="Preferred"
              importance="preferred"
              matched={[
                ...matchedByTier.strongly_preferred,
                ...matchedByTier.preferred,
              ]}
              vaultAvailable={[
                ...vaultAvailableByTier.strongly_preferred,
                ...vaultAvailableByTier.preferred,
              ]}
              missing={[
                ...missingByTier.strongly_preferred,
                ...missingByTier.preferred,
              ]}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded
            />

            {/* Nice to Have - Collapsed by Default */}
            <KeywordSection
              title="Nice to Have"
              importance="nice_to_have"
              matched={matchedByTier.nice_to_have}
              vaultAvailable={vaultAvailableByTier.nice_to_have}
              missing={missingByTier.nice_to_have}
              onInsert={handleInsertKeyword}
              onAddToVault={handleAddToVault}
              defaultExpanded={false}
            />
          </div>
        )}
      </div>

      {/* Insert Modal */}
      {insertModal && (
        <InsertKeywordModal
          keyword={insertModal.keyword}
          onClose={() => setInsertModal(null)}
          onInsert={(section) => {
            // Handle insertion logic
            setInsertModal(null);
          }}
        />
      )}
    </>
  );
}
```

---

## Component: KeywordSection.tsx

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
      {/* Section Header */}
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

      {/* Chips */}
      {isExpanded && (
        <div className="flex flex-wrap gap-2 pl-5">
          {/* Matched - Green */}
          {matched.map(kw => (
            <KeywordChip
              key={kw}
              keyword={kw}
              variant="matched"
            />
          ))}

          {/* Vault Available - Yellow with action */}
          {vaultAvailable.map(kw => (
            <KeywordChip
              key={kw}
              keyword={kw}
              variant="vault-available"
              onAction={() => onInsert(kw, importance)}
              actionLabel="Insert"
            />
          ))}

          {/* Missing - Gray with action */}
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
```

---

## Component: KeywordChip.tsx

```typescript
"use client";

import { Check, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ChipVariant = "matched" | "vault-available" | "missing";

interface KeywordChipProps {
  keyword: string;
  variant: ChipVariant;
  onAction?: () => void;
  actionLabel?: string;
}

const variantStyles: Record<ChipVariant, string> = {
  matched: "bg-green-100 text-green-800 border-green-200",
  "vault-available": "bg-amber-100 text-amber-800 border-amber-200",
  missing: "bg-gray-100 text-gray-600 border-gray-200",
};

const variantIcons: Record<ChipVariant, React.ReactNode> = {
  matched: <Check className="w-3 h-3" />,
  "vault-available": <Plus className="w-3 h-3" />,
  missing: <ExternalLink className="w-3 h-3" />,
};

export function KeywordChip({
  keyword,
  variant,
  onAction,
  actionLabel,
}: KeywordChipProps) {
  const hasAction = variant !== "matched" && onAction;

  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full border",
        variantStyles[variant],
        hasAction && "cursor-pointer hover:opacity-80"
      )}
      onClick={hasAction ? onAction : undefined}
    >
      {variantIcons[variant]}
      {keyword}
    </span>
  );

  if (hasAction && actionLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent>
          <p>{actionLabel}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return chip;
}
```

---

## Component: InsertKeywordModal.tsx

Modal for selecting which section to insert a keyword:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useWorkshop } from "../../WorkshopContext";

interface InsertKeywordModalProps {
  keyword: string;
  onClose: () => void;
  onInsert: (section: string) => void;
}

const INSERTABLE_SECTIONS = [
  { value: "skills", label: "Skills Section", description: "Add as a skill" },
  { value: "summary", label: "Summary", description: "Incorporate into summary text" },
  { value: "experience", label: "Experience", description: "Add to most recent role" },
];

export function InsertKeywordModal({
  keyword,
  onClose,
  onInsert,
}: InsertKeywordModalProps) {
  const { state, updateContent } = useWorkshop();
  const [selectedSection, setSelectedSection] = useState("skills");
  const [isInserting, setIsInserting] = useState(false);

  const handleInsert = async () => {
    setIsInserting(true);

    try {
      if (selectedSection === "skills") {
        // Add to skills array
        const updatedSkills = [...state.content.skills, keyword];
        updateContent({ skills: updatedSkills });
      } else if (selectedSection === "summary") {
        // Append to summary (user can edit placement)
        const updatedSummary = `${state.content.summary} ${keyword}`.trim();
        updateContent({ summary: updatedSummary });
      } else if (selectedSection === "experience") {
        // Add to first experience entry's bullets
        const updatedExperience = [...state.content.experience];
        if (updatedExperience.length > 0) {
          const firstEntry = { ...updatedExperience[0] };
          firstEntry.bullets = [...(firstEntry.bullets || []), `Utilized ${keyword} to...`];
          updatedExperience[0] = firstEntry;
          updateContent({ experience: updatedExperience });
        }
      }

      onInsert(selectedSection);
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Insert "{keyword}"
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose where to add this keyword to your resume:
          </p>

          <RadioGroup
            value={selectedSection}
            onValueChange={setSelectedSection}
          >
            {INSERTABLE_SECTIONS.map(section => (
              <div
                key={section.value}
                className="flex items-start space-x-3 space-y-0 rounded-md border p-4 mb-2"
              >
                <RadioGroupItem value={section.value} id={section.value} />
                <div className="space-y-1 leading-none">
                  <Label htmlFor={section.value}>{section.label}</Label>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={isInserting}>
            {isInserting ? "Inserting..." : "Insert Keyword"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Vault Integrity Safeguards

### What We Allow

1. **Insert from vault:** Keywords in `missing_available_in_vault` exist in user's vault - these are real skills they have but didn't include in this resume
2. **Add to vault:** For `missing_not_in_vault`, we open vault creation - user must provide evidence/context

### What We Prevent

1. **No auto-generation:** Never fabricate skills not in vault
2. **No direct insertion of missing:** Gray chips require vault creation first
3. **Clear visual distinction:** Color coding makes status obvious

### Backend Validation

The `missing_available_in_vault` list is generated by:

```python
# From ats_analyzer.py
vault_text = " ".join([block.content for block in vault_blocks])
found_in_vault = bool(re.search(keyword_pattern, vault_text))
```

Frontend trusts this categorization - user's vault is the source of truth.

---

## Files to Create

| File | Purpose |
| ---- | ------- |
| `panels/ats/KeywordAnalysis.tsx` | Main keyword section container |
| `panels/ats/KeywordSection.tsx` | Per-importance keyword group |
| `panels/ats/KeywordChip.tsx` | Individual keyword chip |
| `panels/ats/InsertKeywordModal.tsx` | Section selector modal |

---

## State Integration

### On Keyword Insert

When user inserts a keyword via `InsertKeywordModal`:

1. Update `content` via `updateContent()` (existing method)
2. This triggers `SET_CONTENT` action
3. Reducer marks `atsIsStale: true`
4. UI shows "Outdated" indicator
5. User can re-analyze after insertions

### Content Update Patterns

```typescript
// Skills insertion (simplest)
updateContent({ skills: [...state.content.skills, keyword] });

// Summary insertion (append)
updateContent({ summary: `${state.content.summary}. Experienced with ${keyword}` });

// Experience insertion (add bullet to first entry)
const updated = [...state.content.experience];
updated[0] = {
  ...updated[0],
  bullets: [...updated[0].bullets, `Leveraged ${keyword} to improve...`]
};
updateContent({ experience: updated });
```

---

## Verification

- [ ] Keyword coverage percentage displays correctly
- [ ] Required keywords section expanded by default
- [ ] Nice-to-have section collapsed by default
- [ ] Matched keywords show green with checkmark
- [ ] Vault-available keywords show yellow with plus icon
- [ ] Missing keywords show gray with external link icon
- [ ] Clicking vault-available opens InsertKeywordModal
- [ ] Clicking missing opens vault creation (new tab)
- [ ] InsertKeywordModal shows section choices
- [ ] Skills insertion adds to skills array
- [ ] Summary insertion appends text
- [ ] Experience insertion adds bullet to first entry
- [ ] Content changes mark ATS as stale
- [ ] Tooltip shows action label on hover
