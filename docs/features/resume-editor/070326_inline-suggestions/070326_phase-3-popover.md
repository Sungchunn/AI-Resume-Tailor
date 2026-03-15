# Phase 3: Popover Enhancements

**Goal:** Add keyboard shortcuts and inline diff toggle to existing popover.

## File to Modify

- `frontend/src/components/editor/SuggestionPopover.tsx`

## Current State (Already Built)

The popover already shows:

- Original text with strikethrough + red background
- Suggested text with green background
- Reason for change
- Accept/Reject buttons
- Impact badge
- Escape to close
- Click-outside to close

## Changes Required

### 1. Add Enter Key Handler

Update the keyboard event listener:

```typescript
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (event.key === "Escape") {
    onClose();
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (suggestion) {
      onAccept(suggestion);
    }
  }
}, [onClose, onAccept, suggestion]);

useEffect(() => {
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [handleKeyDown]);
```

### 2. Add Props for Inline Diff Toggle

Update the interface:

```typescript
interface SuggestionPopoverProps {
  suggestion: SuggestionMark | null;
  position: { x: number; y: number } | null;
  onAccept: (suggestion: SuggestionMark) => void;
  onReject: (suggestion: SuggestionMark) => void;
  onClose: () => void;
  onToggleDiff?: (suggestion: SuggestionMark) => void;  // New
  showingDiff?: boolean;  // New
}
```

### 3. Add Toggle Button in UI

Add between the content and actions sections:

```tsx
{/* Toggle inline diff button */}
{onToggleDiff && (
  <div className="px-3 py-1.5 border-t border-border">
    <button
      type="button"
      onClick={() => suggestion && onToggleDiff(suggestion)}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      {showingDiff ? "Hide" : "Show"} diff in document
    </button>
  </div>
)}
```

### 4. Add Keyboard Shortcuts Hint

Add at the bottom of the actions section:

```tsx
{/* Actions */}
<div className="flex flex-col gap-2 px-3 py-2 bg-muted border-t border-border">
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={handleAccept}
      className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
    >
      Accept
    </button>
    <button
      type="button"
      onClick={handleReject}
      className="flex-1 px-3 py-1.5 text-sm font-medium text-foreground/80 bg-card border border-input hover:bg-accent rounded transition-colors"
    >
      Reject
    </button>
  </div>
  {/* Keyboard hints */}
  <div className="text-center text-xs text-muted-foreground/60">
    <kbd className="px-1 py-0.5 bg-muted-foreground/10 rounded text-[10px]">Enter</kbd> accept
    <span className="mx-2">·</span>
    <kbd className="px-1 py-0.5 bg-muted-foreground/10 rounded text-[10px]">Esc</kbd> dismiss
  </div>
</div>
```

## Integration with ResumeEditor

Update `ResumeEditor.tsx` to pass the new props:

```typescript
const [showingDiff, setShowingDiff] = useState<Record<string, boolean>>({});

const handleToggleDiff = useCallback((mark: SuggestionMark) => {
  if (!editor) return;
  editor.commands.toggleDiffMode(mark.id);
  setShowingDiff(prev => ({
    ...prev,
    [mark.id]: !prev[mark.id],
  }));
}, [editor]);

// In render:
<SuggestionPopover
  suggestion={activeSuggestion}
  position={popoverPosition}
  onAccept={handleAcceptSuggestion}
  onReject={handleRejectSuggestion}
  onClose={handleClosePopover}
  onToggleDiff={handleToggleDiff}
  showingDiff={activeSuggestion ? showingDiff[activeSuggestion.id] : false}
/>
```

## Testing

1. Click on a suggestion mark
2. Verify popover shows with keyboard hints
3. Press Enter - verify suggestion is accepted
4. Click another suggestion, press Escape - verify popover closes
5. Click "Show diff in document" - verify inline diff appears
6. Click again - verify diff hides, returns to highlight mode
