# Fix: Date "Present" Cannot Be Deleted

## Problem

When editing dates in Experience, Volunteer, Leadership, or Memberships sections:

1. "Present" reappears after being deleted
2. Typing a replacement date (e.g., "Feb 2026") doesn't work while checkbox is checked

**Affected pages:**

- `/library/resumes/[id]/edit`
- `/tailor/editor/[id]`

## Root Cause

Two interacting bugs create a loop:

### Bug 1: Transform stores "present" in endDate (transforms.ts)

```typescript
// Line 94-95: Experience
endDate: exp.end_date || "",  // Stores "Present" as a string
current: exp.end_date?.toLowerCase() === "present",  // Also sets current=true
```

When loading from backend, if `end_date === "Present"`:

- `endDate` gets set to "Present" (the string)
- `current` gets set to `true`

### Bug 2: Editors clear endDate when toggling (all 4 editors)

```typescript
// ExperienceEditor line 87-88:
onPresentChange={(isPresent) =>
  onUpdate({ current: isPresent, endDate: isPresent ? "" : entry.endDate })
}
```

When checking "Present": `endDate` is cleared to ""
When unchecking: `entry.endDate` is already "" (just cleared), so nothing changes

**Combined effect:** User unchecks "Present" -> saves empty `endDate` -> next load sees "Present" from backend -> "Present" reappears

## Solution

### Change 1: Filter "present" from endDate in transforms.ts

When converting backend data to frontend blocks, filter out "present" from `endDate`:

**Experience (line 94):**

```typescript
endDate: exp.end_date?.toLowerCase() === "present" ? "" : (exp.end_date || ""),
```

**Volunteer (line 205):**

```typescript
endDate: vol.end_date?.toLowerCase() === "present" ? "" : (vol.end_date || ""),
```

**Memberships (line 318):**

```typescript
endDate: mem.end_date?.toLowerCase() === "present" ? "" : (mem.end_date || ""),
```

### Change 2: Remove endDate clearing from editors

Update `onPresentChange` in all 4 editors to only toggle `current`:

**ExperienceEditor.tsx (line 87-88):**

```typescript
onPresentChange={(isPresent) => onUpdate({ current: isPresent })}
```

**VolunteerEditor.tsx (line 88-89):**

```typescript
onPresentChange={(isPresent) => onUpdate({ current: isPresent })}
```

**LeadershipEditor.tsx (line 88-89):**

```typescript
onPresentChange={(isPresent) => onUpdate({ current: isPresent })}
```

**MembershipsEditor.tsx (line 81-86):**

```typescript
onPresentChange={(isPresent) => onUpdate({ current: isPresent })}
```

## Files to Modify

| File | Line(s) | Change |
| ---- | ------- | ------ |
| `frontend/src/lib/resume/transforms.ts` | 94, 205, 318 | Filter "present" from endDate |
| `frontend/src/components/library/editor/blocks/ExperienceEditor.tsx` | 87-88 | Remove endDate from onPresentChange |
| `frontend/src/components/library/editor/blocks/VolunteerEditor.tsx` | 88-89 | Remove endDate from onPresentChange |
| `frontend/src/components/library/editor/blocks/LeadershipEditor.tsx` | 88-89 | Remove endDate from onPresentChange |
| `frontend/src/components/library/editor/blocks/MembershipsEditor.tsx` | 81-86 | Remove endDate from onPresentChange |

## Verification

1. Load a resume with an experience entry that has `end_date: "Present"`
2. Verify "Present" checkbox is checked and input shows "Present"
3. Uncheck the "Present" checkbox - input should become editable and empty
4. Enter a date like "Feb 2026"
5. Save the resume
6. Reload the page - verify "Feb 2026" persists (not "Present")
7. Check the "Present" checkbox again
8. Uncheck it - verify the date field shows the preserved value or is empty (not "Present")
9. Repeat for Volunteer, Leadership, and Memberships sections
