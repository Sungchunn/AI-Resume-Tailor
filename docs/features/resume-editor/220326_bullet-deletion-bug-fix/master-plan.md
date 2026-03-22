# Plan: Fix Bullet Point Deletion Bug

## Problem Statement

When pressing Backspace on an empty bullet, **the bullet BELOW it is deleted** instead of the empty bullet itself. This happens across all editors that use BulletList (Experience, Projects, Volunteer, etc.).

## Root Cause Analysis

The initial fix (commit `10bcfcf`) added stable IDs but introduced a subtle index desync issue. Here's why:

### The Bug Mechanism

1. **State is managed by parent** - `bullets` array comes from props
2. **IDs are managed locally** - `bulletIds` ref is synced during render
3. **Index comes from render** - `handleKeyDown(e, index)` captures render-time index

The problem: When the user types to clear a bullet, `updateBullet` triggers a state update. But the `index` captured in the onKeyDown handler is from the **previous render**. If bullets have shifted, the index no longer points to the correct bullet.

### Specific Scenario

```text
State: bullets = ["A", "B", "C"]
User clears "B" → updateBullet(1, "") → state updates to ["A", "", "C"]
React re-renders BUT the onKeyDown={(e) => handleKeyDown(e, index)}
   may still reference old index mapping from previous render cycle
User presses Backspace on visually-empty bullet
handleKeyDown fires with potentially wrong index
removeBullet removes wrong bullet
```

### Why the Previous Fix Was Insufficient

The nanoid fix stabilized React keys but didn't address the fundamental issue: **the index parameter passed to handleKeyDown can become stale between state updates**.

## Solution

**Use bullet ID instead of array index to identify which bullet to delete.**

Change the approach from index-based to ID-based operations:

1. Pass `bulletId` to handlers instead of `index`
2. Find the current index by searching for the ID in `bulletIds.current`
3. This ensures we always operate on the correct bullet regardless of render timing

### Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/components/library/editor/blocks/shared/BulletList.tsx` | Refactor handlers to use ID-based lookup |

### Implementation Details

```tsx
// BEFORE: Index-based (buggy)
onKeyDown={(e) => handleKeyDown(e, index)}
// ...
removeBullet(index);

// AFTER: ID-based (correct)
onKeyDown={(e) => handleKeyDown(e, bulletId)}
// ...
const currentIndex = bulletIds.current.indexOf(bulletId);
if (currentIndex !== -1) {
  removeBullet(currentIndex);
}
```

### Changes Required

1. **handleKeyDown signature**: Change from `(e, index)` to `(e, bulletId)`
2. **All handlers**: Look up current index from bulletId when needed
3. **removeBullet, updateBullet, addBullet**: Take bulletId, look up index internally
4. **Focus logic**: Already uses IDs, no change needed

## Verification

1. **Manual testing:**
   - Add 3 bullets: "A", "B", "C"
   - Clear middle bullet to empty
   - Press Backspace on empty bullet
   - Verify: ["A", "C"] remains, empty bullet is deleted

2. **Edge cases to test:**
   - Delete first bullet (index 0)
   - Delete last bullet
   - Rapid add/delete operations
   - Enter to add bullet, then immediately Backspace

3. **Affected editors to test:**
   - Experience
   - Projects
   - Volunteer
   - Leadership
