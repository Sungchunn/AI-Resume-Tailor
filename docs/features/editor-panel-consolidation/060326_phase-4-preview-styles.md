# Phase 4: Preview Styles Update

**Parent:** [Master Plan](./060326_master-plan.md)

## Objective

Update preview style computation to use `entry_spacing` value.

## Tasks

### 4.1 Update previewStyles.ts

**File:** `/frontend/src/components/workshop/ResumePreview/previewStyles.ts`

Add `entryGap` to the computed styles interface and implementation:

```typescript
// Add to ComputedPreviewStyle interface (or equivalent)
export interface ComputedPreviewStyle {
  // ... existing properties ...
  entryGap: string;  // ADD THIS
}

// Update computePreviewStyles function
export function computePreviewStyles(style: ResumeStyle): ComputedPreviewStyle {
  return {
    // ... existing computed values ...
    entryGap: `${style.entry_spacing ?? 8}px`,
  };
}
```

### 4.2 Apply entryGap in Preview Components

If there are list/entry components in the preview that render experience items, skills, etc., apply the `entryGap` style:

```tsx
// Example usage in a section component
<ul style={{ gap: computedStyles.entryGap }}>
  {entries.map(entry => (
    <li key={entry.id} style={{ marginBottom: computedStyles.entryGap }}>
      {/* entry content */}
    </li>
  ))}
</ul>
```

### 4.3 Update Auto-Fit Algorithm (if needed)

**File:** `/frontend/src/components/workshop/panels/style/useAutoFit.ts`

Verify that the auto-fit algorithm already handles `entry_spacing` in its reduction sequence. Based on exploration, it does use `entry_spacing` internally. Confirm this is working:

```typescript
// The auto-fit should include entry_spacing in REDUCTION_ORDER
const REDUCTION_ORDER = [
  { key: "font_size_body", min: 8, step: 0.5 },
  { key: "entry_spacing", min: 4, step: 1 },      // Should exist
  { key: "section_spacing", min: 8, step: 1 },
  { key: "line_spacing", min: 1.1, step: 0.05 },
];
```

## Verification

- [ ] Entry spacing value from style is used in preview rendering
- [ ] Changing entry spacing slider updates preview immediately
- [ ] Auto-fit includes entry_spacing in its reduction sequence
- [ ] Experience/skill entries have appropriate spacing based on setting
- [ ] PDF export respects entry_spacing value
