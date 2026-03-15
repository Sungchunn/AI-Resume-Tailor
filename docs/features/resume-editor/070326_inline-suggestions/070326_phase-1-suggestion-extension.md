# Phase 1: SuggestionExtension Diff Mode

**Goal:** Allow toggling between highlight-only mode and inline diff mode in the document.

## File to Modify

- `frontend/src/lib/editor/suggestionExtension.ts`

## Current State

The extension already has:

- Mark attributes: `id`, `type`, `original`, `suggested`, `reason`, `impact`, `section`
- Commands: `setSuggestion`, `acceptSuggestion`, `removeSuggestionById`, `clearAllSuggestions`
- Click handling via ProseMirror plugin
- Impact-based color rendering (high=red, medium=yellow, low=blue)

## Changes Required

### 1. Add New Attribute

Add `showDiff: boolean` attribute (default: `false`):

```typescript
showDiff: {
  default: false,
  parseHTML: (element) => element.getAttribute("data-show-diff") === "true",
  renderHTML: (attributes) => ({
    "data-show-diff": attributes.showDiff ? "true" : "false",
  }),
},
```

### 2. Modify renderHTML for Diff Mode

When `showDiff: true`, render with strikethrough + insertion:

```typescript
renderHTML({ HTMLAttributes, mark }) {
  const showDiff = HTMLAttributes["data-show-diff"] === "true";
  const impact = (HTMLAttributes["data-impact"] as SuggestionImpact) || "medium";
  const colors = impactColors[impact];

  if (showDiff) {
    // Inline diff mode: show deleted + inserted
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "suggestion-diff",
        style: `border: 2px solid ${colors.border}; border-radius: 4px; padding: 2px;`,
      }),
      ["del", { class: "diff-deleted" }, mark.attrs.original],
      ["ins", { class: "diff-inserted" }, mark.attrs.suggested],
    ];
  }

  // Highlight-only mode (current behavior)
  return [
    "span",
    mergeAttributes(HTMLAttributes, {
      class: "suggestion-mark cursor-pointer transition-all hover:opacity-80",
      style: `background-color: ${colors.bg}; border-bottom: 2px solid ${colors.border}; padding: 1px 2px; border-radius: 2px;`,
    }),
    0,
  ];
}
```

### 3. Add toggleDiffMode Command

```typescript
toggleDiffMode:
  (id: string) =>
  ({ tr, state, dispatch }) => {
    if (!dispatch) return false;

    const { doc } = state;
    let found = false;

    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach((mark) => {
          if (mark.type.name === this.name && mark.attrs.id === id) {
            found = true;
            const newShowDiff = !mark.attrs.showDiff;

            // Update mark attributes
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            tr.addMark(
              pos,
              pos + node.nodeSize,
              state.schema.marks[this.name].create({
                ...mark.attrs,
                showDiff: newShowDiff,
              })
            );
          }
        });
      }
    });

    if (found) {
      dispatch(tr);
    }
    return found;
  },
```

### 4. Add CSS Classes

Add to `frontend/src/app/globals.css` or create `frontend/src/styles/editor.css`:

```css
/* Inline diff styling */
.suggestion-diff {
  display: inline;
}

.diff-deleted {
  text-decoration: line-through;
  background-color: rgba(239, 68, 68, 0.2);
  color: rgb(185, 28, 28);
  padding: 1px 2px;
  border-radius: 2px;
  margin-right: 4px;
}

.diff-inserted {
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(21, 128, 61);
  padding: 1px 2px;
  border-radius: 2px;
}
```

## Type Declaration Update

Add to the Commands interface:

```typescript
toggleDiffMode: (id: string) => ReturnType;
```

## Testing

1. Apply a suggestion mark to text
2. Call `editor.commands.toggleDiffMode(suggestionId)`
3. Verify document shows strikethrough original + green suggested
4. Call toggle again, verify returns to highlight-only mode
5. Verify TipTap history can undo the toggle
