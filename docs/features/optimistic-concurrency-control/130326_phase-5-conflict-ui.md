# Phase 5: Conflict UI and BlockEditorProvider Integration

**Created:** 2026-03-13
**Status:** Planning
**Parent:** [Master Plan](./130326_master-plan.md)
**Depends On:** All previous phases

---

## Overview

Implement the user-facing conflict resolution UI and integrate all OCC components into `BlockEditorProvider`.

---

## Components

1. **ConflictModal** - Modal shown when version conflict detected
2. **BlockEditorProvider updates** - Integration of save coordinator and broadcast hooks
3. **BlockEditorContext updates** - New fields for conflict state

---

## 5.1 Conflict Modal Component

**File:** `frontend/src/components/library/editor/ConflictModal.tsx` (NEW)

```typescript
"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConflictModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to refresh the page */
  onRefresh: () => void;
  /** Optional custom message */
  message?: string;
}

/**
 * Modal displayed when a version conflict is detected.
 *
 * This modal is non-dismissible (no close button, no backdrop click)
 * because the editor is in an inconsistent state and must be refreshed.
 */
export function ConflictModal({
  isOpen,
  onRefresh,
  message = "This resume was modified in another tab or by another user. Your changes could not be saved.",
}: ConflictModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent closing via escape or backdrop click
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        // Hide the default close button
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Version Conflict Detected
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <h4 className="font-medium text-zinc-200 mb-2">What happened?</h4>
            <p className="text-sm text-zinc-400">
              While you were editing, another session saved changes to this
              resume. To prevent data loss, your save was blocked.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onRefresh} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh to Get Latest Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5.2 BlockEditorProvider Integration

**File:** `frontend/src/components/library/editor/BlockEditorProvider.tsx`

### Updated Props

```typescript
export interface BlockEditorProviderProps {
  /** Resume ID for save operations */
  resumeId: string;
  /** Initial parsed content from the backend */
  initialParsedContent?: ParsedResumeContent | null;
  /** Initial style settings from the backend */
  initialStyle?: Record<string, unknown> | null;
  /** Initial document version from the backend */
  initialVersion: number;  // NEW
  /** Callback when save is triggered - returns new version */
  onSave?: (data: {
    parsedContent: ParsedResumeContent;
    style: Record<string, unknown>;
    version: number;  // NEW: Include version in save
  }) => Promise<{ version: number }>;  // NEW: Return new version
  /** Children to render */
  children: ReactNode;
}
```

### Hook Integration

```typescript
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSaveCoordinator } from "@/hooks/useSaveCoordinator";
import { useResumeBroadcast } from "./hooks/useResumeBroadcast";
import { ConflictModal } from "./ConflictModal";

export function BlockEditorProvider({
  resumeId,
  initialParsedContent,
  initialStyle,
  initialVersion,  // NEW
  onSave,
  children,
}: BlockEditorProviderProps) {
  const router = useRouter();

  // Track current document version
  const [currentVersion, setCurrentVersion] = useState(initialVersion);

  // ... existing state initialization ...

  // BroadcastChannel for cross-tab sync
  const { broadcast } = useResumeBroadcast({
    resumeId,
    onSaveFromOtherTab: (message) => {
      // Another tab saved successfully
      if (message.version && message.version > currentVersion) {
        console.log(
          `[BlockEditor] Stale version detected: local=${currentVersion}, remote=${message.version}`
        );
        // Trigger conflict state
        setHasExternalConflict(true);
      }
    },
  });

  // Track if conflict came from BroadcastChannel (vs HTTP 409)
  const [hasExternalConflict, setHasExternalConflict] = useState(false);

  // Save coordinator with OCC
  const {
    executeSave,
    hasConflict: hasSaveConflict,
    isSaving,
    clearConflict,
  } = useSaveCoordinator({
    resumeId,
    onSaveSuccess: (newVersion) => {
      setCurrentVersion(newVersion);
      dispatch(blockEditorActions.setDirty(false));
      // Notify other tabs
      broadcast("SAVE_COMPLETED", newVersion);
    },
    onConflict: () => {
      // Notify other tabs (informational)
      broadcast("VERSION_CONFLICT");
    },
  });

  // Combined conflict state
  const hasConflict = hasSaveConflict || hasExternalConflict;

  // Save handler with version tracking
  const save = useCallback(async () => {
    if (!onSave || hasConflict) return;

    dispatch(blockEditorActions.setLoading(true));

    try {
      broadcast("SAVE_STARTED");

      const parsedContent = blocksToParsedContent(state.blocks);
      const apiStyle = editorStyleToApiStyle(state.style);

      // Call parent's onSave which should call executeSave internally
      // OR call executeSave directly
      const newVersion = await executeSave({
        version: currentVersion,
        parsed_content: parsedContent,
        style: apiStyle,
      });

      if (newVersion) {
        dispatch(blockEditorActions.setError(null));
      }
    } catch (err) {
      broadcast("SAVE_FAILED");
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save";
      dispatch(blockEditorActions.setError(errorMessage));
    } finally {
      dispatch(blockEditorActions.setLoading(false));
    }
  }, [
    state.blocks,
    state.style,
    currentVersion,
    hasConflict,
    onSave,
    executeSave,
    broadcast,
  ]);

  // Handle refresh after conflict
  const handleConflictRefresh = useCallback(() => {
    clearConflict();
    setHasExternalConflict(false);
    router.refresh();
  }, [clearConflict, router]);

  // Context value (updated)
  const contextValue: BlockEditorContextValue = useMemo(
    () => ({
      state,
      dispatch,
      // ... existing methods ...
      save,
      isSaving,
      hasConflict,       // NEW
      currentVersion,    // NEW
      // ... rest of context ...
    }),
    [
      state,
      save,
      isSaving,
      hasConflict,
      currentVersion,
      // ... other dependencies ...
    ]
  );

  return (
    <BlockEditorContext.Provider value={contextValue}>
      {children}

      {/* Conflict Modal - blocks interaction when conflict detected */}
      <ConflictModal isOpen={hasConflict} onRefresh={handleConflictRefresh} />
    </BlockEditorContext.Provider>
  );
}
```

---

## 5.3 BlockEditorContext Updates

**File:** `frontend/src/components/library/editor/BlockEditorContext.tsx`

Add new fields to context value:

```typescript
export interface BlockEditorContextValue {
  // State
  state: BlockEditorState;
  dispatch: React.Dispatch<BlockEditorAction>;

  // ... existing fields ...

  // Persistence
  save: () => Promise<void>;
  isSaving: boolean;

  // NEW: Conflict state
  /** Whether a version conflict has been detected */
  hasConflict: boolean;
  /** Current document version */
  currentVersion: number;

  // ... rest of existing fields ...
}
```

### Utility Hook for Conflict State

```typescript
/**
 * Hook to check if there's a version conflict
 */
export function useHasConflict(): boolean {
  const { hasConflict } = useBlockEditor();
  return hasConflict;
}

/**
 * Hook to get the current document version
 */
export function useCurrentVersion(): number {
  const { currentVersion } = useBlockEditor();
  return currentVersion;
}
```

---

## 5.4 Page-Level Integration

The page that renders `BlockEditorProvider` must pass `initialVersion`:

**File:** `frontend/src/app/(protected)/library/resumes/[id]/edit/page.tsx`

```typescript
export default async function EditResumePage({
  params,
}: {
  params: { id: string };
}) {
  const resume = await getResume(params.id);

  return (
    <BlockEditorProvider
      resumeId={params.id}
      initialParsedContent={resume.parsed}
      initialStyle={resume.style}
      initialVersion={resume.version ?? 1}  // NEW: Handle lazy migration
      onSave={async (data) => {
        "use server";
        const result = await updateResume(params.id, {
          version: data.version,
          parsed_content: data.parsedContent,
          style: data.style,
        });
        return { version: result.version };
      }}
    >
      <EditorLayout />
    </BlockEditorProvider>
  );
}
```

---

## UX Considerations

### Why Non-Dismissible Modal?

The conflict modal cannot be dismissed because:

1. **Data consistency** - The editor's state is out of sync with the server
2. **Prevents confusion** - User might continue editing, only to hit another conflict
3. **Single action** - Only valid action is to refresh

### Why Refresh Instead of Merge?

Conflict resolution via merging is complex:

| Approach | Complexity | Risk |
| -------- | ---------- | ---- |
| Refresh and lose local changes | Low | Medium (user loses work) |
| Three-way merge | Very High | Low (preserves work) |
| Show diff and let user choose | Medium | Low |

For V1, we choose **refresh** because:

1. Auto-save (from fit-to-one-page) minimizes data loss
2. Cross-device editing is rare for resumes
3. Same-browser conflicts are caught quickly via BroadcastChannel

**Future consideration:** Implement conflict diff view if user feedback indicates data loss is painful.

---

## Verification

### Conflict Modal Test

1. Open resume in editor
2. In another tab (or via API), update the resume
3. In first tab, try to save
4. **Expected:** ConflictModal appears
5. **Expected:** Modal cannot be dismissed by clicking outside or pressing Escape
6. **Expected:** Clicking "Refresh" reloads the page

### BroadcastChannel Integration Test

1. Open resume in Tab A and Tab B
2. In Tab A, save changes
3. **Expected:** Tab B shows ConflictModal immediately (via BroadcastChannel)
4. **Expected:** Tab B doesn't need to attempt save to see conflict

### Context Value Test

```typescript
const { hasConflict, currentVersion } = useBlockEditor();

// Initial state
expect(hasConflict).toBe(false);
expect(currentVersion).toBe(1);

// After successful save
expect(currentVersion).toBe(2);

// After conflict
expect(hasConflict).toBe(true);
```

---

## Complete Implementation Checklist

After completing all phases:

- [ ] Backend returns `version` in ResumeResponse
- [ ] Backend requires `version` in ResumeUpdate
- [ ] Backend returns HTTP 409 on version mismatch
- [ ] Frontend `VersionConflictError` class exists
- [ ] Frontend API client handles 409 → VersionConflictError
- [ ] `useSaveCoordinator` hook implemented
- [ ] `useResumeBroadcast` hook implemented
- [ ] `ConflictModal` component implemented
- [ ] `BlockEditorProvider` integrates all hooks
- [ ] `BlockEditorContext` exposes `hasConflict` and `currentVersion`
- [ ] Edit page passes `initialVersion` prop
- [ ] Manual multi-tab test passes
- [ ] HTTP 409 test passes

---

## Related Documents

| Document | Relationship |
| -------- | ------------ |
| [Master Plan](./130326_master-plan.md) | Parent document |
| [Fit-to-One-Page Tradeoff 3](../fit-to-one-page/130326_tradeoff-3-eager-persistence.md) | Defines auto-save extension |
