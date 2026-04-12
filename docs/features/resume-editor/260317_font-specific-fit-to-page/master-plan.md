# Font-Specific Fit-to-Page Algorithm Optimization

## Problem Statement

The current fit-to-page algorithm uses hardcoded minimum values that treat all fonts identically:

```typescript
// Current MINIMUMS in useAutoFitBlocks.ts
export const MINIMUMS = {
  fontSizeBody: 7,        // Same for all fonts
  fontSizeHeading: 12,
  fontSizeSubheading: 9,
  lineSpacing: 1.05,
  sectionSpacing: 6,
  entrySpacing: 4,
} as const;
```

However, different fonts have different metrics (x-height, character widths, rendering density). For example:

- **Times New Roman** at 9pt is more readable than **Arial** at 9pt
- **Inter** and **Roboto** have different x-heights, affecting perceived size
- **Georgia** renders larger than **Lato** at the same point size

This causes:

1. Sub-optimal compression (not compressing enough for compact fonts, over-compressing for wide fonts)
2. Readability issues (some fonts become unreadable at the current 7pt minimum)
3. Inconsistent visual results across font choices

## Available Fonts

The editor supports 7 fonts:

| Font | Type | Characteristics |
| ---- | ---- | --------------- |
| Inter | Sans-serif | Modern geometric, medium x-height |
| Open Sans | Sans-serif | Humanist, large x-height |
| Times New Roman | Serif | Classic, compact rendering |
| Arial | Sans-serif | Humanist, medium x-height |
| Georgia | Serif | Screen-optimized, large x-height |
| Roboto | Sans-serif | Geometric, tall x-height |
| Lato | Sans-serif | Humanist, slightly condensed |

## Implementation Approach

### Phase 1: Define Font Profiles

Create a `FONT_PROFILES` constant with per-font compression parameters.

**File:** `frontend/src/lib/resume/defaults.ts`

```typescript
export const FONT_PROFILES = {
  "Inter": {
    minBodySize: 8,
    minHeadingSize: 12,
    minSubheadingSize: 9,
    compressionFactor: 1.0,  // Baseline
  },
  "Open Sans": {
    minBodySize: 8,
    minHeadingSize: 13,
    minSubheadingSize: 10,
    compressionFactor: 0.95,  // Slightly wider than Inter
  },
  "Times New Roman": {
    minBodySize: 9,
    minHeadingSize: 13,
    minSubheadingSize: 10,
    compressionFactor: 1.1,  // More compact serif
  },
  "Arial": {
    minBodySize: 8,
    minHeadingSize: 12,
    minSubheadingSize: 9,
    compressionFactor: 0.95,  // Similar to Open Sans
  },
  "Georgia": {
    minBodySize: 9,
    minHeadingSize: 14,
    minSubheadingSize: 11,
    compressionFactor: 0.9,  // Larger rendering
  },
  "Roboto": {
    minBodySize: 8,
    minHeadingSize: 12,
    minSubheadingSize: 9,
    compressionFactor: 1.0,  // Similar to Inter
  },
  "Lato": {
    minBodySize: 8,
    minHeadingSize: 12,
    minSubheadingSize: 9,
    compressionFactor: 1.05,  // Slightly condensed
  },
} as const;

export type FontProfileKey = keyof typeof FONT_PROFILES;

export function getFontProfile(fontFamily: string) {
  return FONT_PROFILES[fontFamily as FontProfileKey] ?? FONT_PROFILES["Inter"];
}
```

### Phase 2: Update Auto-Fit Algorithm

Modify `useAutoFitBlocks.ts` to use font-specific minimums.

**File:** `frontend/src/components/library/editor/style/useAutoFitBlocks.ts`

Changes:

1. Import `getFontProfile` from defaults
2. Change `MINIMUMS` to a function that returns font-specific values
3. Update `compactnessToStyle` to use appropriate minimums from `originalStyle.fontFamily`
4. Update `calculateReductions` similarly

```typescript
import { getFontProfile } from "@/lib/resume/defaults";

export function getMinimums(fontFamily: string) {
  const profile = getFontProfile(fontFamily);
  return {
    fontSizeBody: profile.minBodySize,
    fontSizeHeading: profile.minHeadingSize,
    fontSizeSubheading: profile.minSubheadingSize,
    lineSpacing: 1.05,      // Same for all fonts
    sectionSpacing: 6,      // Same for all fonts
    entrySpacing: 4,        // Same for all fonts
  };
}

export function compactnessToStyle(
  level: number,
  originalStyle: BlockEditorStyle
): BlockEditorStyle {
  const MINIMUMS = getMinimums(originalStyle.fontFamily);
  // ... rest uses dynamic MINIMUMS
}
```

### Phase 3: Add Arial to Font List

The `FONT_FAMILIES` array in `defaults.ts` is missing Arial.

**File:** `frontend/src/lib/resume/defaults.ts`

```typescript
export const FONT_FAMILIES = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Arial", label: "Arial" },           // Add Arial
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
] as const;
```

### Phase 4: Sync FormattingTab

**File:** `frontend/src/components/library/editor/tabs/FormattingTab.tsx`

```typescript
import { FONT_FAMILIES } from "@/lib/resume/defaults";

// Remove local fontFamilies array and use imported FONT_FAMILIES
```

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/lib/resume/defaults.ts` | Add `FONT_PROFILES`, `getFontProfile()`, add Arial to `FONT_FAMILIES` |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Change `MINIMUMS` to `getMinimums(fontFamily)`, update functions |
| `frontend/src/components/library/editor/tabs/FormattingTab.tsx` | Use imported `FONT_FAMILIES` |

## Verification

1. **Test each font:** Go to `/library/resumes/{id}/edit`, select each font, trigger fit-to-page
2. **Verify minimums respected:** Content should not compress below font-specific minimum
3. **Verify readability:** Smallest allowed font size should be readable for each font
4. **Test tailor editor:** Same behavior at `/tailor/editor/{id}`
5. **Test font switching:** Changing fonts with fit-to-page enabled should re-run algorithm
6. **Check console logs:** Development mode logs iteration count - verify convergence

## Technical Notes

- The binary search algorithm (`findOptimalCompactness`) relies on `compactnessToStyle` which will use font-specific minimums
- The legacy estimation algorithm (`runLinearAutoFit`) also uses `REDUCTION_PHASES` which references `MINIMUMS` - needs update
- Both editor pages share the same `useAutoFitBlocks` hook, so changes apply to both
