# Fit-to-One-Page: Line Spacing Optimization Plan

## Problem Statement

The fit-to-one-page algorithm currently reduces line spacing from 1.15 → 1.05 during phase 3 (compactness levels 60-80). However, the minimum value of **1.05 is hardcoded** and not user-configurable.

**The current minimum (1.05) is not aggressive enough** - even with margin reduction, some resumes still can't fit on one page. Allowing single spacing (1.0) provides additional space savings.

Users may want to:
- Use single spacing (1.0) for maximum content density
- Preserve more spacing (1.1-1.15) for readability

## Proposed Solution

Add user control over the minimum line spacing value via a slider, following the same pattern as `minFontSize` and `minMargin`.

### Changes Overview

| Component | Change |
| --------- | ------ |
| `types.ts` | Add `minLineSpacing: number` to `BlockEditorState` |
| `defaults.ts` | Add `DEFAULT_MIN_LINE_SPACING = 1.0` |
| `blockEditorReducer.ts` | Handle `SET_MIN_LINE_SPACING` action |
| `BlockEditorContext.tsx` | Add `setMinLineSpacing` method |
| `BlockEditorProvider.tsx` | Wire state and pass to `useAutoFitBlocks` |
| `useAutoFitBlocks.ts` | Accept `minLineSpacing` parameter |
| `FormattingTab.tsx` | Add "Minimum line spacing" slider |

---

## Implementation Plan

### 1. Update Types

**File:** `frontend/src/lib/resume/types.ts`

Add to `BlockEditorState`:

```typescript
/** User-defined minimum line spacing for fit-to-page algorithm (1.0-1.15) */
minLineSpacing: number;
```

Add action to `BlockEditorAction`:

```typescript
| { type: "SET_MIN_LINE_SPACING"; payload: number }
```

### 2. Update Defaults

**File:** `frontend/src/lib/resume/defaults.ts`

```typescript
/**
 * Default minimum line spacing for fit-to-page algorithm.
 * 1.0 (single spacing) allows maximum content density for aggressive fitting.
 */
export const DEFAULT_MIN_LINE_SPACING = 1.0;

export function createEmptyState(): BlockEditorState {
  return {
    // existing...
    minLineSpacing: DEFAULT_MIN_LINE_SPACING,
  };
}

// Also update createInitialState()
```

### 3. Update Reducer

**File:** `frontend/src/components/library/editor/blockEditorReducer.ts`

Add case:

```typescript
case "SET_MIN_LINE_SPACING":
  return {
    ...state,
    minLineSpacing: action.payload,
    isDirty: true,
  };
```

Add action creator:

```typescript
setMinLineSpacing: (spacing: number): BlockEditorAction => ({
  type: "SET_MIN_LINE_SPACING",
  payload: spacing,
}),
```

### 4. Update Context

**File:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

Add to `BlockEditorContextValue`:

```typescript
/** Set user-defined minimum line spacing for fit-to-page (1.0-1.15) */
setMinLineSpacing: (spacing: number) => void;
```

### 5. Update Provider

**File:** `frontend/src/components/library/editor/BlockEditorProvider.tsx`

Add callback:

```typescript
const setMinLineSpacing = useCallback((spacing: number) => {
  dispatch(blockEditorActions.setMinLineSpacing(spacing));
}, []);
```

Add to context value and dependency array.

Pass to `useAutoFitBlocks`:

```typescript
const { status: autoFitStatus, reductions: autoFitReductions } = useAutoFitBlocks({
  // existing...
  minLineSpacing: state.minLineSpacing,
});
```

### 6. Update Auto-fit Algorithm

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

Update `UseAutoFitBlocksOptions`:

```typescript
interface UseAutoFitBlocksOptions {
  // existing...
  minLineSpacing?: number;
}
```

Update `getMinimums()`:

```typescript
export function getMinimums(
  fontFamily: string,
  userMinFontSize?: number,
  userMinMargin?: number,
  userMinLineSpacing?: number  // Add this
) {
  // ...
  return {
    // existing...
    lineSpacing: userMinLineSpacing ?? SPACING_MINIMUMS.lineSpacing,
  };
}
```

Update `compactnessToStyle()` signature:

```typescript
export function compactnessToStyle(
  level: number,
  originalStyle: BlockEditorStyle,
  userMinFontSize?: number,
  userMinMargin?: number,
  userMinLineSpacing?: number  // Add this
): BlockEditorStyle
```

Pass `userMinLineSpacing` to `getMinimums()` call.

Update hook to pass `minLineSpacing` through.

### 7. Update UI

**File:** `frontend/src/components/library/editor/tabs/FormattingTab.tsx`

Add slider after the min margin slider:

```tsx
{/* Min Line Spacing Slider */}
<div className="pt-2 border-t border-border/50">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-muted-foreground">
      Minimum line spacing
    </span>
    <span className="text-xs font-medium text-foreground tabular-nums">
      {minLineSpacing.toFixed(2)}
    </span>
  </div>
  <input
    type="range"
    min={1.0}
    max={1.15}
    step={0.05}
    value={minLineSpacing}
    onChange={(e) => setMinLineSpacing(Number(e.target.value))}
    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
  />
  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
    <span>Tight</span>
    <span>Spacious</span>
  </div>
</div>
```

---

## Files to Modify

1. `frontend/src/lib/resume/types.ts` - Add minLineSpacing to state/actions
2. `frontend/src/lib/resume/defaults.ts` - Add DEFAULT_MIN_LINE_SPACING, update state creators
3. `frontend/src/components/library/editor/blockEditorReducer.ts` - Handle SET_MIN_LINE_SPACING
4. `frontend/src/components/library/editor/BlockEditorContext.tsx` - Expose setMinLineSpacing
5. `frontend/src/components/library/editor/BlockEditorProvider.tsx` - Wire state and pass to hook
6. `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` - Accept minLineSpacing param
7. `frontend/src/components/library/editor/tabs/FormattingTab.tsx` - Add slider UI

---

## Verification

1. **Manual test**:
   - Open resume editor at `/library/resumes/[id]/edit`
   - Enable "Fit to One Page"
   - Adjust "Minimum line spacing" slider
   - Verify adjustments list shows line spacing changes
   - Verify slider range works correctly (1.0 to 1.15)
2. **Tailor editor**: Verify same behavior at `/tailor/editor/[id]`
3. **Persistence**: Save resume, reload, verify minLineSpacing is preserved

---

## Design Decisions

**Q: Why 1.0 as default minimum?**
A: The current 1.05 minimum isn't aggressive enough - some resumes still can't fit on one page. Single spacing (1.0) provides maximum content density for better fitting.

**Q: Why not go below 1.0?**
A: Line spacing below 1.0 causes text lines to overlap, making content unreadable. 1.0 is the practical floor.

**Q: Slider range 1.0-1.15?**
A: This allows users to:
- Use single spacing (1.0) for aggressive fitting (default)
- Preserve some spacing (1.05-1.15) if they prefer more readability

---

## User Preferences (Confirmed)

- [x] Default minimum line spacing: **1.0** (single spacing for aggressive fitting)
- [x] Slider range: **1.0 to 1.15** with **0.05 step**
