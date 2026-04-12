# Phase 3: Bullet Suggestions UI

**Goal:** Create the frontend components for displaying and interacting with bullet suggestions in the AI tab.

---

## 3.1 Create useBulletAnalysis Hook

**File:** `frontend/src/hooks/useBulletAnalysis.ts`

### Interface

```typescript
interface UseBulletAnalysisOptions {
  tailoredResumeId: string;
}

interface UseBulletAnalysisReturn {
  // State (from store)
  suggestions: BulletSuggestion[];
  pendingSuggestions: BulletSuggestion[];
  isAnalyzing: boolean;
  error: string | null;
  lastAnalyzedAt: Date | null;

  // Computed
  hasAnySuggestions: boolean;
  suggestionsByEntry: Record<string, BulletSuggestion[]>;

  // Actions
  analyze: () => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  rejectSuggestion: (id: string) => void;
  acceptAll: () => Promise<void>;
  rejectAll: () => void;

  // Utilities
  getSuggestionForBullet: (bulletId: string) => BulletSuggestion | undefined;
}
```

### Implementation

```typescript
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useBlockEditor } from "@/components/library/editor/BlockEditorContext";
import { useTailorEditorContext } from "@/components/tailor/editor/TailorEditorContext";
import {
  useBulletSuggestionsStore,
  usePendingSuggestions,
} from "@/lib/stores/bulletSuggestionsStore";
import { tailorApi } from "@/lib/api/tailor";

export function useBulletAnalysis({ tailoredResumeId }: UseBulletAnalysisOptions) {
  // Store state
  const suggestions = useBulletSuggestionsStore((s) => s.suggestions);
  const isAnalyzing = useBulletSuggestionsStore((s) => s.isAnalyzing);
  const error = useBulletSuggestionsStore((s) => s.error);
  const lastAnalyzedAt = useBulletSuggestionsStore((s) => s.lastAnalyzedAt);

  // Store actions
  const setAnalyzing = useBulletSuggestionsStore((s) => s.setAnalyzing);
  const setSuggestions = useBulletSuggestionsStore((s) => s.setSuggestions);
  const setError = useBulletSuggestionsStore((s) => s.setError);
  const storeAccept = useBulletSuggestionsStore((s) => s.acceptSuggestion);
  const storeReject = useBulletSuggestionsStore((s) => s.rejectSuggestion);
  const storeAcceptAll = useBulletSuggestionsStore((s) => s.acceptAll);
  const storeRejectAll = useBulletSuggestionsStore((s) => s.rejectAll);

  // Editor context for updating bullets
  const { blocks, updateContentByPath, save } = useBlockEditor();

  // Tailor context for ATS data
  const { atsContext } = useTailorEditorContext();

  // Computed: pending suggestions
  const pendingSuggestions = usePendingSuggestions();

  // Computed: group by entry
  const suggestionsByEntry = useMemo(() => {
    return pendingSuggestions.reduce((acc, s) => {
      const key = `${s.entryContext.title}@${s.entryContext.company}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<string, BulletSuggestion[]>);
  }, [pendingSuggestions]);

  // Action: analyze bullets
  const analyze = useCallback(async () => {
    if (!atsContext?.analysisComplete) {
      toast.error("Run ATS analysis first");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      // Collect bullets from blocks
      const bullets = collectBulletsFromBlocks(blocks);

      if (bullets.length === 0) {
        setError("No bullets found to analyze");
        setAnalyzing(false);
        return;
      }

      // Call API
      const response = await tailorApi.analyzeBullets(tailoredResumeId, {
        bullets,
        ats_context: {
          keyword_gaps: atsContext.keywordGaps,
          importance_map: buildImportanceMap(atsContext.keywordGaps),
          bullets_needing_metrics: atsContext.contentQualityHints.bulletsNeedingMetrics,
          bullets_with_weak_verbs: atsContext.contentQualityHints.bulletsWithWeakVerbs,
        },
      });

      // Transform to store format
      const storeSuggestions = response.suggestions.map((s) => ({
        id: crypto.randomUUID(),
        bulletId: s.bullet_id,
        entryContext: findEntryContext(bullets, s.bullet_id),
        original: s.original,
        suggested: s.suggested,
        reason: s.reason,
        impact: s.impact,
        keywordsAdded: s.keywords_added,
        metricsAdded: s.metrics_added,
        status: "pending" as const,
      }));

      setSuggestions(storeSuggestions, tailoredResumeId);

      if (storeSuggestions.length === 0) {
        toast.success("Your bullets look great! No improvements needed.");
      } else {
        toast.success(`Found ${storeSuggestions.length} suggestions`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }, [atsContext, blocks, tailoredResumeId, setAnalyzing, setSuggestions, setError]);

  // Action: accept suggestion
  const acceptSuggestion = useCallback(
    async (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      if (!suggestion) return;

      // Update bullet content
      updateContentByPath(suggestion.bulletId, suggestion.suggested);

      // Mark as accepted in store
      storeAccept(id);

      // Trigger auto-save
      await save();

      toast.success("Suggestion applied");
    },
    [suggestions, updateContentByPath, storeAccept, save]
  );

  // Action: reject suggestion
  const rejectSuggestion = useCallback(
    (id: string) => {
      storeReject(id);
    },
    [storeReject]
  );

  // Action: accept all
  const acceptAll = useCallback(async () => {
    for (const suggestion of pendingSuggestions) {
      updateContentByPath(suggestion.bulletId, suggestion.suggested);
    }
    storeAcceptAll();
    await save();
    toast.success(`Applied ${pendingSuggestions.length} suggestions`);
  }, [pendingSuggestions, updateContentByPath, storeAcceptAll, save]);

  // Action: reject all
  const rejectAll = useCallback(() => {
    storeRejectAll();
    toast.info("All suggestions dismissed");
  }, [storeRejectAll]);

  // Utility: get suggestion for specific bullet
  const getSuggestionForBullet = useCallback(
    (bulletId: string) => {
      return pendingSuggestions.find((s) => s.bulletId === bulletId);
    },
    [pendingSuggestions]
  );

  return {
    suggestions,
    pendingSuggestions,
    isAnalyzing,
    error,
    lastAnalyzedAt,
    hasAnySuggestions: pendingSuggestions.length > 0,
    suggestionsByEntry,
    analyze,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
    getSuggestionForBullet,
  };
}

// Helper functions
function collectBulletsFromBlocks(blocks: Block[]): BulletInput[] {
  const bullets: BulletInput[] = [];

  for (const block of blocks) {
    if (block.type === "experience" || block.type === "projects") {
      const entries = block.content.entries || [];
      entries.forEach((entry, entryIndex) => {
        const entryBullets = entry.bullets || [];
        entryBullets.forEach((bulletText, bulletIndex) => {
          bullets.push({
            id: `${block.id}:entry-${entryIndex}:bullet-${bulletIndex}`,
            text: bulletText,
            entry_context: {
              title: entry.title || entry.name || "",
              company: entry.company || entry.organization || "",
              date_range: entry.date_range || entry.dates || "",
            },
          });
        });
      });
    }
  }

  return bullets;
}

function buildImportanceMap(gaps: KeywordGapItem[]): Record<string, string> {
  return gaps.reduce((acc, g) => {
    acc[g.keyword] = g.importance;
    return acc;
  }, {} as Record<string, string>);
}

function findEntryContext(bullets: BulletInput[], bulletId: string) {
  const bullet = bullets.find((b) => b.id === bulletId);
  return bullet?.entry_context || { title: "", company: "", dateRange: "" };
}
```

---

## 3.2 Create BulletSuggestionsPanel

**File:** `frontend/src/components/tailor/editor/BulletSuggestionsPanel.tsx`

### Component Structure

```typescript
interface BulletSuggestionsPanelProps {
  tailoredResumeId: string;
}
```

### Panel Implementation

```typescript
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBulletAnalysis } from "@/hooks/useBulletAnalysis";
import { useTailorEditorContext, useATSReadiness } from "@/components/tailor/editor/TailorEditorContext";
import { BulletSuggestionCard } from "./BulletSuggestionCard";

export function BulletSuggestionsPanel({ tailoredResumeId }: BulletSuggestionsPanelProps) {
  const { isReady: atsReady, score: atsScore } = useATSReadiness();

  const {
    pendingSuggestions,
    suggestionsByEntry,
    isAnalyzing,
    error,
    lastAnalyzedAt,
    hasAnySuggestions,
    analyze,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
  } = useBulletAnalysis({ tailoredResumeId });

  // State 1: ATS Required
  if (!atsReady) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium">ATS Analysis Required</p>
            <p className="text-sm text-muted-foreground">
              Run ATS analysis first to enable AI bullet suggestions.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Switch to ATS tab
                document.querySelector('[data-tab="ats"]')?.click();
              }}
            >
              Go to ATS Tab
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 2: Ready (no analysis run yet)
  if (!lastAnalyzedAt && !isAnalyzing) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <span className="font-medium">AI Bullet Suggestions</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI will analyze your bullet points and suggest improvements based on
            the job requirements and ATS analysis.
          </p>
          <Button onClick={analyze} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Analyze Bullets
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 3: Analyzing
  if (isAnalyzing) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="font-medium">Analyzing bullets...</span>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 4: Error
  if (error) {
    return (
      <Card className="border-red-500/50">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Analysis Failed</span>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={analyze} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 5: No suggestions needed
  if (!hasAnySuggestions && lastAnalyzedAt) {
    return (
      <Card className="border-green-500/50 bg-green-500/10">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Your bullets look great!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            No improvements needed. Your bullets are well-optimized for this job.
          </p>
          <Button onClick={analyze} variant="outline" size="sm">
            Analyze Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 6: Results
  return (
    <div className="space-y-4">
      {/* Header with summary and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <span className="font-medium">
            {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={rejectAll}>
            Reject All
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Accept All
          </Button>
        </div>
      </div>

      {/* Suggestions grouped by entry */}
      {Object.entries(suggestionsByEntry).map(([entryKey, entrySuggestions]) => (
        <div key={entryKey} className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {entrySuggestions[0]?.entryContext.title} @ {entrySuggestions[0]?.entryContext.company}
          </h4>
          {entrySuggestions.map((suggestion, index) => (
            <BulletSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={() => acceptSuggestion(suggestion.id)}
              onReject={() => rejectSuggestion(suggestion.id)}
              isFirst={index === 0}
            />
          ))}
        </div>
      ))}

      {/* Analyze again button */}
      <Button onClick={analyze} variant="ghost" size="sm" className="w-full">
        Analyze Again
      </Button>
    </div>
  );
}
```

---

## 3.3 Create BulletSuggestionCard

**File:** `frontend/src/components/tailor/editor/BulletSuggestionCard.tsx`

### Card Implementation

```typescript
import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BulletSuggestion } from "@/lib/stores/bulletSuggestionsStore";

interface BulletSuggestionCardProps {
  suggestion: BulletSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isFirst?: boolean;
}

const impactStyles = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function BulletSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isFirst,
}: BulletSuggestionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-focus first card for keyboard navigation
  useEffect(() => {
    if (isFirst && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isFirst]);

  // Keyboard handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAccept();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onReject();
    }
  };

  return (
    <Card
      ref={cardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      <CardContent className="py-3 space-y-3">
        {/* Header with impact badge */}
        <div className="flex items-center justify-between">
          <Badge className={cn("text-xs", impactStyles[suggestion.impact])}>
            {suggestion.impact.toUpperCase()}
          </Badge>
        </div>

        {/* Original text (strikethrough) */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Original:</p>
          <p className="text-sm line-through text-muted-foreground">
            {suggestion.original}
          </p>
        </div>

        {/* Suggested text (highlighted) */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
          <p className="text-sm font-medium text-foreground">
            {suggestion.suggested}
          </p>
        </div>

        {/* Reason */}
        <p className="text-xs text-muted-foreground italic">
          {suggestion.reason}
        </p>

        {/* Keywords added */}
        {suggestion.keywordsAdded.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestion.keywordsAdded.map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">
                +{kw}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
            <kbd className="ml-2 text-xs opacity-50">Esc</kbd>
          </Button>
          <Button size="sm" onClick={onAccept}>
            <Check className="h-4 w-4 mr-1" />
            Accept
            <kbd className="ml-2 text-xs opacity-50">Enter</kbd>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 3.4 Modify BulletList for Indicators

**File:** `frontend/src/components/library/editor/blocks/shared/BulletList.tsx`

### Changes Required

Add subtle sparkle indicator on bullets that have pending suggestions.

```typescript
// Add to props interface
interface BulletListProps {
  // ... existing props
  suggestionIndicators?: Map<string, boolean>; // bulletId -> hasSuggestion
  onIndicatorClick?: (bulletId: string) => void;
}

// Inside bullet item render:
{suggestionIndicators?.get(bulletId) && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onIndicatorClick?.(bulletId);
    }}
    className="absolute -left-6 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 transition-colors"
    title="AI suggestion available"
  >
    <Sparkles className="h-4 w-4" />
  </button>
)}
```

### Integration Point

The `ExperienceEditor` and `ProjectsEditor` components need to:

1. Import `usePendingSuggestions` from the store
2. Build the `suggestionIndicators` map
3. Pass to `BulletList`

```typescript
// In ExperienceEditor.tsx or ProjectsEditor.tsx
const pendingSuggestions = usePendingSuggestions();

const suggestionIndicators = useMemo(() => {
  const map = new Map<string, boolean>();
  pendingSuggestions.forEach((s) => {
    map.set(s.bulletId, true);
  });
  return map;
}, [pendingSuggestions]);

const handleIndicatorClick = (bulletId: string) => {
  // Scroll AI tab into view and focus the suggestion
  document.querySelector('[data-tab="ai"]')?.click();
  // Could also implement scrolling to specific suggestion card
};

// Pass to BulletList
<BulletList
  // ... other props
  suggestionIndicators={suggestionIndicators}
  onIndicatorClick={handleIndicatorClick}
/>
```

---

## 3.5 Modify AIChatTab

**File:** `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

### AIChatTab Changes

Add `BulletSuggestionsPanel` at the top when in tailor mode.

```typescript
import { BulletSuggestionsPanel } from "@/components/tailor/editor/BulletSuggestionsPanel";
import { useTailorEditorContext } from "@/components/tailor/editor/TailorEditorContext";

export function AIChatTab({ jobId, jobListingId }: AIChatTabProps) {
  // Check if we're in tailor mode
  const tailorContext = useTailorEditorContext();
  const isTailorMode = tailorContext?.aiAssistantEnabled ?? false;

  return (
    <div className="space-y-4 p-4">
      {/* Bullet suggestions panel (tailor mode only) */}
      {isTailorMode && tailorContext && (
        <>
          <BulletSuggestionsPanel
            tailoredResumeId={/* get from route or context */}
          />
          <div className="border-t my-4" />
        </>
      )}

      {/* Existing AI chat content */}
      {/* ... */}
    </div>
  );
}
```

**Note:** May need to wrap `useTailorEditorContext` in a try-catch or use optional chaining since this component is shared between library editor and tailor editor.

---

## Verification

### Phase 3 Verification Checklist

- [ ] `useBulletAnalysis` hook created and working
- [ ] `BulletSuggestionsPanel` shows correct state for each scenario:
  - [ ] ATS required state (before ATS analysis)
  - [ ] Ready state (after ATS, before analysis)
  - [ ] Analyzing state (during API call)
  - [ ] Results state (with suggestions)
  - [ ] No suggestions state (bullets already good)
  - [ ] Error state (API failure)
- [ ] `BulletSuggestionCard` displays all fields correctly
- [ ] Keyboard shortcuts work (Enter/Escape)
- [ ] Accept updates bullet in editor
- [ ] Accept triggers auto-save
- [ ] Reject removes suggestion from list
- [ ] Accept All / Reject All bulk actions work
- [ ] Sparkle indicators appear on bullets with suggestions
- [ ] Clicking indicator switches to AI tab

### Test Commands

```bash
# TypeScript check
cd frontend && bun run typecheck

# Run component tests
cd frontend && bun test BulletSuggestionsPanel
cd frontend && bun test BulletSuggestionCard
cd frontend && bun test useBulletAnalysis
```
