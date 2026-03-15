# Improve Fit-to-Page Compactness

## Goal

Make content fit better on one page by:
1. Rendering skills section more compactly (comma-separated inline text)
2. Lowering minimum font size from 8pt to 7pt

---

## Changes

### Change 1: Compact Skills Rendering

**File:** `frontend/src/components/library/preview/blocks/SkillsPreview.tsx`

**Current:** Pipe-separated flexbox with gaps
```tsx
<div className="flex flex-wrap gap-x-2 gap-y-1">
  {skills.map((skill, idx) => (
    <span key={idx}>
      {skill}
      {idx < skills.length - 1 && <span className="ml-2">|</span>}
    </span>
  ))}
</div>
```

**New:** Comma-separated inline text (more space-efficient)
```tsx
<p style={{ fontSize: style.bodyFontSize }}>
  {filteredSkills.join(", ")}
</p>
```

This eliminates:
- Gap spacing between wrapped lines (`gap-y-1`)
- Extra space for pipe separators (`ml-2`)
- Flexbox overhead

---

### Change 2: Lower Minimum Font Size (8pt → 7pt)

Two files need updating:

| File | Line | Current | New |
| ---- | ---- | ------- | --- |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | 49 | `fontSizeBody: 8` | `fontSizeBody: 7` |
| `frontend/src/components/library/preview/previewStyles.ts` | 26 | `bodyFontSize: 8` | `bodyFontSize: 7` |

**Note:** Workshop auto-fit (`/workshop/panels/style/useAutoFit.ts`) uses `font_size_body: 10` - leaving this unchanged as it's a different UI context.

---

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/components/library/preview/blocks/SkillsPreview.tsx` | Replace flexbox pipe-layout with comma-separated text |
| `frontend/src/components/library/editor/style/useAutoFitBlocks.ts` | Change `fontSizeBody: 8` to `fontSizeBody: 7` |
| `frontend/src/components/library/preview/previewStyles.ts` | Change `bodyFontSize: 8` to `bodyFontSize: 7` |

---

## Verification

1. **Manual Test - Dense Resume:**
   - Open a resume that previously showed "minimum_reached"
   - Verify the skills section now renders as comma-separated text
   - Check if content now fits on one page (or gets closer)

2. **Visual Check:**
   - Skills should appear as: `Python, JavaScript, React, Node.js, AWS`
   - Font at maximum compactness should be 7pt (still readable)

3. **Build Check:**
   - Run `bun run build` to ensure no type errors
