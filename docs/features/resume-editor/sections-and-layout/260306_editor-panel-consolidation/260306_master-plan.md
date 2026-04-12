# Editor Panel Consolidation - Master Plan

**Created:** 2026-03-06
**Status:** Planning

## Overview

Reorganize the Workshop Style tab into **Quick Access** (always visible) and **Advanced** (collapsed) sections. Add missing `entry_spacing` control. Consolidate duplicate `DEFAULT_STYLE` definitions.

## Target Layout

```text
Style Tab
├── Template Presets: [Classic] [Modern] [Minimal]   ← Always visible
├── ☐ Fit to One Page                                ← Always visible
├── QUICK ACCESS (always visible)
│   ├── Font Family: [Inter ▼]
│   ├── Body Font Size: [11] (slider)
│   └── Line Spacing: ────●──── 1.15 (slider)
└── ▶ Advanced Settings (collapsed by default)
    ├── Typography: Heading size, Subheading size
    ├── Spacing: Section spacing, Entry spacing (NEW)
    └── Margins: Top, Bottom, Left, Right
```

## Problem Statement

1. **No explicit Quick Access section** - All controls treated equally, no hierarchy
2. **Missing `entry_spacing` control** - Exists in type and used by auto-fit, but not exposed in UI
3. **Duplicate `DEFAULT_STYLE` definitions** - Defined in 2 files with inconsistent values
4. **Cognitive overhead** - Users must expand multiple accordions to find commonly-used controls

## Scope

**In Scope:**

- Reorganize Style tab into Quick Access + Advanced sections
- Add `entry_spacing` slider to Advanced > Spacing
- Create centralized `DEFAULT_STYLE` source file
- Update imports across affected files
- Update preview styles to use `entry_spacing`

**Out of Scope:**

- Color controls (text, heading, accent) - deferred
- Merging Style tab into Editor tab
- Mobile-specific enhancements beyond ensuring layout works

## Implementation Phases

| Phase | Description | Files |
| ----- | ----------- | ----- |
| 1 | Foundation - DEFAULT_STYLE consolidation, add entry_spacing type | 3 files |
| 2 | New Components - QuickStyleControls + AdvancedStyleControls | 2 new files |
| 3 | StylePanel Refactor - Integrate new components | 1 file |
| 4 | Preview Styles - Add entryGap support | 1 file |
| 5 | Cleanup - Remove deprecated code | 1 file |

See phase-specific documents for detailed implementation steps.

## Files Summary

| File | Action |
| ---- | ------ |
| `/frontend/src/lib/styles/defaultStyle.ts` | **CREATE** |
| `/frontend/src/lib/api/types.ts` | **EDIT** |
| `/frontend/src/components/workshop/panels/style/QuickStyleControls.tsx` | **CREATE** |
| `/frontend/src/components/workshop/panels/style/AdvancedStyleControls.tsx` | **CREATE** |
| `/frontend/src/components/workshop/panels/style/StylePanel.tsx` | **EDIT** |
| `/frontend/src/components/workshop/WorkshopContext.tsx` | **EDIT** |
| `/frontend/src/components/editor/StyleControlsPanel.tsx` | **EDIT** |
| `/frontend/src/components/workshop/ResumePreview/previewStyles.ts` | **EDIT** |

## Verification Checklist

- [ ] Quick Access controls (font, body size, line spacing) always visible
- [ ] Advanced section collapsed by default, expands on click
- [ ] Entry spacing slider appears in Advanced > Spacing section (4-16px range)
- [ ] Style changes reflect immediately in preview
- [ ] Auto-fit disables all style controls (Quick + Advanced)
- [ ] Template preset selection applies all values including entry_spacing
- [ ] Reset button restores DEFAULT_STYLE
- [ ] No duplicate DEFAULT_STYLE definitions remain
- [ ] Mobile bottom sheet renders correctly with new layout

## Dependencies

- None (self-contained frontend refactor)

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Breaking auto-fit algorithm | entry_spacing already used internally; just exposing in UI |
| StyleControlsPanel used elsewhere | Check imports before removing; keep as legacy if needed |
