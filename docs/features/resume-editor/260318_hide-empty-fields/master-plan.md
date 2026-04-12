# Hide Empty Optional Fields in Resume Editor

> **Scope:** Simple fix, no phases needed. 3 files, ~30 lines total.
>
> **Relation to other plans:** Independent of `260317_true-inline-editing` (which replaced the overlay popup system). This plan is about conditional field visibility.

## Problem Summary

Three issues with optional field rendering in both `/library/resumes/[id]/edit` and `/tailor/editor/[id]`:

1. **Education Section**: GPA and Honors labels always shown even when empty
2. **Projects Section**: "Technologies:" label always shown even when empty
3. **Contact Section**: Globe/link icons shown even when no URL exists

## Root Cause

Edit mode renders optional fields unconditionally, while read-only mode correctly hides them. The fix is to match read-only behavior in edit mode.

---

## Files to Modify

### 1. ContactPreview.tsx

**Path:** `/frontend/src/components/library/preview/blocks/ContactPreview.tsx`

**Change:** Update `shouldShowField` function (line 41)

```tsx
// Before (line 41):
const shouldShowField = (value: string | undefined) => value !== undefined;

// After:
const shouldShowField = (value: string | undefined): boolean => {
  return Boolean(value?.trim());
};
```

This ensures icons (globe, phone, linkedin, github) only show when the field has actual content.

---

### 2. EducationPreview.tsx

**Path:** `/frontend/src/components/library/preview/blocks/EducationPreview.tsx`

**Change:** Wrap GPA/Honors row with conditional check (lines 248-273)

```tsx
// Before (lines 248-273): GPA/Honors always rendered

// After: Match read-only behavior (lines 180-189)
{(entry.gpa?.trim() || entry.honors?.trim()) && (
  <div
    className="flex flex-wrap gap-x-2 mt-0.5"
    style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
  >
    {entry.gpa?.trim() && (
      <span className="flex items-center gap-1 text-muted-foreground">
        <span>GPA:</span>
        <InlinePlainText
          elementId={createFieldElementId(blockId, entry.id, "gpa")}
          value={entry.gpa || ""}
          className="text-muted-foreground"
          placeholder="3.9"
          onCommit={handleFieldChange("gpa")}
        />
      </span>
    )}
    {entry.gpa?.trim() && entry.honors?.trim() && (
      <span className="text-muted-foreground">|</span>
    )}
    {entry.honors?.trim() && (
      <InlinePlainText
        elementId={createFieldElementId(blockId, entry.id, "honors")}
        value={entry.honors || ""}
        className="text-muted-foreground"
        placeholder="Honors (e.g., Magna Cum Laude)"
        onCommit={handleFieldChange("honors")}
      />
    )}
  </div>
)}
```

---

### 3. ProjectsPreview.tsx

**Path:** `/frontend/src/components/library/preview/blocks/ProjectsPreview.tsx`

**Change:** Wrap Technologies section with conditional check (lines 289-319)

```tsx
// Before (lines 289-319): Technologies always rendered

// After: Match read-only behavior (lines 204-211)
{entry.technologies && entry.technologies.length > 0 &&
 entry.technologies.some(t => t.trim()) && (
  <div
    className="text-muted-foreground mt-1"
    style={{ fontSize: `calc(${style.bodyFontSize} - 1pt)` }}
  >
    <span className="font-medium">Technologies: </span>
    <InlinePlainText
      elementId={createFieldElementId(blockId, entry.id, "technologies")}
      value={entry.technologies?.join(", ") || ""}
      placeholder="React, TypeScript, ..."
      onCommit={(value) => {
        const technologies = value
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (!blockId || !editorContext) return;
        const block = editorContext.state.blocks.find((b) => b.id === blockId);
        if (!block || block.type !== "projects") return;
        const entries = block.content as ProjectEntry[];
        const newEntries = entries.map((e) =>
          e.id === entry.id ? { ...e, technologies } : e
        );
        editorContext.dispatch({
          type: "UPDATE_BLOCK",
          payload: { id: blockId, content: newEntries },
        });
      }}
    />
  </div>
)}
```

---

## Adding Fields Back

**Approach: Panel Editor Only**

- Users click the section edit button to open the panel editor (EducationEditor, ProjectsEditor, ContactEditor)
- Panel editors have all fields visible with placeholders
- This matches existing patterns, no new components needed

---

## Verification

1. **Manual Testing:**
   - Create/edit resume with empty GPA - should not show "GPA:" label
   - Create/edit project with no technologies - should not show "Technologies:" label
   - Create/edit contact with no website - should not show globe icon
   - Verify panel editors still work to add these fields

2. **Existing E2E Tests:**
   - Run `bun run test:e2e e2e/inline-editing/` to ensure no regressions

3. **Both Editors:**
   - Test on `/library/resumes/[id]/edit`
   - Test on `/tailor/editor/[id]`