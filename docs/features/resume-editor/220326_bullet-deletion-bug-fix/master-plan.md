# Bullet Point Deletion Bug Fix

## Problem Statement

When editing bullet points in the resume editor pages:

- `/library/resumes/[id]/edit`
- `/tailor/editor/[id]`

Creating new bullet points with Enter works correctly, but deleting empty bullet points with Backspace deletes the wrong line (the line below instead of the current line).

## Root Cause Analysis

The bug is in `/frontend/src/components/library/editor/blocks/shared/BulletList.tsx`.

### Primary Issue: Using `key={index}` (line 101)

```tsx
{bullets.map((bullet, index) => (
  <div key={index} className="flex items-start gap-2 group">
```

Using array indices as React keys is a known anti-pattern when:

1. Items can be added/removed from the middle of the list
2. The component maintains internal state or refs

When Enter is pressed to create a new bullet:

1. New bullet is spliced at `index + 1`
2. React re-renders with index-based keys
3. React cannot properly track which DOM element corresponds to which data item
4. The `inputRefs` array becomes misaligned with the actual bullets

### Secondary Issue: Ref Array Synchronization

The `inputRefs` array stores refs by index:

```tsx
ref={(el) => {
  inputRefs.current[index] = el;
}}
```

When bullets are added/removed:

- Old refs may still exist at outdated indices
- The refs array length does not automatically shrink when bullets are deleted

## Solution

### Step 1: Generate Unique IDs for Each Bullet

Since bullets are currently plain strings, we need a way to track them uniquely. Use a stable ID by creating a ref-based map that assigns IDs to bullets.

The approach: use `nanoid` to generate a stable key for each bullet position, and update the key mapping when bullets are added or removed.

### Step 2: Clean Up Refs Array

Ensure the `inputRefs` array is synchronized with the current bullets array length on each render.

## Implementation

### File: `frontend/src/components/library/editor/blocks/shared/BulletList.tsx`

**Changes:**

1. Add a ref to track stable keys for each bullet:

```tsx
const bulletKeysRef = useRef<string[]>([]);
```

2. Synchronize keys with bullets array on changes:

```tsx
// Keep bullet keys in sync with bullets array
useEffect(() => {
  const currentKeys = bulletKeysRef.current;
  const newKeys: string[] = [];

  for (let i = 0; i < bullets.length; i++) {
    // Reuse existing key or generate new one
    newKeys[i] = currentKeys[i] ?? nanoid();
  }

  bulletKeysRef.current = newKeys;
}, [bullets.length]);
```

3. Update key arrays when adding/removing bullets in handlers:

- On Enter (add): insert new key at `index + 1`
- On Backspace (remove): splice out the key at `index`

4. Trim inputRefs array to match bullets length:

```tsx
useEffect(() => {
  inputRefs.current = inputRefs.current.slice(0, bullets.length);
}, [bullets.length]);
```

5. Use stable keys in render:

```tsx
{bullets.map((bullet, index) => (
  <div key={bulletKeysRef.current[index] ?? index} className="...">
```

## Verification

### Manual Testing

1. Navigate to `/library/resumes/[id]/edit`
2. Click on Experience section
3. Add a new bullet with Enter
4. Delete the new (empty) bullet with Backspace
5. Verify the correct bullet is deleted
6. Repeat for `/tailor/editor/[id]`

### Test Scenarios

| Scenario | Expected Behavior |
| -------- | ----------------- |
| Create bullet at end, delete | Current bullet deleted |
| Create bullet in middle, delete | Current bullet deleted |
| Create multiple bullets, delete from various positions | Correct bullet deleted each time |
| Type content, navigate with arrows, delete empty | Correct bullet deleted |
| Focus moves to previous bullet after delete | Focus behavior correct |

### E2E Tests

Consider adding test coverage in `frontend/e2e/inline-editing/bullets.spec.ts`:

- Test Enter creates bullet at correct position
- Test Backspace deletes correct bullet
- Test focus management after operations

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/components/library/editor/blocks/shared/BulletList.tsx` | Add stable key tracking, fix ref synchronization |

## Related Components

The `BulletList` component is used by:

- `ExperienceEditor` - max 8 bullets
- `ProjectsEditor` - max 5 bullets
- `LeadershipEditor` - max 5 bullets
- `VolunteerEditor` - max 5 bullets
- `CustomSectionEditor` - max 10 bullets

All will benefit from this fix without additional changes.
