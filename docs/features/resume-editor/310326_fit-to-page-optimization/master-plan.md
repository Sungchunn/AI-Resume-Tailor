# Fit-to-One-Page Algorithm Optimization

## Problem Statement

The fit-to-one-page algorithm at `/library/resumes/[id]/edit` fails to actually fit content on one page. User has minimum font size, margin, and line spacing controls, but the algorithm isn't optimizing effectively.

## Root Cause Analysis

### Critical Issue: Measurement Step Function

**Location:** `EditorLayout.tsx:100-106` and `useAutoFitBlocks.ts:633-635`

The measureFn returns `pageCount * PAGE_HEIGHT`:

- 1 page = 1056px
- 2 pages = 2112px

This creates a **step function** that binary search cannot effectively optimize against. When content overflows by just 1px, the measurement jumps from 1056 to 2112 - a 1056px discontinuity.

The binary search targets `PAGE_HEIGHT` (1056px), but pagination uses `calculateContentHeight()` which subtracts margins. With 0.5" margins = 96px subtracted, actual usable content area is ~960px.

**Result:** Algorithm sees "1056px" and thinks content fits, but pagination places it on 2 pages because usable area is only 960px.

### Secondary Issue: Permanent minimum_reached Flag

**Location:** `useAutoFitBlocks.ts:622-626`

```typescript
useEffect(() => {
  minimumReachedRef.current = false;
}, [blocksHash]);  // Missing: minFontSize, minMargin, minLineSpacing
```

Once `minimum_reached` is triggered, the flag only resets when blocks change - NOT when user adjusts minimum settings via the UI. Users cannot recover by adjusting minimums.

---

## Implementation Plan

### Phase 1: Fix Measurement Target (Critical)

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

**Change:** Instead of targeting raw `PAGE_HEIGHT`, use a "fits predicate" approach that directly checks page count.

Modify `findOptimalCompactness()` to use a fits-based check:

```typescript
// Current: height comparison with step function
if (height <= targetHeight) { ... }

// New: direct page count check
const fitsOnOnePage = async (testStyle: BlockEditorStyle): Promise<boolean> => {
  onStyleChange(testStyle);
  await measureWithRAF(() => {});
  const pageCount = previewRef.current.getPageCount();
  return pageCount <= 1;
};
```

This eliminates the step function problem by directly measuring what we care about.

**Alternative approach (simpler):** Modify `getTargetHeight()` to use maximum content height:

```typescript
const getTargetHeight = useCallback(() => {
  const minMargins = minMargin ?? DEFAULT_MIN_MARGIN;
  // Maximum content height when margins are at minimum
  return PAGE_HEIGHT - (2 * minMargins * 96);
}, [minMargin]);
```

### Phase 2: Fix minimum_reached Reset

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

**Change:** Add minimum settings to reset dependency array.

```typescript
// Line 622-626: Add dependencies
useEffect(() => {
  minimumReachedRef.current = false;
}, [blocksHash, minFontSize, minMargin, minLineSpacing]);
```

Also reset when `enabled` transitions from false to true:

```typescript
// Line 639-645: Reset flag when enabled changes
if (!enabled) {
  minimumReachedRef.current = false;  // Already exists
  ...
}
```

### Phase 3: Enhance Compaction Options (Optional)

**Files to modify:**

- `frontend/src/lib/resume/types.ts` - Add new style properties
- `frontend/src/lib/resume/defaults.ts` - Add defaults
- `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` - Add phases

**New CSS properties to consider:**

| Property | Range | Visual Impact | Space Savings |
| -------- | ----- | ------------- | ------------- |
| `letterSpacing` | 0 to -0.02em | Subtle | ~3% horizontal |
| `paragraphSpacing` | 4px to 0 | Low | ~20px total |
| `bulletIndent` | Current to reduced | Low | ~10px/line |

**Recommendation:** Defer this phase. The critical fix (Phase 1) should resolve the core issue.

### Phase 4: Reorder Compaction Phases (Optional)

Current order: margins -> sectionSpacing -> entrySpacing -> lineSpacing -> fontSizeBody

This order is reasonable ("least visual impact first"), but could be reweighted by actual space savings:

| Phase | Current Weight | Actual Space Savings |
| ----- | -------------- | -------------------- |
| Margins | 20 levels | ~58px (4 sides x 0.15" x 96dpi) |
| Section spacing | 20 levels | ~30px (6px x 5 sections) |
| Entry spacing | 20 levels | ~40px (4px x 10 entries) |
| Line spacing | 20 levels | ~100px (0.1 x 10pt x 100 lines) |
| Font size | 20 levels | ~150px (biggest impact) |

**Recommendation:** Keep current order. The visual impact ordering is more user-friendly than optimizing for raw space savings.

---

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Fix target height calculation, fix minimumReachedRef reset |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Potentially modify measureFn to expose page count directly |

---

## Verification Plan

### Manual Testing

1. **Basic fit test:**
   - Load a resume with ~1.2 pages of content
   - Enable fit-to-page
   - Verify content fits on exactly 1 page in preview
   - Verify PDF export shows 1 page

2. **Minimum recovery test:**
   - Load content that exceeds 1 page even at minimums
   - See "minimum_reached" warning
   - Adjust minimum font size slider lower
   - Verify algorithm re-runs and attempts to fit

3. **Edge case test:**
   - Content that exactly fits with default styles -> should not adjust
   - Content 1px over -> should find minimal adjustment
   - Massive content -> should reach minimum_reached gracefully

### E2E Tests

Update tests in `frontend/e2e/fit-to-page/`:

- `convergence.spec.ts` - Verify content actually fits on 1 page
- Add test for minimum slider reset behavior

---

## Estimated Impact

- **Phase 1:** Fixes core failure case - content will actually fit on one page
- **Phase 2:** Improves UX - users can adjust minimums to recover from stuck state
- **Phase 3-4:** Marginal improvements - defer unless Phase 1-2 don't fully resolve issue
