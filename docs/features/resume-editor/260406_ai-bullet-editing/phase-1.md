# Phase 1: Context & State Foundation

**Goal:** Create the context provider and state management for AI bullet suggestions in the tailor editor.

---

## 1.1 Create TailorEditorContext

**File:** `frontend/src/components/tailor/editor/TailorEditorContext.tsx`

Provides tailor-specific context to child components, distinguishing from the base library editor.

### Type Definitions

```typescript
interface TailorEditorContextValue {
  // Feature flag - always true in tailor editor
  aiAssistantEnabled: boolean;

  // Job reference (one will be set based on tailored resume source)
  jobId: number | null;           // User-created job
  jobListingId: number | null;    // Scraped job listing

  // Fetched job data (resolved from jobId or jobListingId)
  jobDescription: string | null;
  jobTitle: string | null;
  companyName: string | null;

  // ATS data from atsProgressStore (when analysis complete)
  atsContext: ATSContext | null;
}

interface ATSContext {
  // From Stage 2 (keywords-enhanced)
  keywordGaps: KeywordGapItem[];

  // From Stage 3 (content-quality)
  contentQualityHints: ContentQualityHints;

  // Status
  analysisComplete: boolean;
  compositeScore: number | null;
}

interface KeywordGapItem {
  keyword: string;
  importance: "required" | "strongly_preferred" | "preferred" | "nice_to_have";
  inVault: boolean;
  suggestion?: string;
}

interface ContentQualityHints {
  bulletsNeedingMetrics: string[];      // Bullet IDs lacking quantification
  bulletsWithWeakVerbs: string[];       // Bullet IDs with passive language
  quantificationScore: number;          // 0-100 from Stage 3
  actionVerbScore: number;              // 0-100 from Stage 3
  achievementRatio: number;             // 0-1 (achievement vs responsibility)
}
```

### Data Sources

| Field | Source | Hook/Store |
| ----- | ------ | ---------- |
| `jobId` | `tailoredResume.job_id` | `useTailoredResume()` |
| `jobListingId` | `tailoredResume.job_listing_id` | `useTailoredResume()` |
| `jobDescription` | API fetch | `useJob(jobId)` or `useJobListing(jobListingId)` |
| `keywordGaps` | ATS Stage 2 | `useATSProgressStore()` -> `stages[2].result.gap_list` |
| `contentQualityHints` | ATS Stage 3 | `useATSProgressStore()` -> `stages[3].result` |

### Implementation Notes

1. **Conditional job fetching:** Only fetch from `useJob` if `jobId` is set, only from `useJobListing` if `jobListingId` is set
2. **ATS data extraction:** Subscribe to `atsProgressStore` and extract relevant data when `stages[2]` and `stages[3]` are complete
3. **Memoization:** Memoize context value to prevent unnecessary re-renders

### Context Hook

```typescript
export function useTailorEditorContext(): TailorEditorContextValue {
  const context = useContext(TailorEditorContext);
  if (!context) {
    throw new Error("useTailorEditorContext must be used within TailorEditorProvider");
  }
  return context;
}

// Convenience hook for checking ATS readiness
export function useATSReadiness(): { isReady: boolean; score: number | null } {
  const { atsContext } = useTailorEditorContext();
  return {
    isReady: atsContext?.analysisComplete ?? false,
    score: atsContext?.compositeScore ?? null,
  };
}
```

---

## 1.2 Create Bullet Suggestions Store

**File:** `frontend/src/lib/stores/bulletSuggestionsStore.ts`

Zustand store for managing suggestion state. **Ephemeral** - not persisted to localStorage.

### Store Interface

```typescript
interface BulletSuggestion {
  id: string;                              // Unique suggestion ID (uuid)
  bulletId: string;                        // Target bullet path (e.g., "exp-0:entry-0:bullet-0")
  entryContext: {
    title: string;                         // Job title from experience entry
    company: string;                       // Company name
    dateRange: string;                     // Date range string
  };
  original: string;                        // Original bullet text
  suggested: string;                       // AI-suggested improvement
  reason: string;                          // Explanation of changes
  impact: "high" | "medium" | "low";       // Impact level
  keywordsAdded: string[];                 // Keywords integrated
  metricsAdded: boolean;                   // Whether metrics were added
  status: "pending" | "accepted" | "rejected";
}

interface BulletSuggestionsState {
  // State
  suggestions: BulletSuggestion[];
  isAnalyzing: boolean;
  lastAnalyzedAt: Date | null;
  error: string | null;

  // Resume binding (for multi-tab scenarios)
  boundResumeId: string | null;
}

interface BulletSuggestionsActions {
  // Analysis lifecycle
  setAnalyzing: (isAnalyzing: boolean) => void;
  setSuggestions: (suggestions: BulletSuggestion[], resumeId: string) => void;
  setError: (error: string | null) => void;
  clearSuggestions: () => void;

  // Individual actions
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;

  // Bulk actions
  acceptAll: () => void;
  rejectAll: () => void;

  // Binding
  bindToResume: (resumeId: string) => void;
}

// Combined type
type BulletSuggestionsStore = BulletSuggestionsState & BulletSuggestionsActions;
```

### Computed Selectors

```typescript
// Selector hooks for performance
export const usePendingSuggestions = () =>
  useBulletSuggestionsStore((state) =>
    state.suggestions.filter((s) => s.status === "pending")
  );

export const useSuggestionForBullet = (bulletId: string) =>
  useBulletSuggestionsStore((state) =>
    state.suggestions.find((s) => s.bulletId === bulletId && s.status === "pending")
  );

export const useSuggestionsByEntry = () =>
  useBulletSuggestionsStore((state) => {
    const pending = state.suggestions.filter((s) => s.status === "pending");
    return groupBy(pending, (s) => `${s.entryContext.title}@${s.entryContext.company}`);
  });
```

### Store Implementation

```typescript
import { create } from "zustand";

export const useBulletSuggestionsStore = create<BulletSuggestionsStore>((set, get) => ({
  // Initial state
  suggestions: [],
  isAnalyzing: false,
  lastAnalyzedAt: null,
  error: null,
  boundResumeId: null,

  // Actions
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing, error: null }),

  setSuggestions: (suggestions, resumeId) => set({
    suggestions,
    lastAnalyzedAt: new Date(),
    boundResumeId: resumeId,
    error: null,
  }),

  setError: (error) => set({ error, isAnalyzing: false }),

  clearSuggestions: () => set({
    suggestions: [],
    lastAnalyzedAt: null,
    error: null
  }),

  acceptSuggestion: (id) => set((state) => ({
    suggestions: state.suggestions.map((s) =>
      s.id === id ? { ...s, status: "accepted" } : s
    ),
  })),

  rejectSuggestion: (id) => set((state) => ({
    suggestions: state.suggestions.map((s) =>
      s.id === id ? { ...s, status: "rejected" } : s
    ),
  })),

  acceptAll: () => set((state) => ({
    suggestions: state.suggestions.map((s) =>
      s.status === "pending" ? { ...s, status: "accepted" } : s
    ),
  })),

  rejectAll: () => set((state) => ({
    suggestions: state.suggestions.map((s) =>
      s.status === "pending" ? { ...s, status: "rejected" } : s
    ),
  })),

  bindToResume: (resumeId) => {
    const { boundResumeId } = get();
    if (boundResumeId !== resumeId) {
      // Clear suggestions when switching resumes
      set({
        suggestions: [],
        boundResumeId: resumeId,
        lastAnalyzedAt: null,
        error: null,
      });
    }
  },
}));
```

---

## 1.3 Modify Tailor Editor Page

**File:** `frontend/src/app/(protected)/tailor/editor/[id]/page.tsx`

### Changes Required

1. **Import new context provider**
2. **Wrap BlockEditorProvider with TailorEditorContext.Provider**
3. **Fetch job description** based on `jobId` or `jobListingId`
4. **Extract ATS context** from `atsProgressStore`
5. **Bind suggestions store** to current resume

### Code Changes

```typescript
// New imports
import {
  TailorEditorProvider,
  type ATSContext
} from "@/components/tailor/editor/TailorEditorContext";
import { useBulletSuggestionsStore } from "@/lib/stores/bulletSuggestionsStore";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";

// Inside component, before return:

// 1. Get job context from tailored resume
const jobId = tailored?.job_id ?? null;
const jobListingId = tailored?.job_listing_id ?? null;

// 2. Fetch job data conditionally
const { data: job } = useJob(jobId ?? 0, { enabled: !!jobId });
const { data: jobListing } = useJobListing(jobListingId ?? 0, { enabled: !!jobListingId });

// 3. Resolve job description
const jobDescription = job?.raw_content ?? jobListing?.job_description ?? null;
const jobTitle = job?.title ?? jobListing?.title ?? null;
const companyName = job?.company ?? jobListing?.company ?? null;

// 4. Extract ATS context from store
const atsStages = useATSProgressStore((state) => state.stages);
const compositeScore = useATSProgressStore((state) => state.compositeScore);

const atsContext = useMemo<ATSContext | null>(() => {
  const stage2 = atsStages[2];
  const stage3 = atsStages[3];

  if (stage2?.status !== "completed" || stage3?.status !== "completed") {
    return null;
  }

  return {
    keywordGaps: stage2.result?.gap_list ?? [],
    contentQualityHints: {
      bulletsNeedingMetrics: stage3.result?.quantification_analysis?.bullets_needing_metrics ?? [],
      bulletsWithWeakVerbs: stage3.result?.action_verb_analysis?.bullets_with_weak_phrases ?? [],
      quantificationScore: stage3.result?.quantification_analysis?.quality_score ?? 0,
      actionVerbScore: stage3.result?.action_verb_analysis?.quality_score ?? 0,
      achievementRatio: stage3.result?.block_type_analysis?.achievement_ratio ?? 0,
    },
    analysisComplete: true,
    compositeScore: compositeScore?.finalScore ?? null,
  };
}, [atsStages, compositeScore]);

// 5. Bind suggestions store to this resume
const bindToResume = useBulletSuggestionsStore((state) => state.bindToResume);
useEffect(() => {
  if (id) {
    bindToResume(id);
  }
}, [id, bindToResume]);

// In return, wrap with provider:
return (
  <TailorEditorProvider
    value={{
      aiAssistantEnabled: true,
      jobId,
      jobListingId,
      jobDescription,
      jobTitle,
      companyName,
      atsContext,
    }}
  >
    <BlockEditorProvider
      resumeId={id}
      initialParsedContent={initialParsedContent}
      initialStyle={initialStyle}
      onSave={handleSave}
    >
      <EditorLayout
        resumeId={id}
        title={tailored.formatted_name}
        jobId={jobId}
        jobListingId={jobListingId}
      />
    </BlockEditorProvider>
  </TailorEditorProvider>
);
```

---

## Verification

### Phase 1 Verification Checklist

- [ ] `TailorEditorContext` created and exports `useTailorEditorContext` hook
- [ ] `bulletSuggestionsStore` created with all actions working
- [ ] Tailor editor page wraps content with `TailorEditorProvider`
- [ ] Context correctly fetches job description (test with both jobId and jobListingId)
- [ ] ATS context populated when ATS analysis is complete
- [ ] Suggestions store binds to resume ID on page load
- [ ] Switching tailored resumes clears old suggestions

### Test Commands

```bash
# TypeScript compilation check
cd frontend && bun run typecheck

# Run related tests
cd frontend && bun test TailorEditorContext
cd frontend && bun test bulletSuggestionsStore
```
