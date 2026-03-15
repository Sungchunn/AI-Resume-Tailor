# Phase 5: Cleanup

**Parent:** [Master Plan](./060326_master-plan.md)

## Objective

Remove deprecated code and verify no duplicate definitions remain.

## Tasks

### 5.1 Check StyleControlsPanel Usage

**File:** `/frontend/src/components/editor/StyleControlsPanel.tsx`

Determine if this component is used anywhere else besides the old StylePanel:

```bash
# Search for imports of StyleControlsPanel
grep -r "StyleControlsPanel" frontend/src --include="*.tsx" --include="*.ts"
```

**If only used by old StylePanel:**

- Delete the entire file OR
- Keep as legacy with deprecation comment

**If used elsewhere:**

- Keep the file but remove duplicate `DEFAULT_STYLE` and `FONT_OPTIONS`
- Import from `@/lib/styles/defaultStyle` instead

### 5.2 Remove Duplicate Definitions

Verify these files no longer have local `DEFAULT_STYLE` definitions:

| File | Check |
| ---- | ----- |
| `/frontend/src/components/workshop/WorkshopContext.tsx` | Remove lines 88-99 if present |
| `/frontend/src/components/editor/StyleControlsPanel.tsx` | Remove lines 22-33 if present |

### 5.3 Verify Import Consistency

All files should import from the centralized source:

```typescript
import { DEFAULT_STYLE, FONT_OPTIONS } from "@/lib/styles/defaultStyle";
```

### 5.4 Update templatePresets.ts (if needed)

**File:** `/frontend/src/components/workshop/panels/style/templatePresets.ts`

Ensure presets include `entry_spacing` values:

```typescript
export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "classic",
    name: "Classic",
    style: {
      // ... existing ...
      entry_spacing: 8,  // ADD if missing
    },
  },
  {
    id: "modern",
    name: "Modern",
    style: {
      // ... existing ...
      entry_spacing: 6,  // ADD if missing
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    style: {
      // ... existing ...
      entry_spacing: 4,  // ADD if missing
    },
  },
];
```

## Verification Checklist

- [ ] No duplicate `DEFAULT_STYLE` definitions in codebase
- [ ] No duplicate `FONT_OPTIONS` definitions in codebase
- [ ] All imports point to `@/lib/styles/defaultStyle`
- [ ] StyleControlsPanel either removed or updated
- [ ] Template presets include `entry_spacing` values
- [ ] No TypeScript errors
- [ ] Workshop renders correctly with all features working
- [ ] Mobile layout displays correctly

## Final Testing

1. **Start dev server:** `cd frontend && bun dev`
2. **Navigate to Workshop:** `/workshop/{id}`
3. **Test Quick Access:**
   - Change font family - preview updates
   - Change body size - preview updates
   - Change line spacing - preview updates
4. **Test Advanced:**
   - Expand Advanced section
   - Change heading/subheading sizes
   - Change section spacing
   - Change entry spacing - verify list items spacing changes
   - Change margins
   - Click Reset - all values return to defaults
5. **Test Auto-Fit:**
   - Enable auto-fit - all controls become disabled
   - Verify adjustments are made
   - Disable auto-fit - controls re-enable
6. **Test Presets:**
   - Select each preset - styles apply including entry_spacing
7. **Test Mobile:**
   - Resize to mobile breakpoint
   - Open bottom sheet
   - Navigate to Style tab
   - Verify layout works correctly
