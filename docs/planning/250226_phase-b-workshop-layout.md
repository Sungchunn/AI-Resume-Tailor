# Phase B: Workshop Page Layout

**Created**: February 25, 2026
**Status**: Ready for Implementation
**Dependencies**: Phase A (PDF Preview Component)
**Priority**: P0 (MVP)

---

## Overview

Create the main workshop page with a split-screen layout: PDF-like preview on the left (~55%) and tabbed control panel on the right (~45%).

---

## Technical Decisions

### URL Structure

**Route**: `/dashboard/workshop/[tailoredId]`

**Rationale**:

- Workshop is for editing **tailored resumes** (post-AI processing)
- `tailoredId` links to existing `TailoredResumeFullResponse` data
- Job context is already stored in the tailored resume record

**Query Parameters**:

- `?job=[jobId]` - Optional, for quick-match scenarios without full tailoring
- `?view=preview|editor` - Optional, for mobile deep-linking

### State Management

**Approach**: React Context with useReducer

**Rationale**:

- Component tree is relatively shallow (3-4 levels)
- State changes are predictable (content, style, suggestions)
- No need for external library (Zustand) given existing patterns
- Easy to test and debug
- Matches existing `AuthContext` pattern in the codebase

---

## Component Architecture

```text
frontend/src/
├── app/dashboard/workshop/
│   └── [id]/
│       └── page.tsx                 # Main workshop page
│
└── components/workshop/
    ├── WorkshopLayout.tsx           # Main split-screen layout
    ├── WorkshopHeader.tsx           # Title, score, save/export buttons
    ├── WorkshopControlPanel.tsx     # Right panel with tabs
    ├── WorkshopContext.tsx          # Shared state context
    ├── WorkshopProvider.tsx         # Context provider with data fetching
    └── MobileControlSheet.tsx       # Mobile bottom sheet
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/WorkshopContext.tsx

import type {
  TailoredContent,
  ResumeStyle,
  Suggestion,
  TailoredResumeFullResponse,
  ATSKeywordDetailedResponse,
} from "@/lib/api/types";

export type WorkshopTab = "ai-rewrite" | "editor" | "style";

export interface WorkshopState {
  // Data
  tailoredId: number;
  tailoredResume: TailoredResumeFullResponse | null;
  jobDescription: string | null;

  // Editable state
  content: TailoredContent;
  styleSettings: ResumeStyle;
  sectionOrder: string[];
  suggestions: Suggestion[];

  // UI state
  activeSection: string | undefined;
  activeTab: WorkshopTab;
  hasChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  fitToOnePage: boolean;

  // ATS analysis
  atsAnalysis: ATSKeywordDetailedResponse | null;
}

export type WorkshopAction =
  | { type: "INIT_DATA"; payload: TailoredResumeFullResponse }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CONTENT"; payload: TailoredContent }
  | { type: "SET_STYLE"; payload: Partial<ResumeStyle> }
  | { type: "SET_SECTION_ORDER"; payload: string[] }
  | { type: "ACCEPT_SUGGESTION"; payload: { index: number; suggestion: Suggestion } }
  | { type: "REJECT_SUGGESTION"; payload: number }
  | { type: "SET_ACTIVE_SECTION"; payload: string | undefined }
  | { type: "SET_ACTIVE_TAB"; payload: WorkshopTab }
  | { type: "SET_FIT_TO_ONE_PAGE"; payload: boolean }
  | { type: "SET_ATS_ANALYSIS"; payload: ATSKeywordDetailedResponse | null }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; payload: TailoredResumeFullResponse }
  | { type: "SAVE_ERROR"; payload: string }
  | { type: "RESET_CHANGES" };

export interface WorkshopContextValue {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;

  // Convenience methods
  save: () => Promise<void>;
  acceptSuggestion: (index: number, suggestion: Suggestion) => void;
  rejectSuggestion: (index: number) => void;
  updateContent: (content: Partial<TailoredContent>) => void;
  updateStyle: (style: Partial<ResumeStyle>) => void;
  runATSAnalysis: () => Promise<void>;
}

// Default values
export const DEFAULT_STYLE: ResumeStyle = {
  font_family: "Arial",
  font_size_body: 11,
  font_size_heading: 18,
  font_size_subheading: 12,
  margin_top: 0.75,
  margin_bottom: 0.75,
  margin_left: 0.75,
  margin_right: 0.75,
  line_spacing: 1.4,
  section_spacing: 16,
};

export const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];
```

---

## Implementation Details

### 1. WorkshopContext.tsx (State Management)

```typescript
"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  WorkshopState,
  WorkshopAction,
  WorkshopContextValue,
  WorkshopTab,
} from "./types";
import { DEFAULT_STYLE, DEFAULT_SECTION_ORDER } from "./types";

const initialState: WorkshopState = {
  tailoredId: 0,
  tailoredResume: null,
  jobDescription: null,
  content: { summary: "", experience: [], skills: [], highlights: [] },
  styleSettings: DEFAULT_STYLE,
  sectionOrder: DEFAULT_SECTION_ORDER,
  suggestions: [],
  activeSection: undefined,
  activeTab: "ai-rewrite",
  hasChanges: false,
  isSaving: false,
  isLoading: true,
  error: null,
  fitToOnePage: false,
  atsAnalysis: null,
};

function workshopReducer(state: WorkshopState, action: WorkshopAction): WorkshopState {
  switch (action.type) {
    case "INIT_DATA":
      return {
        ...state,
        tailoredResume: action.payload,
        tailoredId: action.payload.id,
        content: action.payload.tailored_content,
        styleSettings: action.payload.style_settings ?? DEFAULT_STYLE,
        sectionOrder: action.payload.section_order ?? DEFAULT_SECTION_ORDER,
        suggestions: action.payload.suggestions ?? [],
        isLoading: false,
        hasChanges: false,
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };

    case "SET_CONTENT":
      return { ...state, content: action.payload, hasChanges: true };

    case "SET_STYLE":
      return {
        ...state,
        styleSettings: { ...state.styleSettings, ...action.payload },
        hasChanges: true,
      };

    case "SET_SECTION_ORDER":
      return { ...state, sectionOrder: action.payload, hasChanges: true };

    case "ACCEPT_SUGGESTION": {
      const { index, suggestion } = action.payload;
      // Apply suggestion to content
      const updatedContent = applySuggestionToContent(state.content, suggestion);
      // Remove suggestion from list
      const updatedSuggestions = state.suggestions.filter((_, i) => i !== index);
      return {
        ...state,
        content: updatedContent,
        suggestions: updatedSuggestions,
        hasChanges: true,
      };
    }

    case "REJECT_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.filter((_, i) => i !== action.payload),
      };

    case "SET_ACTIVE_SECTION":
      return { ...state, activeSection: action.payload };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };

    case "SET_FIT_TO_ONE_PAGE":
      return { ...state, fitToOnePage: action.payload };

    case "SET_ATS_ANALYSIS":
      return { ...state, atsAnalysis: action.payload };

    case "SAVE_START":
      return { ...state, isSaving: true };

    case "SAVE_SUCCESS":
      return {
        ...state,
        tailoredResume: action.payload,
        isSaving: false,
        hasChanges: false,
      };

    case "SAVE_ERROR":
      return { ...state, isSaving: false, error: action.payload };

    case "RESET_CHANGES":
      return {
        ...state,
        content: state.tailoredResume?.tailored_content ?? state.content,
        styleSettings: state.tailoredResume?.style_settings ?? DEFAULT_STYLE,
        sectionOrder: state.tailoredResume?.section_order ?? DEFAULT_SECTION_ORDER,
        hasChanges: false,
      };

    default:
      return state;
  }
}

// Helper function to apply suggestion to content
function applySuggestionToContent(
  content: TailoredContent,
  suggestion: Suggestion
): TailoredContent {
  // Implementation depends on suggestion structure
  // This is a simplified example
  const { section, type, suggested } = suggestion;

  switch (section) {
    case "summary":
      if (type === "rewrite") {
        return { ...content, summary: suggested };
      }
      break;
    case "experience":
      // Handle experience bullet updates
      break;
    case "skills":
      if (type === "add") {
        return { ...content, skills: [...content.skills, suggested] };
      }
      break;
  }

  return content;
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null);

export function useWorkshop(): WorkshopContextValue {
  const context = useContext(WorkshopContext);
  if (!context) {
    throw new Error("useWorkshop must be used within a WorkshopProvider");
  }
  return context;
}

export { WorkshopContext, workshopReducer, initialState };
```

### 2. WorkshopProvider.tsx (Provider with Data Fetching)

```typescript
"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useReducer } from "react";
import {
  WorkshopContext,
  workshopReducer,
  initialState,
  type WorkshopContextValue,
} from "./WorkshopContext";
import { useTailoredResume, useUpdateTailoredResume } from "@/lib/api/hooks";
import { useATSKeywordsDetailed } from "@/lib/api/hooks";

interface WorkshopProviderProps {
  tailoredId: number;
  children: ReactNode;
}

export function WorkshopProvider({ tailoredId, children }: WorkshopProviderProps) {
  const [state, dispatch] = useReducer(workshopReducer, {
    ...initialState,
    tailoredId,
  });

  // Fetch initial data
  const { data: tailoredResume, isLoading, error } = useTailoredResume(tailoredId);
  const updateMutation = useUpdateTailoredResume();
  const atsAnalysisMutation = useATSKeywordsDetailed();

  // Initialize state when data loads
  useEffect(() => {
    if (tailoredResume) {
      dispatch({ type: "INIT_DATA", payload: tailoredResume });
    }
  }, [tailoredResume]);

  useEffect(() => {
    if (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  }, [error]);

  // Save handler
  const save = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    try {
      const result = await updateMutation.mutateAsync({
        id: tailoredId,
        tailored_content: state.content,
        style_settings: state.styleSettings,
        section_order: state.sectionOrder,
      });
      dispatch({ type: "SAVE_SUCCESS", payload: result });
    } catch (err) {
      dispatch({
        type: "SAVE_ERROR",
        payload: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [tailoredId, state.content, state.styleSettings, state.sectionOrder]);

  // Convenience methods
  const acceptSuggestion = useCallback((index: number, suggestion: Suggestion) => {
    dispatch({ type: "ACCEPT_SUGGESTION", payload: { index, suggestion } });
  }, []);

  const rejectSuggestion = useCallback((index: number) => {
    dispatch({ type: "REJECT_SUGGESTION", payload: index });
  }, []);

  const updateContent = useCallback((content: Partial<TailoredContent>) => {
    dispatch({ type: "SET_CONTENT", payload: { ...state.content, ...content } });
  }, [state.content]);

  const updateStyle = useCallback((style: Partial<ResumeStyle>) => {
    dispatch({ type: "SET_STYLE", payload: style });
  }, []);

  const runATSAnalysis = useCallback(async () => {
    if (!state.jobDescription) return;
    try {
      const result = await atsAnalysisMutation.mutateAsync({
        job_description: state.jobDescription,
        resume_content: state.content,
      });
      dispatch({ type: "SET_ATS_ANALYSIS", payload: result });
    } catch (err) {
      console.error("ATS analysis failed:", err);
    }
  }, [state.jobDescription, state.content]);

  const contextValue: WorkshopContextValue = {
    state,
    dispatch,
    save,
    acceptSuggestion,
    rejectSuggestion,
    updateContent,
    updateStyle,
    runATSAnalysis,
  };

  return (
    <WorkshopContext.Provider value={contextValue}>
      {children}
    </WorkshopContext.Provider>
  );
}
```

### 3. WorkshopLayout.tsx (Main Layout)

```typescript
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useWorkshop } from "./WorkshopContext";
import { WorkshopHeader } from "./WorkshopHeader";
import { WorkshopControlPanel } from "./WorkshopControlPanel";
import { ResumePreview } from "./ResumePreview";
import { MobileControlSheet } from "./MobileControlSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export function WorkshopLayout() {
  const { state, dispatch, save } = useWorkshop();
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (state.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <ErrorMessage message={state.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  // Mobile layout: stacked with bottom sheet
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <WorkshopHeader compact />

        {/* Preview takes full screen */}
        <div className="flex-1 overflow-auto p-4">
          <ResumePreview
            content={state.content}
            style={state.styleSettings}
            sectionOrder={state.sectionOrder}
            activeSection={state.activeSection}
            onSectionClick={(section) =>
              dispatch({ type: "SET_ACTIVE_SECTION", payload: section })
            }
            fitToOnePage={state.fitToOnePage}
          />
        </div>

        {/* Bottom sheet for controls */}
        <MobileControlSheet>
          <WorkshopControlPanel />
        </MobileControlSheet>
      </div>
    );
  }

  // Desktop layout: split panels
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Persistent Header */}
      <WorkshopHeader />

      {/* Main Content - Split Panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Panel - PDF Preview (55%) */}
          <Panel defaultSize={55} minSize={40} maxSize={70}>
            <div className="h-full bg-gray-100 overflow-auto p-6 flex justify-center">
              <ResumePreview
                content={state.content}
                style={state.styleSettings}
                sectionOrder={state.sectionOrder}
                activeSection={state.activeSection}
                onSectionClick={(section) =>
                  dispatch({ type: "SET_ACTIVE_SECTION", payload: section })
                }
                fitToOnePage={state.fitToOnePage}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-300 transition-colors cursor-col-resize" />

          {/* Right Panel - Controls (45%) */}
          <Panel defaultSize={45} minSize={30} maxSize={60}>
            <WorkshopControlPanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
```

### 4. WorkshopHeader.tsx

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useWorkshop } from "./WorkshopContext";
import { MatchScoreBadge } from "./MatchScoreBadge";
import { ExportDialog } from "@/components/export/ExportDialog";
import { cn } from "@/lib/utils";

interface WorkshopHeaderProps {
  compact?: boolean;
}

export function WorkshopHeader({ compact = false }: WorkshopHeaderProps) {
  const { state, save } = useWorkshop();
  const [showExportDialog, setShowExportDialog] = useState(false);

  const title = state.tailoredResume?.title ?? "Resume Workshop";
  const matchScore = state.tailoredResume?.match_score ?? 0;

  return (
    <header
      className={cn(
        "flex-shrink-0 border-b bg-white flex items-center justify-between px-4",
        compact ? "h-12" : "h-14"
      )}
    >
      {/* Left: Back button, Title, and Score */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/tailor"
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </Link>

        <h1
          className={cn(
            "font-semibold truncate",
            compact ? "text-sm max-w-[150px]" : "text-lg max-w-xs"
          )}
        >
          {title}
        </h1>

        <MatchScoreBadge score={matchScore} size={compact ? "sm" : "md"} />
      </div>

      {/* Right: Status and Actions */}
      <div className="flex items-center gap-3">
        {state.hasChanges && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Unsaved changes
          </span>
        )}

        <button
          onClick={save}
          disabled={!state.hasChanges || state.isSaving}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            state.hasChanges
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          {state.isSaving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={() => setShowExportDialog(true)}
          className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Export
        </button>
      </div>

      {showExportDialog && state.tailoredResume && (
        <ExportDialog
          resumeId={state.tailoredResume.resume_id}
          resumeTitle={title}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </header>
  );
}
```

### 5. WorkshopControlPanel.tsx (Tab Container)

```typescript
"use client";

import { Tab } from "@headlessui/react";
import { useWorkshop } from "./WorkshopContext";
import { AIRewriteTab } from "./tabs/AIRewriteTab";
import { EditorTab } from "./tabs/EditorTab";
import { StyleTab } from "./tabs/StyleTab";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "ai-rewrite", label: "AI Rewrite" },
  { key: "editor", label: "Editor" },
  { key: "style", label: "Style" },
] as const;

export function WorkshopControlPanel() {
  const { state, dispatch } = useWorkshop();

  const selectedIndex = TABS.findIndex((t) => t.key === state.activeTab);

  return (
    <div className="h-full flex flex-col bg-white">
      <Tab.Group
        selectedIndex={selectedIndex}
        onChange={(index) =>
          dispatch({ type: "SET_ACTIVE_TAB", payload: TABS[index].key })
        }
      >
        <Tab.List className="flex border-b px-2">
          {TABS.map((tab) => (
            <Tab
              key={tab.key}
              className={({ selected }) =>
                cn(
                  "flex-1 py-3 text-sm font-medium transition-colors outline-none",
                  selected
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                )
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="flex-1 overflow-hidden">
          <Tab.Panel className="h-full overflow-auto">
            <AIRewriteTab />
          </Tab.Panel>
          <Tab.Panel className="h-full overflow-auto">
            <EditorTab />
          </Tab.Panel>
          <Tab.Panel className="h-full overflow-auto">
            <StyleTab />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
```

### 6. Workshop Page Route

```typescript
// frontend/src/app/dashboard/workshop/[id]/page.tsx

import { WorkshopProvider } from "@/components/workshop/WorkshopProvider";
import { WorkshopLayout } from "@/components/workshop/WorkshopLayout";

interface WorkshopPageProps {
  params: { id: string };
}

export default function WorkshopPage({ params }: WorkshopPageProps) {
  const tailoredId = parseInt(params.id, 10);

  if (isNaN(tailoredId)) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid workshop ID</p>
      </div>
    );
  }

  return (
    <WorkshopProvider tailoredId={tailoredId}>
      <WorkshopLayout />
    </WorkshopProvider>
  );
}
```

### 7. MobileControlSheet.tsx

```typescript
"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface MobileControlSheetProps {
  children: React.ReactNode;
}

export function MobileControlSheet({ children }: MobileControlSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Collapsed handle */}
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-0 left-0 right-0 h-12 bg-white border-t flex items-center justify-center gap-2 text-gray-600"
      >
        <ChevronUpIcon className="w-5 h-5" />
        <span className="text-sm font-medium">Edit Resume</span>
      </button>

      {/* Expanded sheet */}
      <Dialog open={isExpanded} onClose={() => setIsExpanded(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <Dialog.Panel className="fixed bottom-0 left-0 right-0 h-[70vh] bg-white rounded-t-xl shadow-xl">
          {/* Drag handle */}
          <div
            className="h-6 flex items-center justify-center cursor-pointer"
            onClick={() => setIsExpanded(false)}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Content */}
          <div className="h-[calc(100%-24px)] overflow-hidden">
            {children}
          </div>
        </Dialog.Panel>
      </Dialog>
    </>
  );
}
```

### 8. useMediaQuery Hook

```typescript
// frontend/src/hooks/useMediaQuery.ts

"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

---

## Navigation Guards

Add unsaved changes warning before navigation:

```typescript
// In WorkshopLayout or page.tsx

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (state.hasChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [state.hasChanges]);
```

---

## Edge Cases to Handle

| Edge Case | Solution |
|-----------|----------|
| Concurrent edits | Compare `updated_at` on save, warn if stale |
| Network errors | Show retry button on save failure |
| Large resumes | Virtual scrolling for long experience lists |
| Unsaved changes | `beforeunload` prompt + confirm dialog |
| Session timeout | Handle 401 gracefully, offer re-login |
| Initial load failure | Show error state with retry button |
| Export during save | Disable export while save in progress |
| Invalid ID in URL | Show error message, link back to tailor page |

---

## Dependencies

- `react-resizable-panels` - Already installed
- `@headlessui/react` - Already installed for tabs, dialog
- `@heroicons/react` - Already installed for icons
- No new packages required

---

## Acceptance Criteria

- [ ] Split-screen layout renders correctly (55% preview / 45% controls)
- [ ] Panels are resizable with drag handle
- [ ] Mobile view shows stacked layout with bottom sheet
- [ ] Header shows title, match score, and action buttons
- [ ] Save button is disabled when no changes
- [ ] Save button shows loading state
- [ ] Export dialog opens correctly
- [ ] Unsaved changes warning appears before navigation
- [ ] Tab switching preserves state
- [ ] Active section syncs between preview and editor
- [ ] Loading state displayed while fetching data
- [ ] Error state with retry option on failure

---

## Testing Strategy

### Unit Tests

- `workshopReducer` handles all action types correctly
- `applySuggestionToContent` applies changes correctly
- `useMediaQuery` returns correct values

### Component Tests

- `WorkshopLayout` renders desktop/mobile layouts correctly
- `WorkshopHeader` shows correct states
- `WorkshopControlPanel` switches tabs correctly
- `MobileControlSheet` opens/closes correctly

### Integration Tests

- Full save/load cycle works
- Tab state preserved across switches
- Active section syncs preview ↔ editor
- Navigation guard prompts on unsaved changes

### E2E Tests (Playwright)

- Complete workshop flow from entry to export
- Test on mobile viewport
- Test keyboard navigation
