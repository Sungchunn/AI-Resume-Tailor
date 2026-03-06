# Inline AI Suggestions - Master Plan

**Created:** 2026-03-07
**Session:** 7 - Chat → Inline Suggestions

## Overview

Route AI suggestions inline into the TipTap editor (`ResumeEditor.tsx`) instead of the chat panel. Display diffs with inline strikethrough (red) + insertion (green), with per-suggestion accept/reject.

## Design Decisions

| Decision | Choice |
| -------- | ------ |
| Target Editor | TipTap `ResumeEditor.tsx` (library editor) |
| Diff Display | Inline strikethrough + green insertion |
| Granularity | Per-suggestion (whole unit) |
| Triggers | Toolbar button, `Cmd+Shift+I`, chat responses |
| Save Behavior | Accept updates content immediately, uses TipTap's History for undo |

## Existing Infrastructure

The codebase has strong foundations:

- **`suggestionExtension.ts`**: Custom TipTap mark with `original`, `suggested`, `reason`, `impact` attributes
- **Commands exist**: `setSuggestion`, `acceptSuggestion`, `removeSuggestionById`, `clearAllSuggestions`
- **Click handling**: ProseMirror plugin triggers `onSuggestionClick` callback
- **`SuggestionPopover.tsx`**: Already shows diff (strikethrough original, green suggested) with accept/reject buttons

**What's missing**: AI triggers, thinking state, inline diff mode toggle, and chat→inline routing.

## Phase Documents

| Phase | Description | File |
| ----- | ----------- | ---- |
| 1 | SuggestionExtension diff mode | [070326_phase-1-suggestion-extension.md](./070326_phase-1-suggestion-extension.md) |
| 2 | Thinking state plugin | [070326_phase-2-thinking-state.md](./070326_phase-2-thinking-state.md) |
| 3 | Popover enhancements | [070326_phase-3-popover.md](./070326_phase-3-popover.md) |
| 4 | AI trigger integration | [070326_phase-4-ai-triggers.md](./070326_phase-4-ai-triggers.md) |
| 5 | Suggestion service | [070326_phase-5-suggestion-service.md](./070326_phase-5-suggestion-service.md) |
| 6 | Undo verification | [070326_phase-6-undo-verification.md](./070326_phase-6-undo-verification.md) |

## Critical Files Summary

| File | Action |
| ---- | ------ |
| `frontend/src/lib/editor/suggestionExtension.ts` | Enhance with diff mode rendering, add `toggleDiffMode` command |
| `frontend/src/lib/editor/thinkingStatePlugin.ts` | **New** - ProseMirror plugin for loading state decorations |
| `frontend/src/components/editor/SuggestionPopover.tsx` | Add Enter key handler, inline diff toggle button |
| `frontend/src/components/editor/EditorToolbar.tsx` | Add AI sparkles button with dropdown menu |
| `frontend/src/components/editor/ResumeEditor.tsx` | Add `Cmd+Shift+I` handler, integrate thinking state, expose editor ref |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | Route `action_type: "improvement"` to inline marks instead of chat |
| `frontend/src/lib/services/inlineSuggestionService.ts` | **New** - Abstraction over `/api/v1/ai/improve-section` |
| `frontend/src/styles/editor.css` (or globals) | Add `.diff-deleted`, `.diff-inserted` CSS classes |

## Implementation Order

```text
Phase 1 (SuggestionExtension) ──┬──> Phase 3 (Popover enhancements)
                                │
Phase 2 (ThinkingState) ────────┼──> Phase 4 (AI Triggers)
                                │
                                └──> Phase 5 (Suggestion Service)

Phase 6 (Undo) - Verification only, no code changes needed
```

**Recommended sequence:**

1. Phase 1 + 2 in parallel (foundation)
2. Phase 5 (service layer)
3. Phase 3 + 4 in parallel (UI integration)
4. Phase 6 (verification)
