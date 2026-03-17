# Phase 2: Update Preview Components

## Overview

Replace usage of old `EditableText`/`EditableRichText`/`EditableBullet` with new inline components.

---

## Step 2.1: Update `SkillsPreview.tsx`

**File**: `/frontend/src/components/library/preview/blocks/SkillsPreview.tsx`

**Current behavior**: Creates separate `EditableText` for each skill → individual popups

**Target behavior**: Single `InlineSkillsList` for entire skills section

### Changes

```diff
- import { EditableText } from "../../editor/inline";
+ import { InlineSkillsList } from "../../editor/inline";

  // Remove individual skill update function
- const updateSkill = useCallback(...);

  // Replace the skills mapping with single component
  return (
    <ul className="list-none p-0 m-0" style={{ fontSize: style.bodyFontSize }}>
-     {filteredSkills.map((skill, idx) => {
-       const isLast = idx === filteredSkills.length - 1;
-       const elementId = createIndexedElementId(blockId, undefined, "skills", idx);
-       return (
-         <li key={idx} className="inline">
-           <EditableText
-             elementId={elementId}
-             value={skill}
-             placeholder="Skill"
-             onCommit={(value) => updateSkill(idx, value)}
-           />
-           {!isLast && ", "}
-         </li>
-       );
-     })}
+     <li className="inline">
+       <InlineSkillsList
+         skills={content}
+         blockId={blockId}
+         onCommit={(newSkills) => {
+           editorContext?.dispatch({
+             type: "UPDATE_BLOCK",
+             payload: { id: blockId, content: newSkills },
+           });
+         }}
+       />
+     </li>
    </ul>
  );
```

---

## Step 2.2: Update `ExperiencePreview.tsx`

**File**: `/frontend/src/components/library/preview/blocks/ExperiencePreview.tsx`

### Changes

Replace imports:

```diff
- import { EditableText, EditableRichText, EditableBullet } from "../../editor/inline";
+ import { InlinePlainText, InlineRichText } from "../../editor/inline";
```

Replace field usage:

| Field | Old Component | New Component |
| ----- | ----- | ----- |
| Job title | `EditableText` | `InlinePlainText` |
| Company | `EditableText` | `InlinePlainText` |
| Location | `EditableText` | `InlinePlainText` |
| Date range | `EditableText` | `InlinePlainText` |
| Bullets | `EditableBullet` | `InlineRichText` with `onEnter`/`onBackspaceEmpty` |

Example for bullets:

```tsx
{entry.bullets.map((bullet, bulletIdx) => (
  <li key={bulletIdx}>
    <InlineRichText
      elementId={createIndexedElementId(blockId, entry.id, "bullets", bulletIdx)}
      value={bullet}
      onCommit={(value) => updateBullet(entryIdx, bulletIdx, value)}
      onEnter={() => addBullet(entryIdx, bulletIdx)}
      onBackspaceEmpty={() => removeBullet(entryIdx, bulletIdx)}
    />
  </li>
))}
```

---

## Step 2.3: Update `EducationPreview.tsx`

**File**: `/frontend/src/components/library/preview/blocks/EducationPreview.tsx`

Same pattern as ExperiencePreview:

- Replace `EditableText` → `InlinePlainText` for school, degree, location, dates
- Replace `EditableBullet` → `InlineRichText` for achievements/bullets

---

## Step 2.4: Update `SummaryPreview.tsx`

**File**: `/frontend/src/components/library/preview/blocks/SummaryPreview.tsx`

```diff
- import { EditableRichText } from "../../editor/inline";
+ import { InlineRichText } from "../../editor/inline";

  return (
-   <EditableRichText
+   <InlineRichText
      elementId={elementId}
      value={content}
      onCommit={handleCommit}
      showToolbar
    />
  );
```

---

## Step 2.5: Update Other Preview Components

Check and update any other preview components using old inline editors:

- `ProjectsPreview.tsx`
- `CertificationsPreview.tsx`
- `ContactPreview.tsx`
- `HeaderPreview.tsx`

---

## Completion Criteria

- [ ] `SkillsPreview.tsx` uses `InlineSkillsList`
- [ ] `ExperiencePreview.tsx` uses new inline components
- [ ] `EducationPreview.tsx` uses new inline components
- [ ] `SummaryPreview.tsx` uses `InlineRichText`
- [ ] All other preview components updated
- [ ] No import errors or type errors
- [ ] Manual test: edit fields in preview, verify changes save
