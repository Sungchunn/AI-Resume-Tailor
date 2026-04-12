# Fit-to-One-Page: Margin Optimization Plan

## Problem Statement

The current fit-to-one-page algorithm only adjusts:
1. Section spacing (12px → 6px)
2. Entry spacing (8px → 4px)
3. Line spacing (1.15 → 1.05)
4. Font size (10pt → 8pt)

**Margins are never touched.** Default margins are 0.5 inches on all sides, which is conservative. Reducing margins can reclaim significant space without compromising readability.

## Proposed Solution

Add margin reduction as the **first phase** of the compactness scale, with user control over the minimum margin value.

### Changes Overview

| Component | Change |
| --------- | ------ |
| `useAutoFitBlocks.ts` | Add margin reduction phase (0-20) |
| `types.ts` | Add `minMargin: number` to `BlockEditorState` |
| `defaults.ts` | Add `DEFAULT_MIN_MARGIN = 0.35` |
| `FormattingTab.tsx` | Add "Minimum margins" slider |
| `blockEditorReducer.ts` | Handle `SET_MIN_MARGIN` action |

---

## Implementation Plan

### 1. Update Compactness Algorithm

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

New compactness scale distribution:

```text
Level 0-20:   Margins reduced (0.5" → min)
Level 20-40:  Section spacing (12px → 6px)
Level 40-60:  Entry spacing (8px → 4px)
Level 60-80:  Line spacing (1.15 → 1.05)
Level 80-100: Font size (10pt → 8pt)
```

Add to `SPACING_MINIMUMS`:

```typescript
export const SPACING_MINIMUMS = {
  lineSpacing: 1.05,
  sectionSpacing: 6,
  entrySpacing: 4,
  // New
  marginTop: 0.35,
  marginBottom: 0.35,
  marginLeft: 0.35,
  marginRight: 0.35,
} as const;
```

Update `compactnessToStyle()` to handle margins first:

```typescript
// Phase 0: Margins (levels 0-20)
if (clampedLevel > 0) {
  const phaseProgress = Math.min(clampedLevel / 20, 1);
  const minMargin = userMinMargin ?? SPACING_MINIMUMS.marginTop;

  for (const prop of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight']) {
    const range = originalStyle[prop] - minMargin;
    if (range > 0) {
      style[prop] = originalStyle[prop] - range * phaseProgress;
    }
  }
}

// Shift other phases: 20-40, 40-60, 60-80, 80-100
```

Update `getMinimums()` to accept `userMinMargin` parameter.

Update `calculateReductions()` to include margin changes in the reductions list.

### 2. Update Types

**File:** `frontend/src/lib/resume/types.ts`

Add to `BlockEditorState`:

```typescript
interface BlockEditorState {
  // existing...
  minMargin: number;  // User-defined minimum margin (0.25-0.5 inches)
}
```

Add action:

```typescript
| { type: "SET_MIN_MARGIN"; payload: number }
```

### 3. Update Defaults

**File:** `frontend/src/lib/resume/defaults.ts`

```typescript
export const DEFAULT_MIN_MARGIN = 0.35;  // 0.35 inches

export function createEmptyState(): BlockEditorState {
  return {
    // existing...
    minMargin: DEFAULT_MIN_MARGIN,
  };
}
```

### 4. Update Reducer

**File:** `frontend/src/components/library/editor/blockEditorReducer.ts`

Add case:

```typescript
case "SET_MIN_MARGIN":
  return { ...state, minMargin: action.payload, isDirty: true };
```

### 5. Update UI

**File:** `frontend/src/components/library/editor/tabs/FormattingTab.tsx`

Add "Minimum margins" slider inside the Page Fitting card, below min font size:

```tsx
{/* Min Margin Slider */}
<div className="pt-2 border-t border-border/50">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-muted-foreground">
      Minimum margins
    </span>
    <span className="text-xs font-medium text-foreground tabular-nums">
      {minMargin.toFixed(2)}"
    </span>
  </div>
  <input
    type="range"
    min={0.25}
    max={0.5}
    step={0.05}
    value={minMargin}
    onChange={(e) => setMinMargin(Number(e.target.value))}
    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
  />
  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
    <span>Compact</span>
    <span>Spacious</span>
  </div>
</div>
```

### 6. Update Context

**File:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

Add `setMinMargin` to context value and expose in hook.

### 7. Update Hook Interface

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

Update `UseAutoFitBlocksOptions`:

```typescript
interface UseAutoFitBlocksOptions {
  // existing...
  minMargin?: number;  // User-defined minimum margin
}
```

Pass `minMargin` through to `compactnessToStyle()` and `calculateReductions()`.

---

## Files to Modify

1. `frontend/src/lib/resume/types.ts` - Add minMargin to state/actions
2. `frontend/src/lib/resume/defaults.ts` - Add DEFAULT_MIN_MARGIN, update state creators
3. `frontend/src/components/library/editor/blockEditorReducer.ts` - Handle SET_MIN_MARGIN
4. `frontend/src/components/library/editor/BlockEditorContext.tsx` - Expose setMinMargin
5. `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` - Add margin phase
6. `frontend/src/components/library/editor/tabs/FormattingTab.tsx` - Add margin slider UI

---

## Verification

1. **Unit test**: Verify `compactnessToStyle()` reduces margins at levels 0-20
2. **Manual test**:
   - Open resume editor at `/library/resumes/[id]/edit`
   - Enable "Fit to One Page"
   - Verify margins reduce before font size
   - Adjust "Minimum margins" slider and observe changes
   - Check adjustments list shows margin changes
3. **Tailor editor**: Verify same behavior at `/tailor/editor/[id]`
4. **Persistence**: Save resume, reload, verify minMargin is preserved

---

## Design Decisions

**Q: Why margins first, before spacing?**
A: Margins have the largest visual impact per unit reduced. A 0.15" reduction on all sides reclaims ~0.6" total, equivalent to several lines of text. This allows the algorithm to avoid touching font size in more cases.

**Q: Why 0.35" as default minimum?**
A: Professional resumes typically use 0.5" margins, but 0.35-0.4" is still ATS-friendly and readable. Going below 0.25" can cause printing issues.

**Q: Why not separate controls for each margin?**
A: Simplicity. Most users want uniform margins. A single slider reduces cognitive load while covering the common case.

---

## User Preferences (Confirmed)

- [x] Default minimum margin: **0.35 inches**
- [x] Add slider UI for user control: **Yes**
