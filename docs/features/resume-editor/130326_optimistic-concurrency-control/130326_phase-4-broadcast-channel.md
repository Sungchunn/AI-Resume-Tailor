# Phase 4: BroadcastChannel Hook

**Created:** 2026-03-13
**Status:** Planning
**Parent:** [Master Plan](./130326_master-plan.md)
**Depends On:** [Phase 3: Save Coordinator](./130326_phase-3-save-coordinator.md)

---

## Overview

Implement the `useResumeBroadcast` hook for cross-tab communication within the same browser. This enables same-browser multi-tab conflict detection.

---

## Why BroadcastChannel?

OCC handles cross-device/session conflicts via HTTP 409, but there's a gap:

| Scenario | Detection Method |
| -------- | ---------------- |
| User A on laptop, User B on phone | OCC (version mismatch on save) |
| Same user, two browser tabs | **BroadcastChannel** (instant notification) |

Without BroadcastChannel, Tab B only learns of Tab A's save when Tab B attempts to save. With BroadcastChannel, Tab B is notified immediately, providing better UX.

---

## Message Types

```typescript
/**
 * Message types for cross-tab communication
 */
export type BroadcastMessageType =
  | "SAVE_STARTED"       // A tab started saving
  | "SAVE_COMPLETED"     // A tab finished saving (includes new version)
  | "SAVE_FAILED"        // A tab's save failed
  | "VERSION_CONFLICT";  // A tab detected a version conflict
```

---

## Implementation

**File:** `frontend/src/components/library/editor/hooks/useResumeBroadcast.ts` (NEW)

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Message types for cross-tab communication
 */
export type BroadcastMessageType =
  | "SAVE_STARTED"
  | "SAVE_COMPLETED"
  | "SAVE_FAILED"
  | "VERSION_CONFLICT";

/**
 * Message payload for BroadcastChannel
 */
export interface BroadcastMessage {
  /** Message type */
  type: BroadcastMessageType;
  /** Resume ID this message relates to */
  resumeId: string;
  /** New version after save (for SAVE_COMPLETED) */
  version?: number;
  /** Unique identifier for the sending tab */
  tabId: string;
  /** Timestamp when message was sent */
  timestamp: number;
}

/**
 * Options for the broadcast hook
 */
export interface UseResumeBroadcastOptions {
  /** Resume ID to scope the channel */
  resumeId: string;
  /** Callback when another tab saves successfully */
  onSaveFromOtherTab?: (message: BroadcastMessage) => void;
  /** Callback when another tab detects a conflict */
  onConflictFromOtherTab?: (message: BroadcastMessage) => void;
}

/**
 * Return type for the broadcast hook
 */
export interface UseResumeBroadcastReturn {
  /** Broadcast a message to other tabs */
  broadcast: (type: BroadcastMessageType, version?: number) => void;
  /** This tab's unique identifier */
  tabId: string;
}

// Generate a unique tab ID (stable for the tab's lifetime)
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Hook for cross-tab communication via BroadcastChannel.
 *
 * Enables same-browser multi-tab conflict detection by notifying
 * other tabs when saves complete or conflicts occur.
 *
 * @example
 * ```typescript
 * const { broadcast } = useResumeBroadcast({
 *   resumeId: "abc123",
 *   onSaveFromOtherTab: (msg) => {
 *     // Another tab saved - update our version
 *     if (msg.version && msg.version > currentVersion) {
 *       setOutOfSync(true);
 *     }
 *   },
 * });
 *
 * // After successful save
 * broadcast("SAVE_COMPLETED", newVersion);
 * ```
 */
export function useResumeBroadcast({
  resumeId,
  onSaveFromOtherTab,
  onConflictFromOtherTab,
}: UseResumeBroadcastOptions): UseResumeBroadcastReturn {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Store callbacks in refs to avoid effect re-runs
  const onSaveFromOtherTabRef = useRef(onSaveFromOtherTab);
  const onConflictFromOtherTabRef = useRef(onConflictFromOtherTab);

  // Update refs when callbacks change
  useEffect(() => {
    onSaveFromOtherTabRef.current = onSaveFromOtherTab;
    onConflictFromOtherTabRef.current = onConflictFromOtherTab;
  }, [onSaveFromOtherTab, onConflictFromOtherTab]);

  // Initialize channel
  useEffect(() => {
    // Check for BroadcastChannel support (not available in all browsers/SSR)
    if (typeof BroadcastChannel === "undefined") {
      console.warn("[BroadcastChannel] Not supported in this environment");
      return;
    }

    // Create channel scoped to this resume
    const channelName = `resume-editor-${resumeId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    console.log(`[BroadcastChannel] Joined channel: ${channelName}`);

    // Handle incoming messages
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;

      // Ignore messages from this tab
      if (message.tabId === TAB_ID) {
        return;
      }

      console.log("[BroadcastChannel] Received message:", message);

      switch (message.type) {
        case "SAVE_COMPLETED":
          onSaveFromOtherTabRef.current?.(message);
          break;
        case "VERSION_CONFLICT":
          onConflictFromOtherTabRef.current?.(message);
          break;
        // SAVE_STARTED and SAVE_FAILED are informational; no action needed
      }
    };

    // Cleanup on unmount or resumeId change
    return () => {
      console.log(`[BroadcastChannel] Leaving channel: ${channelName}`);
      channel.close();
      channelRef.current = null;
    };
  }, [resumeId]);

  /**
   * Broadcast a message to other tabs editing this resume
   */
  const broadcast = useCallback(
    (type: BroadcastMessageType, version?: number) => {
      if (!channelRef.current) {
        console.warn("[BroadcastChannel] Channel not initialized");
        return;
      }

      const message: BroadcastMessage = {
        type,
        resumeId,
        version,
        tabId: TAB_ID,
        timestamp: Date.now(),
      };

      channelRef.current.postMessage(message);
      console.log("[BroadcastChannel] Sent message:", message);
    },
    [resumeId]
  );

  return {
    broadcast,
    tabId: TAB_ID,
  };
}
```

---

## Integration with Save Coordinator

The broadcast hook is used alongside the save coordinator:

```typescript
// In BlockEditorProvider

const { broadcast } = useResumeBroadcast({
  resumeId,
  onSaveFromOtherTab: (message) => {
    // Another tab saved - check if we're now stale
    if (message.version && message.version > currentVersion) {
      console.log(
        `[BlockEditor] Version ${currentVersion} is stale, server has ${message.version}`
      );
      // Option 1: Mark as dirty and let user save (will get 409)
      // Option 2: Immediately show conflict UI
      setHasConflict(true);
    }
  },
});

const { executeSave, hasConflict } = useSaveCoordinator({
  resumeId,
  onSaveSuccess: (newVersion) => {
    setCurrentVersion(newVersion);
    // Notify other tabs
    broadcast("SAVE_COMPLETED", newVersion);
  },
  onConflict: () => {
    // Notify other tabs (informational)
    broadcast("VERSION_CONFLICT");
  },
});
```

---

## Browser Compatibility

| Browser | Support |
| ------- | ------- |
| Chrome | ✅ 54+ |
| Firefox | ✅ 38+ |
| Safari | ✅ 15.4+ |
| Edge | ✅ 79+ |
| IE | ❌ Not supported |

**Fallback:** The hook checks for `typeof BroadcastChannel` and gracefully degrades. Without BroadcastChannel, users still get OCC protection; they just won't get instant cross-tab notifications.

---

## Verification

### Manual Multi-Tab Test

1. Open resume in Tab A
2. Open same resume in Tab B
3. In Tab A, edit and save
4. **Expected:** Tab B console shows `[BroadcastChannel] Received message: {type: "SAVE_COMPLETED", ...}`
5. **Expected:** Tab B UI shows conflict warning (if version checking is enabled)

### Unit Test (with mock)

```typescript
// Mock BroadcastChannel for testing
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    // Simulate broadcast to other instances with same name
    MockBroadcastChannel.instances
      .filter((ch) => ch.name === this.name && ch !== this)
      .forEach((ch) => {
        ch.onmessage?.({ data: message } as MessageEvent);
      });
  }

  close() {
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }
}

// Test
global.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;

const onSave = jest.fn();
const { result: tab1 } = renderHook(() =>
  useResumeBroadcast({ resumeId: "test", onSaveFromOtherTab: onSave })
);
const { result: tab2 } = renderHook(() =>
  useResumeBroadcast({ resumeId: "test" })
);

// Tab 2 broadcasts
tab2.current.broadcast("SAVE_COMPLETED", 5);

// Tab 1 receives
expect(onSave).toHaveBeenCalledWith(
  expect.objectContaining({ type: "SAVE_COMPLETED", version: 5 })
);
```

---

## Next Phase

Proceed to [Phase 5: Conflict UI](./130326_phase-5-conflict-ui.md) to implement the user-facing conflict resolution.
