# Resume Editor Redesign

**Created:** 2026-02-26
**Status:** In Progress (Phase 7 Complete)
**Feature Area:** Library / Resume Editor

---

## Overview

Redesign the custom resume editor page (`/dashboard/library/resumes/{id}/edit`) to provide a paper-accurate preview with interactive controls. The new layout splits the screen with an **A4 paper preview on the left** and a **tabbed control panel on the right**.

---

## Current State

### Existing Layout

```text
┌─────────────────────────────────────────────────────┐
│ EditorHeader                                        │
├──────────────────────┬──────────────────────────────┤
│ LEFT (45%)           │ RIGHT (55%)                  │
│ EditorToolbar        │ ResumePreview                │
│ BlockList (drag)     │ (single page, no pagination) │
└──────────────────────┴──────────────────────────────┘
```

### Current Files

- `frontend/src/app/dashboard/library/resumes/[id]/edit/page.tsx` - Entry point
- `frontend/src/components/library/editor/EditorLayout.tsx` - Main layout
- `frontend/src/components/library/editor/EditorToolbar.tsx` - Style controls
- `frontend/src/components/library/editor/BlockList.tsx` - Drag-and-drop section list
- `frontend/src/components/library/editor/BlockEditorContext.tsx` - State management
- `frontend/src/components/library/editor/BlockEditorProvider.tsx` - Context provider
- `frontend/src/components/library/preview/` - Preview components

### Limitations

1. Preview shows single continuous page (no page breaks)
2. Preview doesn't accurately represent A4 export output
3. No hover interaction for direct section manipulation
4. No ATS analysis integration
5. No AI chat interface for recommendations

---

## New Design

### Target Layout

```text
┌─────────────────────────────────────────────────────┐
│ EditorHeader                                        │
├──────────────────────────────┬──────────────────────┤
│ LEFT (55%)                   │ RIGHT (45%)          │
│ PagedResumePreview           │ ControlPanel (Tabs)  │
│ - A4 paper with page breaks  │ ┌────┬────┬────┬───┐ │
│ - Hover shows section boxes  │ │ AI │ATS │Fmt │Sec│ │
│ - Move up/down on hover      │ └────┴────┴────┴───┘ │
│                              │ [Tab Content Area]   │
└──────────────────────────────┴──────────────────────┘
```

### Key Features

#### 1. Paged A4 Preview (Left Panel)

- Exact A4 paper dimensions (816x1056px at 96 DPI)
- Page separation with visual breaks between pages
- Page number indicators
- Real-time updates when content changes
- Hover interaction on sections:
  - Dashed selection box appears around section
  - Up/down move arrows on left edge
  - Click arrows to reorder (vertical only - 1D design)
  - Click section to select (syncs with Section Dragger tab)

#### 2. Tabbed Control Panel (Right Panel)

##### Tab 1: AI Chat

- Conversational chat interface for AI recommendations
- Quick action buttons for common operations
- **Section-based editing only** (never entire resume)
- Examples:
  - "Improve my summary for a software engineer role"
  - "Add more action verbs to this experience"
  - "Make this more concise"

##### Tab 2: ATS Evaluation

- **Requires job context** - disabled without a job
- Job context passed via URL from job board (`?jobId=123`)
- When enabled:
  - Keyword coverage analysis
  - ATS compatibility score
  - Missing keyword suggestions
  - Section-by-section feedback

##### Tab 3: Formatting

- Style presets: Classic, Modern, Minimal, Executive
- Font controls:
  - Font family selection
  - Body font size
  - Heading font size
  - Subheading font size
- Spacing controls:
  - Margins (top, bottom, left, right)
  - Line height
  - Section spacing
  - Entry spacing
- Auto-fit to one page toggle

##### Tab 4: Section Dragger

- Drag-and-drop section reordering
- Add section button (dropdown with available types)
- Remove section button (with confirmation)
- Section visibility toggles
- Syncs selection with preview

---

## User Flows

### Flow 1: Direct Resume Edit

1. User navigates to `/dashboard/library/resumes/{id}/edit`
2. Page loads with no job context
3. ATS tab is disabled with message: "Navigate from a job to enable ATS analysis"
4. User can edit formatting, reorder sections, use AI chat

### Flow 2: Optimize Resume for Job

1. User is on `/dashboard/jobs/{id}` (user-created job or scraped listing)
2. User clicks "Optimize resume for this job"
3. User selects which resume to optimize
4. Redirects to `/dashboard/library/resumes/{resumeId}/edit?jobId={jobId}`
5. Page fetches job description from API
6. ATS tab is enabled with full analysis
7. AI chat has job context for better suggestions

---

## Technical Implementation

### New Files to Create

```text
frontend/src/components/library/editor/
├── ControlPanel.tsx                 # Tab container
├── PreviewPanel.tsx                 # Interactive preview wrapper
└── tabs/
    ├── index.ts                     # Barrel export
    ├── AIChatTab.tsx               # AI chat interface
    ├── ATSEvaluationTab.tsx        # ATS analysis
    ├── FormattingTab.tsx           # Style controls
    └── SectionDraggerTab.tsx       # Section ordering

frontend/src/components/library/preview/
├── PagedResumePreview.tsx          # Multi-page preview
├── InteractiveBlockRenderer.tsx    # Block with hover
├── useBlockPageBreaks.ts           # Page break calculation
└── PreviewPagination.tsx           # Page indicators
```

### Files to Modify

| File | Changes |
| ------ | -------- |
| `editor/EditorLayout.tsx` | Swap panel positions, integrate ControlPanel |
| `editor/BlockEditorContext.tsx` | Add hover state, job context |
| `editor/BlockEditorProvider.tsx` | Implement new context values |
| `editor/blockEditorReducer.ts` | Add MOVE_BLOCK_UP/DOWN, SET_HOVERED_BLOCK |
| `preview/BlockRenderer.tsx` | Add hover interaction props |
| `[id]/edit/page.tsx` | Handle jobId query param |

### State Management Additions

```typescript
// Add to BlockEditorContextValue
interface BlockEditorContextValue {
  // ... existing ...

  // Hover state for preview interaction
  hoveredBlockId: string | null;
  setHoveredBlock: (id: string | null) => void;
  moveBlockUp: (id: string) => void;
  moveBlockDown: (id: string) => void;

  // Job context for ATS tab (from URL params)
  jobId: number | null;
  jobDescription: string | null;

  // AI Chat section targeting
  selectedSectionForAI: string | null;
  setSelectedSectionForAI: (id: string | null) => void;
}
```

### New Reducer Actions

```typescript
type BlockEditorAction =
  // ... existing ...
  | { type: "SET_HOVERED_BLOCK"; payload: string | null }
  | { type: "MOVE_BLOCK_UP"; payload: string }
  | { type: "MOVE_BLOCK_DOWN"; payload: string }
  | { type: "SET_SELECTED_SECTION_FOR_AI"; payload: string | null };
```

### Page Break Calculation

Adapt `usePageBreaks.ts` from workshop for block-based content:

```typescript
interface BlockPageBreakResult {
  pages: BlockPageContent[];
  totalPages: number;
  blockPageMap: Map<string, number>;  // blockId -> pageNumber
  exceedsOnePage: boolean;
}

interface BlockPageContent {
  pageNumber: number;
  blockIds: string[];
  startY: number;  // Y position within page
}
```

Algorithm:

1. Calculate available height per page (PAGE_HEIGHT - margins)
2. Estimate each block's rendered height based on content
3. Assign blocks to pages, tracking cumulative height
4. Handle blocks that span multiple pages (large experience sections)
5. Return page assignments for rendering

### Hover Interaction Implementation

```typescript
// InteractiveBlockRenderer.tsx
function InteractiveBlockRenderer({ block, style, isActive }) {
  const { setHoveredBlock, moveBlockUp, moveBlockDown, blocks } = useBlockEditor();
  const [isHovered, setIsHovered] = useState(false);

  const blockIndex = blocks.findIndex(b => b.id === block.id);
  const canMoveUp = blockIndex > 0;
  const canMoveDown = blockIndex < blocks.length - 1;

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        setHoveredBlock(block.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredBlock(null);
      }}
      className={cn(
        "relative transition-all",
        isHovered && "ring-2 ring-primary ring-dashed",
        isActive && "ring-2 ring-primary"
      )}
    >
      {isHovered && (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <button
            disabled={!canMoveUp}
            onClick={() => moveBlockUp(block.id)}
          >
            <ChevronUp />
          </button>
          <button
            disabled={!canMoveDown}
            onClick={() => moveBlockDown(block.id)}
          >
            <ChevronDown />
          </button>
        </div>
      )}
      <BlockRenderer block={block} style={style} isActive={isActive} />
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Layout Restructure

**Goal:** Swap panel positions and create tab structure

Tasks:

1. Create `ControlPanel.tsx` with basic tab navigation (shadcn/ui Tabs)
2. Modify `EditorLayout.tsx` to place preview on left, control panel on right
3. Create placeholder components for each tab
4. Verify existing functionality still works

### Phase 2: Formatting Tab

**Goal:** Move style controls to new location

Tasks:

1. Create `FormattingTab.tsx` extracting content from `EditorToolbar.tsx`
2. Remove tab navigation from toolbar (now handled by ControlPanel)
3. Ensure all style controls function correctly
4. Test style presets, font controls, spacing controls

### Phase 3: Section Dragger Tab

**Goal:** Dedicated section ordering interface

Tasks:

1. Create `SectionDraggerTab.tsx` adapting patterns from `BlockList.tsx`
2. Focus on reordering only (no inline editing)
3. Add section visibility toggles
4. Test drag-and-drop functionality
5. Sync selection state with preview

### Phase 4: Page Breaks in Preview

**Goal:** Multi-page A4 preview

Tasks:

1. Create `useBlockPageBreaks.ts` hook adapting workshop logic
2. Create `PagedResumePreview.tsx` component
3. Add visual page separators (gap between pages)
4. Add page number indicators
5. Test with various content lengths

### Phase 5: Hover Interactions

**Goal:** Interactive section manipulation in preview

Tasks:

1. Create `InteractiveBlockRenderer.tsx` wrapper component
2. Add hover state to BlockEditorContext
3. Implement move up/down functionality
4. Add selection box styling on hover
5. Sync selection with Section Dragger tab

### Phase 6: AI Chat Tab

**Goal:** Conversational AI for resume improvement

Tasks:

1. Create `AIChatTab.tsx` with chat interface
2. Add quick action buttons for common operations
3. Integrate with existing AI suggestion APIs
4. Implement section-based editing (target specific sections)
5. Add chat message history to context

### Phase 7: ATS Evaluation Tab ✅ COMPLETE

**Goal:** Job-aware ATS analysis

Tasks:

1. ✅ Create `ATSEvaluationTab.tsx` component
2. ✅ Handle disabled state when no jobId in URL
3. ✅ Fetch job description when jobId present (supports both user-created jobs and scraped job listings)
4. ✅ Integrate `ATSKeywordsPanel` functionality (keyword sections, coverage indicators)
5. ✅ Show keyword coverage and ATS score

**Implementation Notes:**
- Added `blocksToText()` function in `transforms.ts` to convert resume blocks to plain text for ATS analysis
- Updated page.tsx to handle both `?jobId=` (user-created job) and `?jobListingId=` (scraped listing) query params
- Updated EditorLayout and ControlPanel to pass both job context types
- ATSEvaluationTab fetches from appropriate API based on which ID is provided
- Auto-runs analysis when job description loads with 1000ms debounce
- Shows job title/company header, ATS score display, coverage progress bars, keyword sections by importance, and suggestions

---

## API Dependencies

### Existing APIs to Use

- `PATCH /resumes/{id}` - Update resume content and style
- `POST /tailor/analyze-ats` - ATS keyword analysis
- `POST /tailor/suggest` - AI suggestions for content
- `GET /jobs/{id}` - Fetch user-created job description
- `GET /job-listings/{id}` - Fetch scraped job listing

### Potential New APIs

- `POST /ai/chat` - Conversational AI endpoint (if not using existing suggest)
- May need to extend suggest endpoint for section-specific context

---

## UI Components to Use

### From shadcn/ui

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - Tab navigation
- `Button` - Actions
- `Tooltip` - Disabled tab explanations
- `ScrollArea` - Scrollable content areas
- `Separator` - Visual dividers

### Existing Components to Reuse

- `ATSKeywordsPanel` - ATS analysis display
- `AIRewritePanel` patterns - Chat interface inspiration
- `BlockRenderer` - Section rendering
- `ResizablePanel` - Panel layout

---

## Testing Checklist

### Functional Tests

- [ ] Layout displays preview on left, tabs on right
- [ ] Panels are resizable
- [ ] Page breaks calculate correctly for various content lengths
- [ ] Multiple pages render with visible separators
- [ ] Hover on section shows selection box
- [ ] Move up/down arrows appear on hover
- [ ] Clicking arrows reorders sections
- [ ] Section Dragger tab allows drag-and-drop
- [ ] Formatting tab applies all style changes
- [ ] AI Chat sends/receives messages
- [ ] AI Chat edits target specific sections
- [ ] ATS tab disabled without jobId in URL
- [ ] ATS tab enabled with jobId showing analysis
- [ ] Selection syncs between preview and Section Dragger

### Edge Cases

- [ ] Resume with only one section
- [ ] Resume with many sections (5+ pages)
- [ ] Very long experience entries spanning pages
- [ ] Empty resume (no sections)
- [ ] Rapid hover in/out doesn't cause flicker

### Keyboard Shortcuts

- [ ] Cmd/Ctrl+S still saves
- [ ] Cmd/Ctrl+Z still undoes
- [ ] Cmd/Ctrl+Shift+Z still redoes

---

## Design Decisions

### Why Preview on Left?

- Users read left-to-right; the preview (primary output) should be prominent
- Controls on right mirrors document editing software (Word, Google Docs)
- Allows preview to be larger (55% vs 45%)

### Why Section-Based AI Editing?

- More precise control for users
- Avoids unintended changes to other sections
- Allows targeted improvements
- Matches mental model of "fixing one thing at a time"

### Why Job Context via URL?

- Clean separation of concerns
- Works with browser history (back button works)
- Allows bookmarking specific edit sessions
- No complex state passing between pages

### Why Estimated Heights for Page Breaks?

- Real DOM measurement requires rendering, causes layout shifts
- Estimates are fast and work well for typical resume content
- Can be refined later with measurement-based approach

---

## Future Enhancements

1. **Real-time collaboration** - Multiple users editing same resume
2. **Version history** - View and restore previous versions
3. **Template switching** - Change resume template without losing content
4. **Print preview** - Show exactly how print output will look
5. **Mobile-responsive editing** - Edit on tablet/phone
6. **AI auto-complete** - Suggest completions as user types
