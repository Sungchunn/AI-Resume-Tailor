# Phase 6: Undo Verification

**Goal:** Verify that accepted suggestions are properly undoable via TipTap's history.

## Background

TipTap's StarterKit includes the History extension which provides undo/redo functionality. The `acceptSuggestion` command in `suggestionExtension.ts` already uses ProseMirror transactions (`tr.replaceWith()`), which are automatically tracked by the History extension.

## No Code Changes Required

The existing implementation should already support undo. This phase is verification-only.

## Verification Steps

### 1. Basic Undo After Accept

```typescript
// Test sequence:
1. Apply a suggestion mark to text "original text"
2. Click Accept in popover
3. Verify text changes to "suggested text"
4. Press Cmd+Z
5. Verify text returns to "original text" AND suggestion mark is restored
```

### 2. Undo Multiple Accepts

```typescript
// Test sequence:
1. Apply 3 suggestion marks
2. Accept suggestion 1 → text changes
3. Accept suggestion 2 → text changes
4. Accept suggestion 3 → text changes
5. Press Cmd+Z → suggestion 3 undone
6. Press Cmd+Z → suggestion 2 undone
7. Press Cmd+Z → suggestion 1 undone
8. Verify all original text + marks restored
```

### 3. Redo After Undo

```typescript
// Test sequence:
1. Apply suggestion mark
2. Accept suggestion
3. Cmd+Z → undo
4. Cmd+Shift+Z → redo
5. Verify suggested text is restored (mark removed)
```

### 4. Undo Toggle Diff Mode

```typescript
// Test sequence:
1. Apply suggestion mark
2. Toggle diff mode (show inline diff)
3. Cmd+Z → verify diff mode is undone
4. Verify highlight-only mode restored
```

### 5. Mixed Operations Undo

```typescript
// Test sequence:
1. Apply suggestion mark
2. Type some text elsewhere
3. Accept suggestion
4. Type more text
5. Cmd+Z → undo last typing
6. Cmd+Z → undo accept (suggestion mark restored)
7. Cmd+Z → undo first typing
```

## Expected Behavior Matrix

| Action | Undo Result | Redo Result |
| ------ | ----------- | ----------- |
| Accept suggestion | Restore original text + mark | Remove mark, show suggested text |
| Reject suggestion | Restore suggestion mark | Remove mark |
| Toggle diff mode | Toggle back | Toggle forward |
| Clear all suggestions | Restore all marks | Clear all marks |

## Potential Issues to Check

### Issue 1: Mark Restoration on Undo

After undo, the suggestion mark should be fully restored with all attributes:

- `id` - Same as before accept
- `original` - Original text
- `suggested` - Suggested text
- `reason` - Reason for suggestion
- `impact` - Impact level
- `showDiff` - Diff mode state

If any attributes are lost, the `acceptSuggestion` command may need adjustment to preserve them.

### Issue 2: Cursor Position

After undo, the cursor should return to a sensible position (ideally at the start or end of the restored text).

### Issue 3: History Depth

TipTap's History extension has a default depth of 100. Verify this is sufficient:

```typescript
StarterKit.configure({
  history: {
    depth: 100,  // Default
    newGroupDelay: 500,  // Group rapid changes
  },
})
```

## Debugging Commands

If undo doesn't work as expected, check:

```typescript
// Inspect history state
console.log(editor.can().undo());  // Should be true after accept
console.log(editor.can().redo());  // Should be true after undo

// Check transaction
editor.on("transaction", ({ transaction }) => {
  console.log("Transaction:", {
    docChanged: transaction.docChanged,
    steps: transaction.steps.length,
    selectionSet: transaction.selectionSet,
  });
});
```

## Manual Test Checklist

- [ ] Accept single suggestion → Cmd+Z restores original + mark
- [ ] Accept multiple suggestions → each Cmd+Z restores in reverse order
- [ ] Redo works after undo
- [ ] Reject → Cmd+Z restores mark
- [ ] Toggle diff → Cmd+Z toggles back
- [ ] Clear all → Cmd+Z restores all marks
- [ ] Mixed edits + accepts → correct undo order
- [ ] Toolbar undo button reflects availability
- [ ] Keyboard shortcuts work (Cmd+Z, Cmd+Shift+Z)

## Success Criteria

All verification steps pass. No code changes should be needed if the existing transaction-based implementation is correct.

If issues are found, document them and create a fix in `suggestionExtension.ts` to ensure proper transaction structure for undo support.
