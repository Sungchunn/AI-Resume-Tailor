# Resume Workshop Master Plan

**Created**: February 25, 2026
**Status**: Planning
**Reference**: JobRight UI/UX patterns

---

## Executive Summary

This document serves as the **master index** for upgrading the Resume Tailor application from a document storage view to a **full workshop experience** comparable to JobRight. The implementation is divided into modular phases that can be developed independently by separate agents.

### Current State vs Target State

| Aspect         | Current                               | Target (JobRight-style)                      |
| -------------- | ------------------------------------- | -------------------------------------------- |
| Resume View    | Raw text dump                         | PDF-like formatted preview                   |
| Editing        | Separate edit page with textarea      | Inline section-based editor with rich text   |
| Scoring        | Calculated once, shown on tailor page | Real-time score updates with breakdown       |
| AI Suggestions | Exists but on separate page           | Integrated panel with accept/reject          |
| Styling        | Export-time only                      | Live style controls (font, spacing, margins) |
| Layout         | Single column                         | Split-screen: Preview + Controls             |
| Workflow       | Disjointed pages                      | Unified workshop experience                  |

### Key Discovery

**Much of the backend and frontend infrastructure already exists** but is fragmented:

- `EditorLayout.tsx` - Three-panel editor with tabs
- `StyleControlsPanel.tsx` - Font, spacing, margin controls
- `SuggestionsPanel.tsx` - AI suggestions with accept/reject
- `ATSKeywordsPanel.tsx` - Keyword analysis panel
- `ResumeEditor.tsx` - TipTap rich text editor
- Backend APIs for tailoring, ATS, scoring, export

**The problem**: These components live at `/dashboard/tailor/editor/[id]` but the library resume view at `/dashboard/library/resumes/[id]` shows raw text and doesn't utilize them.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESUME WORKSHOP PAGE                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │   HEADER    │  │   MATCH SCORE BAR    │  │   SAVE / EXPORT BTN    │  │
│  └─────────────┘  └──────────────────────┘  └────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────┐    ┌──────────────────────────────────┐   │
│  │                          │    │  ┌────────┬────────┬────────┐    │   │
│  │     PDF-LIKE PREVIEW     │    │  │AI Write│ Editor │ Style  │    │   │
│  │                          │    │  └────────┴────────┴────────┘    │   │
│  │  ┌────────────────────┐  │    │                                  │   │
│  │  │   CONTACT INFO     │  │    │  [Active Tab Content]            │   │
│  │  ├────────────────────┤  │    │                                  │   │
│  │  │     SUMMARY        │  │    │  - AI Rewrite: Suggestions list  │   │
│  │  ├────────────────────┤  │    │  - Editor: Section-based editing │   │
│  │  │    EXPERIENCE      │  │    │  - Style: Font, spacing controls │   │
│  │  │    • Bullet 1      │  │    │                                  │   │
│  │  │    • Bullet 2      │  │    │                                  │   │
│  │  ├────────────────────┤  │    │                                  │   │
│  │  │      SKILLS        │  │    │                                  │   │
│  │  ├────────────────────┤  │    │                                  │   │
│  │  │    EDUCATION       │  │    │                                  │   │
│  │  └────────────────────┘  │    │                                  │   │
│  │                          │    │                                  │   │
│  │     [ Page 1/2 ]         │    │                                  │   │
│  └──────────────────────────┘    └──────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Index

| Phase | Name | Priority | Dependencies | Est. Complexity |
| ----- | ---- | -------- | ------------ | --------------- |
| **A** | [PDF Preview Component](#phase-a-pdf-preview-component) | P0 | None | High |
| **B** | [Workshop Page Layout](#phase-b-workshop-page-layout) | P0 | Phase A | Medium |
| **C** | [Match Score Dashboard](#phase-c-match-score-dashboard) | P0 | None | Medium |
| **D** | [Three-Tab Control Panel](#phase-d-three-tab-control-panel) | P0 | Phase B | Low |
| **E** | [AI Rewrite Panel](#phase-e-ai-rewrite-panel) | P1 | Phase D | Medium |
| **F** | [Section-Based Editor](#phase-f-section-based-editor) | P1 | Phase D | High |
| **G** | [Style Controls Panel](#phase-g-style-controls-panel) | P1 | Phase D | Low |
| **H** | [Real-Time Score Updates](#phase-h-real-time-score-updates) | P2 | Phase C | Medium |
| **I** | [Step Wizard Flow](#phase-i-step-wizard-flow) | P2 | All above | Medium |
| **J** | [Polish and Animations](#phase-j-polish-and-animations) | P3 | All above | Low |

---

## Phase A: PDF Preview Component

**Goal**: Create a live, paginated PDF-like preview of the resume that updates as content changes.

### Phase A Requirements

- Render resume content in a document-like format (white page, proper margins)
- Support pagination with page indicators ("1/2")
- "Fit to one page" toggle
- Reflect style settings (font family, sizes, spacing) in real-time
- Section highlighting when editing corresponding section
- Responsive sizing

### Phase A Technical Approach

1. Create `ResumePreview.tsx` component using CSS print styling
2. Use `@page` CSS rules for pagination simulation
3. Apply style settings from context/props
4. Calculate content overflow for page breaks
5. Highlight active section with subtle border/background

### Phase A Files

```text
frontend/src/components/workshop/
├── ResumePreview.tsx          # Main preview component
├── PreviewPage.tsx            # Single page container
├── PreviewSection.tsx         # Individual section renderer
├── PreviewPagination.tsx      # Page indicator controls
└── usePreviewPagination.ts    # Pagination logic hook
```

### Phase A Existing Assets

- `StyleControlsPanel.tsx` - Style settings interface
- `TailoredContentSchema` - Content structure
- Export templates (classic, modern, minimal) - Styling reference

### Phase A Acceptance Criteria

- [ ] Resume renders in document-like format
- [ ] Page breaks calculated correctly
- [ ] Pagination controls work
- [ ] "Fit to one page" adjusts font/spacing
- [ ] Style changes reflect immediately
- [ ] Section hover highlights corresponding content

---

## Phase B: Workshop Page Layout

**Goal**: Create unified workshop page with split-screen layout (preview + controls).

### Phase B Requirements

- Replace current `/dashboard/library/resumes/[id]` with workshop experience
- Split-screen: ~55% preview, ~45% controls
- Resizable panels (react-resizable-panels)
- Responsive collapse on mobile
- Persistent header with title, score, and action buttons

### Phase B Technical Approach

1. Create `WorkshopLayout.tsx` as main container
2. Integrate with existing `EditorLayout.tsx` patterns
3. Use `react-resizable-panels` (already installed)
4. Create `WorkshopHeader.tsx` for persistent top bar
5. Route integration: `/dashboard/workshop/[id]`

### Phase B Files

```text
frontend/src/app/dashboard/workshop/
├── [id]/
│   └── page.tsx               # Main workshop page
├── layout.tsx                 # Workshop-specific layout

frontend/src/components/workshop/
├── WorkshopLayout.tsx         # Split-screen container
├── WorkshopHeader.tsx         # Header with score, buttons
└── WorkshopContext.tsx        # Shared state provider
```

### Phase B Existing Assets

- `EditorLayout.tsx` - Three-panel layout pattern
- `react-resizable-panels` - Already installed
- Export/save patterns from tailor pages

### Phase B Acceptance Criteria

- [ ] Split-screen layout renders correctly
- [ ] Panels are resizable
- [ ] Mobile view collapses appropriately
- [ ] Header shows title, score, action buttons
- [ ] Save/export actions work

---

## Phase C: Match Score Dashboard

**Goal**: Display comprehensive match scoring with visual breakdown.

### Phase C Requirements

- Overall match score (0-100) with gauge/meter visualization
- Category breakdown (Experience Level, Skills, Industry Match)
- Score improvement indicator ("Your score jumped from 4.5 to 9.0")
- Color coding (red < 60, yellow 60-80, green > 80)
- Compact mode for header, expanded mode for detail view

### Phase C Technical Approach

1. Create `MatchScoreGauge.tsx` using SVG arc
2. Create `ScoreBreakdown.tsx` for category bars
3. Create `ScoreImprovement.tsx` for before/after
4. Integrate with `/api/tailor/quick-match` endpoint
5. Cache original score for comparison

### Phase C Files

```text
frontend/src/components/workshop/
├── MatchScoreGauge.tsx        # Circular gauge component
├── ScoreBreakdown.tsx         # Category breakdown bars
├── ScoreImprovement.tsx       # Before/after indicator
└── ScoreSummary.tsx           # Combined compact view
```

### Phase C Backend Endpoints

- `POST /api/tailor/quick-match` - Fast scoring
- `POST /api/tailor` - Full analysis with skill matches/gaps
- `POST /api/v1/ats/keywords/detailed` - Keyword breakdown

### Phase C Acceptance Criteria

- [ ] Gauge displays 0-100 score visually
- [ ] Categories show individual scores
- [ ] Colors reflect score quality
- [ ] Score improvement shows delta
- [ ] Loading states handled

---

## Phase D: Three-Tab Control Panel

**Goal**: Implement tabbed interface (AI Rewrite | Editor | Style) for the right panel.

### Phase D Requirements

- Three tabs: "AI Rewrite", "Editor", "Style"
- Tab content switches without losing state
- Active tab indicator
- Keyboard navigation (arrow keys)
- Persist selected tab in URL or localStorage

### Phase D Technical Approach

1. Create `ControlPanelTabs.tsx` using headless UI tabs
2. Create container components for each tab
3. Use React context for cross-tab state
4. Leverage existing panel components

### Phase D Files

```text
frontend/src/components/workshop/
├── ControlPanelTabs.tsx       # Tab navigation
├── panels/
│   ├── AIRewritePanel.tsx     # Phase E content
│   ├── EditorPanel.tsx        # Phase F content
│   └── StylePanel.tsx         # Phase G content
└── ControlPanelContext.tsx    # Shared panel state
```

### Phase D Existing Assets

- `@headlessui/react` - Tab components
- `SuggestionsPanel.tsx` - AI suggestions (for AIRewritePanel)
- `StyleControlsPanel.tsx` - Style controls (for StylePanel)
- `ContentEditor.tsx` - Section editing (for EditorPanel)

### Phase D Acceptance Criteria

- [ ] Three tabs render and switch correctly
- [ ] State preserved when switching tabs
- [ ] Keyboard navigation works
- [ ] Active tab visually indicated
- [ ] Mobile-friendly tab bar

---

## Phase E: AI Rewrite Panel

**Goal**: Integrate AI suggestions with "See What's Changed" summary.

### Phase E Requirements

- List of AI suggestions grouped by section
- Accept/reject individual suggestions
- "Accept All" bulk action
- "See What's Changed" summary at top
- Impact indicators (high/medium/low)
- "Edit with AI" free-form input at bottom

### Phase E Technical Approach

1. Extend existing `SuggestionsPanel.tsx`
2. Add change summary component
3. Add free-form AI prompt input
4. Connect to `/api/tailor` suggestions

### Phase E Files

```text
frontend/src/components/workshop/panels/
├── AIRewritePanel.tsx         # Main panel
├── SuggestionCard.tsx         # Individual suggestion
├── ChangeSummary.tsx          # "See What's Changed"
├── AIPromptInput.tsx          # Free-form AI input
└── BulkActions.tsx            # Accept all, reject all
```

### Phase E Backend Endpoints

- `POST /api/tailor` - Generate suggestions
- `PATCH /api/tailor/{id}` - Apply suggestion updates

### Phase E Acceptance Criteria

- [ ] Suggestions display with accept/reject
- [ ] Change summary shows at top
- [ ] Bulk actions work
- [ ] Impact levels color-coded
- [ ] Free-form AI input sends requests

---

## Phase F: Section-Based Editor

**Goal**: Create collapsible section editor with drag-to-reorder.

### Phase F Requirements

- Collapsible sections (Summary, Experience, Skills, Education, Projects)
- Inline editing within sections
- Drag-to-reorder sections
- Add/remove sections
- Per-section action buttons (edit, AI enhance, delete)

### Phase F Technical Approach

1. Create `SectionEditor.tsx` with accordion pattern
2. Use `@dnd-kit/core` for drag-drop
3. Create specialized editors per section type
4. Integrate with TipTap for rich text

### Phase F Files

```text
frontend/src/components/workshop/panels/
├── EditorPanel.tsx            # Main editor panel
├── SectionList.tsx            # Sortable section list
├── SectionItem.tsx            # Collapsible section
├── sections/
│   ├── SummaryEditor.tsx      # Summary section
│   ├── ExperienceEditor.tsx   # Experience entries
│   ├── SkillsEditor.tsx       # Skills list
│   ├── EducationEditor.tsx    # Education entries
│   └── ProjectsEditor.tsx     # Projects list
└── SectionActions.tsx         # Action buttons
```

### Phase F Existing Assets

- `ContentEditor.tsx` - Existing section editor
- `ResumeEditor.tsx` - TipTap integration
- `@dnd-kit` - Drag-drop library (may need install)

### Phase F Acceptance Criteria

- [ ] Sections collapse/expand
- [ ] Drag-to-reorder works
- [ ] Inline editing functional
- [ ] Add/remove sections works
- [ ] Changes sync with preview

---

## Phase G: Style Controls Panel

**Goal**: Integrate style controls for typography and spacing.

### Phase G Requirements

- Font family selector
- Font size controls (Name, Headers, Subheaders, Body)
- Spacing controls (Section, Entry, Line)
- Margin controls
- "Auto Fit to One Page" toggle
- Template presets (Classic, Modern, Minimal)

### Phase G Technical Approach

1. Leverage existing `StyleControlsPanel.tsx`
2. Add template preset selector
3. Add auto-fit logic
4. Connect to preview for live updates

### Phase G Files

```text
frontend/src/components/workshop/panels/
├── StylePanel.tsx             # Main style panel
├── FontControls.tsx           # Font family, sizes
├── SpacingControls.tsx        # Line, section, entry
├── MarginControls.tsx         # Page margins
├── TemplateSelector.tsx       # Preset templates
└── AutoFitToggle.tsx          # Fit to one page
```

### Phase G Existing Assets

- `StyleControlsPanel.tsx` - **Already implemented**, refactor/extend
- Export templates - Style presets reference

### Phase G Acceptance Criteria

- [ ] Font controls update preview live
- [ ] Spacing controls work
- [ ] Margin controls work
- [ ] Templates apply preset styles
- [ ] Auto-fit adjusts appropriately

---

## Phase H: Real-Time Score Updates

**Goal**: Update match score as resume content changes.

### Phase H Requirements

- Debounced score recalculation on content change
- Visual indicator when score is recalculating
- Score history (show improvement)
- Optimistic UI updates

### Phase H Technical Approach

1. Create `useScoreCalculation` hook with debouncing
2. Subscribe to content changes from editor
3. Call `/api/tailor/quick-match` on changes
4. Cache and compare scores

### Phase H Files

```text
frontend/src/hooks/
├── useScoreCalculation.ts     # Debounced score updates
├── useContentChangeDetection.ts # Detect content changes

frontend/src/components/workshop/
└── ScoreUpdateIndicator.tsx   # Loading/updating indicator
```

### Phase H Acceptance Criteria

- [ ] Score updates after content changes
- [ ] Debouncing prevents excessive API calls
- [ ] Loading indicator shows during calculation
- [ ] Score improvement displayed

---

## Phase I: Step Wizard Flow

**Goal**: Optional guided workflow for first-time users.

### Phase I Requirements

- Step 1: See Your Difference (current vs job requirements)
- Step 2: Align Your Resume (select sections to enhance)
- Step 3: Review Your New Resume (final preview)
- Skip option for experienced users
- Progress indicator

### Phase I Technical Approach

1. Create `WorkshopWizard.tsx` modal/overlay
2. Create step components
3. Store wizard completion in user preferences
4. Optional entry point from job matching

### Phase I Files

```text
frontend/src/components/workshop/wizard/
├── WorkshopWizard.tsx         # Main wizard container
├── WizardProgress.tsx         # Step indicator
├── steps/
│   ├── DifferenceStep.tsx     # See your difference
│   ├── AlignStep.tsx          # Section selection
│   └── ReviewStep.tsx         # Final preview
└── useWizardState.ts          # Wizard state management
```

### Phase I Acceptance Criteria

- [ ] Wizard guides through 3 steps
- [ ] Progress indicator shows current step
- [ ] Can skip wizard
- [ ] Remembers if user completed wizard

---

## Phase J: Polish and Animations

**Goal**: Add micro-interactions and polish for production-ready UX.

### Phase J Requirements

- Smooth transitions between tabs
- Score gauge animation
- Suggestion accept/reject animations
- Section collapse animations
- Loading skeletons
- Keyboard shortcuts

### Phase J Technical Approach

1. Add Framer Motion animations
2. Create loading skeleton components
3. Implement keyboard shortcut system
4. Add haptic feedback (where supported)

### Phase J Files

```text
frontend/src/components/workshop/
├── animations/
│   ├── FadeTransition.tsx
│   ├── SlideTransition.tsx
│   └── ScaleTransition.tsx
├── skeletons/
│   ├── PreviewSkeleton.tsx
│   ├── ScoreSkeleton.tsx
│   └── PanelSkeleton.tsx
└── useKeyboardShortcuts.ts
```

### Phase J Acceptance Criteria

- [ ] Tab transitions smooth
- [ ] Score animates on change
- [ ] Suggestions animate on accept/reject
- [ ] Keyboard shortcuts functional
- [ ] Loading states polished

---

## File Structure Summary

```text
frontend/src/
├── app/dashboard/workshop/
│   ├── [id]/page.tsx                    # Main workshop page
│   └── layout.tsx                       # Workshop layout
│
├── components/workshop/
│   ├── WorkshopLayout.tsx               # Phase B
│   ├── WorkshopHeader.tsx               # Phase B
│   ├── WorkshopContext.tsx              # Phase B
│   │
│   ├── ResumePreview.tsx                # Phase A
│   ├── PreviewPage.tsx                  # Phase A
│   ├── PreviewSection.tsx               # Phase A
│   ├── PreviewPagination.tsx            # Phase A
│   │
│   ├── MatchScoreGauge.tsx              # Phase C
│   ├── ScoreBreakdown.tsx               # Phase C
│   ├── ScoreImprovement.tsx             # Phase C
│   │
│   ├── ControlPanelTabs.tsx             # Phase D
│   │
│   ├── panels/
│   │   ├── AIRewritePanel.tsx           # Phase E
│   │   ├── EditorPanel.tsx              # Phase F
│   │   └── StylePanel.tsx               # Phase G
│   │
│   ├── wizard/
│   │   ├── WorkshopWizard.tsx           # Phase I
│   │   └── steps/                       # Phase I
│   │
│   └── animations/                      # Phase J
│
├── hooks/
│   ├── usePreviewPagination.ts          # Phase A
│   ├── useScoreCalculation.ts           # Phase H
│   └── useKeyboardShortcuts.ts          # Phase J
│
└── lib/api/
    └── workshop.ts                      # Workshop-specific API hooks
```

---

## Backend Requirements

Most backend functionality already exists. Minor additions needed:

### New Endpoints

- None required - existing endpoints sufficient

### Existing Endpoints Reference

| Feature | Endpoint | Purpose |
| ------- | -------- | ------- |
| Scoring | `POST /api/tailor/quick-match` | Fast score calculation |
| Full Tailor | `POST /api/tailor` | Generate suggestions + tailored content |
| Update | `PATCH /api/tailor/{id}` | Save changes |
| ATS | `POST /api/v1/ats/keywords/detailed` | Keyword analysis |
| Export | `POST /api/resumes/{id}/export` | PDF/DOCX generation |
| Templates | `GET /api/resumes/export/templates` | Available templates |

---

## Dependencies

### Already Installed

- `react-resizable-panels` - Panel layout
- `@tiptap/react` - Rich text editor
- `@headlessui/react` - UI components
- `framer-motion` - Animations

### May Need to Install

- `@dnd-kit/core` - Drag-drop for section reordering
- `react-pdf` - PDF preview rendering (optional approach)

---

## Testing Strategy

### Unit Tests

- Each component tested in isolation
- Hook logic tested with React Testing Library
- Score calculation logic tested

### Integration Tests

- Full workshop flow from job selection to export
- API integration with mock server
- State management across tabs

### E2E Tests with Playwright

- Complete user journey
- Mobile responsiveness
- Keyboard navigation

---

## Migration Path

1. **Phase 1**: Build workshop components in parallel to existing pages
2. **Phase 2**: Add route `/dashboard/workshop/[id]` alongside existing
3. **Phase 3**: Add "Open in Workshop" button to existing resume pages
4. **Phase 4**: Gather feedback, iterate
5. **Phase 5**: Gradually deprecate old resume detail page
6. **Phase 6**: Redirect old routes to workshop

---

## Success Metrics

- **User Engagement**: Time spent in workshop vs old view
- **Completion Rate**: % of users who complete tailoring flow
- **Score Improvement**: Average score increase after workshop use
- **Export Rate**: % of workshop sessions resulting in export
- **User Satisfaction**: NPS for workshop experience

---

## Next Steps

1. Create detailed implementation docs for each phase (separate files)
2. Prioritize Phase A, B, C, D for MVP
3. Set up feature flags for gradual rollout
4. Define API contract for any new endpoints
5. Create Figma mockups for visual reference

---

## Related Documents

- `/docs/planning/170226_implementation-plan-v2.md` - Original architecture plan
- `/docs/planning/230226_code-review-refactoring-plan.md` - Code cleanup plan
- `/docs/api/tailor-match.md` - Tailoring API documentation
- `/docs/api/ats.md` - ATS analysis documentation
