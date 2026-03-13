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
