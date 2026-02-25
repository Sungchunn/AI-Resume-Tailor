"use client";

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  modifiers?: ("ctrl" | "cmd" | "shift" | "alt")[];
  action: () => void;
  description: string;
  category: "general" | "navigation" | "suggestions" | "editor" | "export";
  enabled?: boolean | (() => boolean);
}

export interface ShortcutGroup {
  category: string;
  label: string;
  shortcuts: KeyboardShortcut[];
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefaultOnMatch?: boolean;
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const { key, modifiers = [] } = shortcut;

  // Check if key matches (case-insensitive for letters)
  if (event.key.toLowerCase() !== key.toLowerCase()) {
    return false;
  }

  // Check modifiers
  const requiresCtrl = modifiers.includes("ctrl");
  const requiresCmd = modifiers.includes("cmd");
  const requiresShift = modifiers.includes("shift");
  const requiresAlt = modifiers.includes("alt");

  // On Mac, cmd maps to metaKey; on Windows/Linux, ctrl maps to ctrlKey
  const hasMetaOrCtrl = isMac ? event.metaKey : event.ctrlKey;
  const needsMetaOrCtrl = requiresCtrl || requiresCmd;

  if (needsMetaOrCtrl !== hasMetaOrCtrl) return false;
  if (requiresShift !== event.shiftKey) return false;
  if (requiresAlt !== event.altKey) return false;

  return true;
}

/**
 * Hook to register and handle global keyboard shortcuts.
 * Automatically ignores shortcuts when typing in inputs/textareas.
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefaultOnMatch = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== "Escape") return;
      }

      for (const shortcut of shortcutsRef.current) {
        // Check if shortcut is enabled
        const isEnabled =
          shortcut.enabled === undefined
            ? true
            : typeof shortcut.enabled === "function"
              ? shortcut.enabled()
              : shortcut.enabled;

        if (!isEnabled) continue;

        if (matchesShortcut(event, shortcut)) {
          if (preventDefaultOnMatch) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.action();
          return;
        }
      }
    },
    [enabled, preventDefaultOnMatch]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Helper to format a shortcut for display (e.g., "⌘Z" on Mac, "Ctrl+Z" on Windows)
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const { key, modifiers = [] } = shortcut;
  const parts: string[] = [];

  if (modifiers.includes("ctrl") || modifiers.includes("cmd")) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (modifiers.includes("shift")) {
    parts.push(isMac ? "⇧" : "Shift");
  }
  if (modifiers.includes("alt")) {
    parts.push(isMac ? "⌥" : "Alt");
  }

  // Format special keys
  const keyDisplay: Record<string, string> = {
    escape: "Esc",
    enter: isMac ? "↵" : "Enter",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    tab: "Tab",
    " ": "Space",
  };

  parts.push(keyDisplay[key.toLowerCase()] || key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}

/**
 * Helper to group shortcuts by category for display
 */
export function groupShortcuts(shortcuts: KeyboardShortcut[]): ShortcutGroup[] {
  const categoryLabels: Record<string, string> = {
    general: "General",
    navigation: "Navigation",
    suggestions: "Suggestions",
    editor: "Editor",
    export: "Export",
  };

  const groups: Record<string, KeyboardShortcut[]> = {};

  for (const shortcut of shortcuts) {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
  }

  return Object.entries(groups).map(([category, categoryShortcuts]) => ({
    category,
    label: categoryLabels[category] || category,
    shortcuts: categoryShortcuts,
  }));
}
