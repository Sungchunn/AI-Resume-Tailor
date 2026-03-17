# Phase 3: Remove Overlay System

## Overview

Remove the floating overlay pattern now that inline components render editors directly.

---

## Step 3.1: Delete `InlineEditManager.tsx`

**File**: `/frontend/src/components/library/editor/inline/InlineEditManager.tsx`

**Action**: Delete file

This component is no longer needed - it was responsible for:

- Rendering the TipTap editor overlay via `createPortal`
- Positioning overlay at element coordinates
- Handling click-outside to commit

All this is now handled by individual inline components.

---

## Step 3.2: Simplify `InlineEditContext.tsx`

**File**: `/frontend/src/components/library/editor/inline/InlineEditContext.tsx`

**Current responsibilities**:

- Creates single shared TipTap editor instance
- Manages `editingElementId`, `originalValue`
- Provides `startEdit`, `commitEdit`, `cancelEdit`
- Manages commit handler registry

**New responsibilities** (simplified):

- Track `focusedElementId` for UI highlights
- Provide `currentEditor` reference for FloatingToolbar

### New Implementation

```tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Editor } from "@tiptap/react";

interface InlineEditContextValue {
  // Currently focused element (for UI highlighting)
  focusedElementId: string | null;
  setFocusedElementId: (id: string | null) => void;

  // Currently active editor (for FloatingToolbar)
  currentEditor: Editor | null;
  setCurrentEditor: (editor: Editor | null) => void;
}

const InlineEditContext = createContext<InlineEditContextValue | null>(null);

export function InlineEditProvider({ children }: { children: ReactNode }) {
  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);
  const [currentEditor, setCurrentEditor] = useState<Editor | null>(null);

  return (
    <InlineEditContext.Provider
      value={{
        focusedElementId,
        setFocusedElementId,
        currentEditor,
        setCurrentEditor,
      }}
    >
      {children}
    </InlineEditContext.Provider>
  );
}

export function useInlineEdit() {
  const context = useContext(InlineEditContext);
  if (!context) {
    throw new Error("useInlineEdit must be used within InlineEditProvider");
  }
  return context;
}

export function useInlineEditOptional() {
  return useContext(InlineEditContext);
}
```

---

## Step 3.3: Update `FloatingToolbar.tsx`

**File**: `/frontend/src/components/library/editor/inline/FloatingToolbar.tsx`

The toolbar should now:

1. Accept editor as prop (from individual InlineRichText components)
2. OR subscribe to context's `currentEditor`

If using context approach, update `InlineRichText` to register its editor:

```tsx
// In InlineRichText
const { setCurrentEditor } = useInlineEditOptional() ?? {};

useEffect(() => {
  if (editor?.isFocused) {
    setCurrentEditor?.(editor);
  }
  return () => {
    if (editor?.isFocused) {
      setCurrentEditor?.(null);
    }
  };
}, [editor, editor?.isFocused, setCurrentEditor]);
```

---

## Step 3.4: Update `PaginatedResumePreview.tsx`

**File**: `/frontend/src/components/library/preview/PaginatedResumePreview.tsx`

Remove `InlineEditManager` usage:

```diff
- import { InlineEditManager } from "../editor/inline/InlineEditManager";

  return (
    <div ref={containerRef}>
-     <InlineEditManager containerRef={containerRef} />
      {/* Rest of preview content */}
    </div>
  );
```

Keep `InlineEditProvider` wrapper if needed for context.

---

## Step 3.5: Update Related Files

Check for other usages of `InlineEditManager`:

- `ResumePreviewPanel.tsx`
- `TailorEditorPage.tsx`
- Any other preview containers

Remove all `InlineEditManager` imports and usages.

---

## Completion Criteria

- [ ] `InlineEditManager.tsx` deleted
- [ ] `InlineEditContext.tsx` simplified
- [ ] `FloatingToolbar.tsx` works with individual editor instances
- [ ] `PaginatedResumePreview.tsx` no longer uses InlineEditManager
- [ ] No broken imports or runtime errors
- [ ] FloatingToolbar appears on text selection in rich text fields
