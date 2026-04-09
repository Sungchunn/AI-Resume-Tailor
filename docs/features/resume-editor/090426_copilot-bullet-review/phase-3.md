# Phase 3: Inline Diff Overlay on BulletList

**Goal:** When copilot mode is active, highlight the target bullet in the editor and show an inline diff overlay directly below it.

---

## 3.1 Create CopilotDiffOverlay Component

**File:** `frontend/src/components/tailor/editor/CopilotDiffOverlay.tsx` (NEW)

A compact inline component that renders below a bullet input showing the proposed change.

```typescript
interface CopilotDiffOverlayProps {
  suggestion: BulletSuggestion;
}

export function CopilotDiffOverlay({ suggestion }: CopilotDiffOverlayProps) {
  return (
    <div className="ml-10 mt-1 mb-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Impact badge + reason */}
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", impactStyles[suggestion.impact])}>
          {suggestion.impact.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground italic truncate">
          {suggestion.reason}
        </span>
      </div>

      {/* Diff: original strikethrough */}
      <div className="text-sm">
        <del className="text-red-500/80 line-through">{suggestion.original}</del>
      </div>

      {/* Diff: suggested in green */}
      <div className="text-sm font-medium text-green-600 dark:text-green-400">
        {suggestion.suggested}
      </div>

      {/* Keywords added */}
      {suggestion.keywordsAdded.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.keywordsAdded.map(kw => (
            <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              +{kw}
            </span>
          ))}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
        <span><kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Enter</kbd> accept</span>
        <span><kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Esc</kbd> skip</span>
      </div>
    </div>
  );
}
```

---

## 3.2 Modify BulletList to Accept Copilot Suggestion

**File:** `frontend/src/components/library/editor/blocks/shared/BulletList.tsx`

### New Props

```typescript
interface BulletListProps {
  // ... existing props ...

  /** The currently active copilot suggestion targeting a bullet in this list */
  activeCopilotSuggestion?: BulletSuggestion | null;
}
```

### Rendering Changes

For each bullet, check if it matches the active copilot suggestion:

```typescript
import { CopilotDiffOverlay } from "@/components/tailor/editor/CopilotDiffOverlay";

// Inside the bullets.map() loop:
const isCopilotTarget =
  activeCopilotSuggestion &&
  suggestionBulletId &&
  activeCopilotSuggestion.bulletId === suggestionBulletId;

// Modify the bullet row div:
<div
  key={bulletId}
  className={cn(
    "flex items-start gap-2 group relative",
    isCopilotTarget && "ring-2 ring-blue-500 ring-offset-2 rounded-md"
  )}
>
  {/* ... existing bullet input ... */}
</div>

{/* Copilot diff overlay - rendered AFTER the bullet row */}
{isCopilotTarget && (
  <CopilotDiffOverlay suggestion={activeCopilotSuggestion} />
)}
```

### Auto-Scroll into View

When a bullet becomes the copilot target, scroll it into the viewport:

```typescript
const bulletRowRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isCopilotTarget && bulletRowRef.current) {
    bulletRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}, [isCopilotTarget]);
```

**Note:** The scroll ref needs to be on the specific bullet row that matches, not a shared ref. Use a callback ref pattern or conditional ref assignment.

---

## 3.3 Pass Copilot Suggestion Through Editors

**File:** `frontend/src/components/library/editor/blocks/ExperienceEditor.tsx`

```typescript
import { useCurrentCopilotSuggestion } from "@/lib/stores/bulletSuggestionsStore";

// In component:
const copilotSuggestion = useCurrentCopilotSuggestion();

// Pass to BulletList for each entry:
<BulletList
  // ... existing props ...
  blockId={block.id}
  entryIndex={entryIndex}
  activeCopilotSuggestion={copilotSuggestion}
/>
```

**File:** `frontend/src/components/library/editor/blocks/ProjectsEditor.tsx`

Same pattern - import `useCurrentCopilotSuggestion` and pass to each `BulletList`.

---

## 3.4 Matching Logic

The copilot suggestion's `bulletId` format is: `blockId:entry-N:bullet-M`

The BulletList already builds this format using `blockId` and `entryIndex` props:

```typescript
const suggestionBulletId =
  blockId !== undefined && entryIndex !== undefined
    ? `${blockId}:entry-${entryIndex}:bullet-${index}`
    : null;
```

So matching is simply:

```typescript
activeCopilotSuggestion?.bulletId === suggestionBulletId
```

---

## Verification

- [ ] When copilot is active, the target bullet has a blue ring highlight
- [ ] CopilotDiffOverlay renders below the correct bullet with original/suggested text
- [ ] Overlay shows impact badge, reason, and keywords added
- [ ] Bullet auto-scrolls into view when it becomes the copilot target
- [ ] Advancing to next suggestion moves the highlight to the next bullet
- [ ] When copilot is inactive, no highlights or overlays appear
- [ ] Works for both Experience and Projects sections
