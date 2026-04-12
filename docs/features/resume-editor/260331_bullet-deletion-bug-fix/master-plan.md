# Fix Bullet Point Deletion Bug in Editor

## Problem

When deleting a bullet point in the resume editor (both `/library/resumes/[id]/edit` and `/tailor/editor/[id]`), the **wrong bullet gets deleted** - specifically the bullet below the targeted one appears to be removed. Additionally, Cmd+Z does not undo the deletion correctly.

## Root Cause

The preview components render bullet points using **array indices as React keys**:

```tsx
// ExperiencePreview.tsx:265
{entry.bullets.map((bullet, bulletIndex) => (
  <li key={bulletIndex}>  // <-- BUG: Using index as key
```

When a bullet in the middle is deleted:

1. Before: bullets ["A", "B", "C"] with keys [0, 1, 2]
2. Delete bullet at index 1 ("B")
3. After: bullets ["A", "C"] with keys [0, 1]
4. React sees: key 0 -> "A" (same), key 1 -> "C" (was "B"), key 2 -> missing
5. React removes the DOM element for key 2 (visually the last bullet)
6. The user sees "C" disappear instead of "B"

## Affected Files

All preview components with indexed bullet/course lists:

| File | Line | Issue |
| ----- | ----- | ----- |
| `frontend/src/components/library/preview/blocks/ExperiencePreview.tsx` | 265 | `key={bulletIndex}` |
| `frontend/src/components/library/preview/blocks/ProjectsPreview.tsx` | 330 | `key={bulletIndex}` |
| `frontend/src/components/library/preview/blocks/VolunteerPreview.tsx` | 295 | `key={bulletIndex}` |
| `frontend/src/components/library/preview/blocks/LeadershipPreview.tsx` | 295 | `key={bulletIndex}` |
| `frontend/src/components/library/preview/blocks/EducationPreview.tsx` | 295 | `key={courseIndex}` |

## Solution

Generate **stable IDs** at render time using a ref-based pattern (like `BulletList.tsx`).

### Implementation Pattern

Create a shared hook `useBulletIds` that manages stable IDs for indexed arrays:

```typescript
// frontend/src/components/library/preview/hooks/useBulletIds.ts
import { useRef } from "react";
import { nanoid } from "nanoid";

/**
 * Generate stable IDs for bullet arrays to use as React keys.
 * IDs persist across renders and sync with array length changes.
 */
export function useBulletIds(
  entries: { id: string; bullets?: string[]; relevantCourses?: string[] }[],
  field: "bullets" | "relevantCourses" = "bullets"
): Map<string, string[]> {
  const idsRef = useRef<Map<string, string[]>>(new Map());

  // Sync IDs with current entries
  entries.forEach((entry) => {
    const items = field === "bullets" ? entry.bullets : entry.relevantCourses;
    const count = items?.length ?? 0;

    let ids = idsRef.current.get(entry.id);
    if (!ids) {
      ids = [];
      idsRef.current.set(entry.id, ids);
    }

    // Add IDs for new items
    while (ids.length < count) {
      ids.push(nanoid());
    }
    // Trim IDs for removed items
    if (ids.length > count) {
      ids.length = count;
    }
  });

  return idsRef.current;
}
```

### Changes Per File

**1. ExperiencePreview.tsx:**

```tsx
// Add import
import { useBulletIds } from "../hooks/useBulletIds";

// In ExperiencePreview component:
const bulletIds = useBulletIds(content);

// Pass to entry component
<ExperienceEntryPreview
  ...
  bulletIds={bulletIds.get(entry.id) || []}
/>

// In ExperienceEntryPreview, change:
- key={bulletIndex}
+ key={bulletIds[bulletIndex]}
```

**2. ProjectsPreview.tsx** - Same pattern

**3. VolunteerPreview.tsx** - Same pattern

**4. LeadershipPreview.tsx** - Same pattern

**5. EducationPreview.tsx** - Use `useBulletIds(content, "relevantCourses")`

## Undo Behavior

The undo issue is partially separate. The block-level undo system uses a debounced history push (500ms). When:

1. User deletes a bullet -> state updates immediately
2. History push is scheduled for 500ms later
3. If user presses Cmd+Z before 500ms, no history entry exists

This is expected behavior per the current design. The fix for the React key issue will make the visual behavior correct, and undo will work for deletions that have been captured in history (after the debounce).

## Verification

**Manual Testing:**

1. Navigate to `/library/resumes/[id]/edit`
2. Add 3 bullet points with distinct text: "AAA", "BBB", "CCC"
3. Delete the middle bullet ("BBB")
4. Verify "BBB" disappears (not "CCC")
5. Press Cmd+Z after 500ms to verify undo works

**Test all affected sections:**

- Experience bullets
- Project bullets
- Volunteer bullets
- Leadership bullets
- Education relevant courses

**Test on both editor routes:**

- `/library/resumes/[id]/edit`
- `/tailor/editor/[id]`

## Files to Create

- `frontend/src/components/library/preview/hooks/useBulletIds.ts` (new)
- `frontend/src/components/library/preview/hooks/index.ts` (new)

## Files to Modify

- `frontend/src/components/library/preview/blocks/ExperiencePreview.tsx`
- `frontend/src/components/library/preview/blocks/ProjectsPreview.tsx`
- `frontend/src/components/library/preview/blocks/VolunteerPreview.tsx`
- `frontend/src/components/library/preview/blocks/LeadershipPreview.tsx`
- `frontend/src/components/library/preview/blocks/EducationPreview.tsx`
