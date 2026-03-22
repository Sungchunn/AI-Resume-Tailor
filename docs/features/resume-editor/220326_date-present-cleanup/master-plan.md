# Fix: Remove "Present" Checkbox - Complete Cleanup

## Status

In Progress - Additional files still have `current` field logic causing the bug to persist.

## Problem

The bug persists because there are additional files that still use the `current` boolean field:

- `blocksToContent.ts` still converts `current: true` to "Present"
- `diff.ts` still compares `current` fields
- Editor components still set `current: false` in default entries

## Remaining Files to Fix

### 1. blocksToContent.ts (line 59)

**File:** `frontend/src/lib/tailoring/blocksToContent.ts`

```tsx
// Before (line 59)
end_date: exp.current ? "Present" : exp.endDate || "",

// After
end_date: exp.endDate || "",
```

### 2. diff.ts - Remove current field comparisons

**File:** `frontend/src/lib/tailoring/diff.ts`

**compareExperienceEntry (line 563):**

```tsx
// Remove this line
if (orig.current !== ai.current) fields.push("current");
```

**compareVolunteerEntry (line 636):**

```tsx
// Remove this line
if (orig.current !== ai.current) fields.push("current");
```

**compareMembershipEntry (line 701):**

```tsx
// Remove this line
if (orig.current !== ai.current) fields.push("current");
```

### 3. Editor Components - Remove current from default entries

**MembershipsEditor.tsx (line 29):**

```tsx
// Remove this line from createDefaultEntry
current: false,
```

**LeadershipEditor.tsx (line 27):**

```tsx
// Remove this line from createDefaultEntry
current: false,
```

**VolunteerEditor.tsx (line 27):**

```tsx
// Remove this line from createDefaultEntry
current: false,
```

## Already Completed (Previous Session)

- `DateInput.tsx` - Simplified component
- `ExperienceEditor.tsx` - Removed Present checkbox props
- `VolunteerEditor.tsx` - Removed Present checkbox props
- `LeadershipEditor.tsx` - Removed Present checkbox props
- `MembershipsEditor.tsx` - Removed Present checkbox props
- `transforms.ts` - Removed current field logic in both directions

## Verification

1. Load a resume with experience that has `end_date: "Present"`
2. The field should show "Present" as editable text
3. Delete "Present" and type "Feb 2026" - it should save correctly
4. Type "Present" manually - it should save as "Present"
5. Verify the preview/tailoring flow also shows correct values
