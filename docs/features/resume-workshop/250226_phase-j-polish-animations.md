# Phase J: Polish and Animations

**Created**: February 25, 2026
**Status**: Ready for Implementation
**Dependencies**: Phases A-I (all workshop components)
**Priority**: P3
**Next Phase**: Production Deployment

---

## Overview

Add production-quality micro-interactions, undo/redo functionality, comprehensive keyboard shortcuts, and loading states to create a polished, professional user experience. This phase transforms the functional workshop into a delightful, efficient tool.

---

## Key Features

1. **Undo/Redo History** - Full edit history with keyboard shortcuts
2. **Keyboard Shortcuts** - Comprehensive shortcuts with help overlay
3. **Tab Transitions** - Smooth animations between workshop tabs
4. **Score Animations** - Gauge fill, number counting, color transitions
5. **Suggestion Animations** - Accept/reject micro-interactions
6. **Loading Skeletons** - Polished loading states for all components
7. **Visual Regression Tests** - Ensure PDF export matches preview

---

## Feature Specifications

### 1. Undo/Redo History System

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           UNDO/REDO FLOW                                 │
│                                                                          │
│  User makes edit → Push to history stack → Update current state          │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │  HISTORY STACK (max 50 entries)                                  │     │
│  │                                                                  │     │
│  │  [State 0] → [State 1] → [State 2] → [State 3 ← current]        │     │
│  │                                         ↑                        │     │
│  │                                    history index                 │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Undo (Cmd/Ctrl+Z):     Move index back, restore previous state          │
│  Redo (Cmd/Ctrl+Shift+Z): Move index forward, restore next state         │
│                                                                          │
│  ┌─────────────────────────┐                                            │
│  │  Tracked Actions:       │                                            │
│  │  • Section text edits   │                                            │
│  │  • Suggestion accepts   │                                            │
│  │  • Suggestion rejects   │                                            │
│  │  • Style changes        │                                            │
│  │  • Section reorder      │                                            │
│  │  • Block additions      │                                            │
│  └─────────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2. Keyboard Shortcuts Map

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        KEYBOARD SHORTCUTS                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  GENERAL                                                           │   │
│  │  ─────────                                                         │   │
│  │  ?           Show keyboard shortcuts help                          │   │
│  │  Escape      Close modal / Cancel current action                   │   │
│  │  Cmd/Ctrl+S  Save current progress (explicit save)                 │   │
│  │  Cmd/Ctrl+Z  Undo last action                                      │   │
│  │  Cmd/Ctrl+Shift+Z  Redo last undone action                         │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  NAVIGATION                                                        │   │
│  │  ────────────                                                      │   │
│  │  1           Switch to Overview tab                                │   │
│  │  2           Switch to Suggestions tab                             │   │
│  │  3           Switch to Editor tab                                  │   │
│  │  4           Switch to Style tab                                   │   │
│  │  Tab         Focus next element                                    │   │
│  │  Shift+Tab   Focus previous element                                │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  SUGGESTIONS (when Suggestions tab active)                         │   │
│  │  ───────────────                                                   │   │
│  │  A           Accept current/selected suggestion                    │   │
│  │  R           Reject current/selected suggestion                    │   │
│  │  J or ↓      Move to next suggestion                               │   │
│  │  K or ↑      Move to previous suggestion                           │   │
│  │  Enter       Expand/collapse suggestion details                    │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  EDITOR (when Editor tab active)                                   │   │
│  │  ───────────                                                       │   │
│  │  Cmd/Ctrl+B  Bold selected text                                    │   │
│  │  Cmd/Ctrl+I  Italic selected text                                  │   │
│  │  Cmd/Ctrl+Enter  Save section changes                              │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  EXPORT                                                            │   │
│  │  ─────────                                                         │   │
│  │  Cmd/Ctrl+P  Export as PDF                                         │   │
│  │  Cmd/Ctrl+E  Open export menu                                      │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3. Animation Specifications

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        ANIMATION CATALOG                                 │
│                                                                          │
│  TAB TRANSITIONS                                                         │
│  ───────────────                                                         │
│  Type: Fade + Slide                                                      │
│  Duration: 200ms                                                         │
│  Easing: ease-out                                                        │
│                                                                          │
│  Entry: opacity 0 → 1, translateX(8px) → 0                               │
│  Exit: opacity 1 → 0, translateX(0) → -8px                               │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  SCORE GAUGE                                                             │
│  ───────────                                                             │
│  Number: Count up/down animation (500ms, ease-out)                       │
│  Bar fill: Width transition (600ms, ease-in-out)                         │
│  Color: Gradient transition based on score threshold                     │
│                                                                          │
│  Color thresholds:                                                       │
│  • 0-50%:  Red (#EF4444) → Orange (#F97316)                              │
│  • 50-70%: Orange (#F97316) → Yellow (#EAB308)                           │
│  • 70-85%: Yellow (#EAB308) → Green (#22C55E)                            │
│  • 85%+:   Green (#22C55E)                                               │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  SUGGESTION ACCEPT                                                       │
│  ─────────────────                                                       │
│  Duration: 300ms                                                         │
│  Sequence:                                                               │
│  1. Flash green background (150ms)                                       │
│  2. Scale down to 0.95 (100ms)                                           │
│  3. Slide out to right + fade (150ms)                                    │
│  4. Collapse height (200ms)                                              │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  SUGGESTION REJECT                                                       │
│  ────────────────                                                        │
│  Duration: 250ms                                                         │
│  Sequence:                                                               │
│  1. Flash red background (100ms)                                         │
│  2. Shake horizontally (50ms × 3)                                        │
│  3. Fade out + slide left (150ms)                                        │
│  4. Collapse height (200ms)                                              │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  MODAL / OVERLAY                                                         │
│  ───────────────                                                         │
│  Backdrop: opacity 0 → 0.5 (200ms)                                       │
│  Content: scale(0.95) → scale(1), opacity 0 → 1 (250ms)                  │
│  Exit: reverse of entry (200ms)                                          │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  SKELETON LOADING                                                        │
│  ────────────────                                                        │
│  Shimmer: Linear gradient sweep left-to-right                            │
│  Duration: 1.5s, infinite loop                                           │
│  Colors: gray-200 → gray-100 → gray-200                                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```text
frontend/src/components/workshop/
├── animations/
│   ├── FadeTransition.tsx      # Fade in/out wrapper
│   ├── SlideTransition.tsx     # Slide in/out wrapper
│   ├── ScaleTransition.tsx     # Scale in/out wrapper
│   ├── CollapseTransition.tsx  # Height collapse animation
│   └── AnimatePresence.tsx     # Exit animation wrapper (Framer Motion)
├── skeletons/
│   ├── PreviewSkeleton.tsx     # PDF preview loading state
│   ├── ScoreSkeleton.tsx       # Score gauge loading state
│   ├── SuggestionSkeleton.tsx  # Suggestion card loading state
│   ├── EditorSkeleton.tsx      # Section editor loading state
│   └── PanelSkeleton.tsx       # Generic panel loading state
├── hooks/
│   ├── useUndoRedo.ts          # History stack management
│   ├── useKeyboardShortcuts.ts # Global shortcut handler
│   ├── useAnimatedNumber.ts    # Counting number animation
│   └── useReducedMotion.ts     # Respect prefers-reduced-motion
├── KeyboardShortcutHelp.tsx    # Modal listing all shortcuts
└── ScoreGauge.tsx              # Animated score visualization
```

---

## Interfaces

```typescript
// frontend/src/components/workshop/hooks/useUndoRedo.ts

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  description: string; // Human-readable action description
}

export interface UndoRedoState<T> {
  history: HistoryEntry<T>[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}

export interface UndoRedoActions<T> {
  pushState: (state: T, description: string) => void;
  undo: () => T | null;
  redo: () => T | null;
  clear: () => void;
  getCurrentState: () => T | null;
}

export type UseUndoRedoReturn<T> = UndoRedoState<T> & UndoRedoActions<T>;

// Configuration
export const HISTORY_LIMIT = 50;
```

```typescript
// frontend/src/components/workshop/hooks/useKeyboardShortcuts.ts

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
```

```typescript
// frontend/src/components/workshop/KeyboardShortcutHelp.tsx

export interface KeyboardShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}
```

```typescript
// frontend/src/components/workshop/animations/types.ts

export interface TransitionProps {
  children: React.ReactNode;
  show: boolean;
  duration?: number;
  delay?: number;
  onExitComplete?: () => void;
}

export interface FadeTransitionProps extends TransitionProps {
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export interface ScaleTransitionProps extends TransitionProps {
  initialScale?: number;
  originX?: number;
  originY?: number;
}

export interface CollapseTransitionProps extends TransitionProps {
  preserveWidth?: boolean;
}
```

```typescript
// frontend/src/components/workshop/skeletons/types.ts

export interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export interface PreviewSkeletonProps extends SkeletonProps {
  aspectRatio?: "letter" | "a4";
}

export interface SuggestionSkeletonProps extends SkeletonProps {
  count?: number;
}
```

```typescript
// frontend/src/components/workshop/ScoreGauge.tsx

export interface ScoreGaugeProps {
  score: number;
  previousScore?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showDelta?: boolean;
  animate?: boolean;
}
```

---

## Implementation Details

### 1. useUndoRedo.ts (History Stack Hook)

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import type { HistoryEntry, UseUndoRedoReturn } from "./types";

const HISTORY_LIMIT = 50;

export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [history, setHistory] = useState<HistoryEntry<T>[]>([
    {
      state: initialState,
      timestamp: Date.now(),
      description: "Initial state",
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);

  const pushState = useCallback((state: T, description: string) => {
    // Don't push state if we're undoing/redoing
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    setHistory((prev) => {
      // Remove any redo states (everything after current index)
      const newHistory = prev.slice(0, currentIndex + 1);

      // Add new state
      newHistory.push({
        state,
        timestamp: Date.now(),
        description,
      });

      // Trim to limit
      if (newHistory.length > HISTORY_LIMIT) {
        return newHistory.slice(-HISTORY_LIMIT);
      }

      return newHistory;
    });

    setCurrentIndex((prev) => Math.min(prev + 1, HISTORY_LIMIT - 1));
  }, [currentIndex]);

  const undo = useCallback((): T | null => {
    if (currentIndex <= 0) return null;

    isUndoRedoRef.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex].state;
  }, [currentIndex, history]);

  const redo = useCallback((): T | null => {
    if (currentIndex >= history.length - 1) return null;

    isUndoRedoRef.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex].state;
  }, [currentIndex, history]);

  const clear = useCallback(() => {
    const currentState = history[currentIndex]?.state;
    if (currentState) {
      setHistory([{
        state: currentState,
        timestamp: Date.now(),
        description: "History cleared",
      }]);
      setCurrentIndex(0);
    }
  }, [history, currentIndex]);

  const getCurrentState = useCallback((): T | null => {
    return history[currentIndex]?.state ?? null;
  }, [history, currentIndex]);

  return {
    history,
    currentIndex,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    pushState,
    undo,
    redo,
    clear,
    getCurrentState,
  };
}
```

### 2. useKeyboardShortcuts.ts (Global Shortcut Handler)

```typescript
"use client";

import { useEffect, useCallback, useRef } from "react";
import type { KeyboardShortcut, UseKeyboardShortcutsOptions } from "./types";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
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

// Helper to format shortcut for display
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
  const keyDisplay = {
    escape: isMac ? "Esc" : "Esc",
    enter: isMac ? "↵" : "Enter",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    tab: "Tab",
    " ": "Space",
  }[key.toLowerCase()] || key.toUpperCase();

  parts.push(keyDisplay);

  return parts.join(isMac ? "" : "+");
}
```

### 3. KeyboardShortcutHelp.tsx

```typescript
"use client";

import { Fragment, useEffect } from "react";
import { formatShortcut } from "./hooks/useKeyboardShortcuts";
import type { ShortcutGroup } from "./hooks/useKeyboardShortcuts";

interface KeyboardShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
}

export function KeyboardShortcutHelp({
  isOpen,
  onClose,
  groups,
}: KeyboardShortcutHelpProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-8">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-700">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded text-gray-600">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t text-center">
          <span className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 font-mono bg-gray-200 rounded text-gray-600">?</kbd> to toggle this panel
          </span>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
```

### 4. useAnimatedNumber.ts

```typescript
"use client";

import { useState, useEffect, useRef } from "react";

interface UseAnimatedNumberOptions {
  duration?: number;
  easing?: (t: number) => number;
  decimals?: number;
}

// Easing function: ease-out cubic
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 500, easing = easeOutCubic, decimals = 0 } = options;

  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValueRef = useRef(targetValue);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const startValue = previousValueRef.current;
    const delta = targetValue - startValue;

    // Skip animation if no change
    if (delta === 0) return;

    // Skip animation if user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentValue = startValue + delta * easedProgress;
      const rounded = Number(currentValue.toFixed(decimals));
      setDisplayValue(rounded);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = targetValue;
        startTimeRef.current = undefined;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [targetValue, duration, easing, decimals]);

  return displayValue;
}
```

### 5. ScoreGauge.tsx (Animated Score Component)

```typescript
"use client";

import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { useReducedMotion } from "./hooks/useReducedMotion";

interface ScoreGaugeProps {
  score: number;
  previousScore?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showDelta?: boolean;
  animate?: boolean;
}

const sizeClasses = {
  sm: { container: "h-2", text: "text-lg", delta: "text-xs" },
  md: { container: "h-3", text: "text-2xl", delta: "text-sm" },
  lg: { container: "h-4", text: "text-4xl", delta: "text-base" },
};

function getScoreColor(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-yellow-500";
  if (score >= 50) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 85) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

export function ScoreGauge({
  score,
  previousScore,
  size = "md",
  showLabel = true,
  showDelta = true,
  animate = true,
}: ScoreGaugeProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  const displayScore = useAnimatedNumber(score, {
    duration: shouldAnimate ? 600 : 0,
    decimals: 0,
  });

  const delta = previousScore !== undefined ? score - previousScore : 0;
  const classes = sizeClasses[size];

  return (
    <div className="space-y-2">
      {/* Score Number + Delta */}
      <div className="flex items-baseline gap-2">
        <span className={`font-bold ${classes.text} ${getScoreTextColor(displayScore)}`}>
          {displayScore}%
        </span>
        {showDelta && delta !== 0 && (
          <span
            className={`font-medium ${classes.delta} ${
              delta > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${classes.container}`}>
        <div
          className={`h-full rounded-full transition-all ${getScoreColor(displayScore)}`}
          style={{
            width: `${displayScore}%`,
            transitionDuration: shouldAnimate ? "600ms" : "0ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <p className="text-sm text-gray-500">
          {displayScore >= 85
            ? "Excellent match"
            : displayScore >= 70
            ? "Good match"
            : displayScore >= 50
            ? "Fair match"
            : "Needs improvement"}
        </p>
      )}
    </div>
  );
}
```

### 6. FadeTransition.tsx (Animation Wrapper)

```typescript
"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { FadeTransitionProps } from "./types";
import { useReducedMotion } from "../hooks/useReducedMotion";

const directionOffset = {
  up: { y: -8, x: 0 },
  down: { y: 8, x: 0 },
  left: { x: -8, y: 0 },
  right: { x: 8, y: 0 },
  none: { x: 0, y: 0 },
};

export function FadeTransition({
  children,
  show,
  duration = 200,
  delay = 0,
  direction = "none",
  distance = 8,
  onExitComplete,
}: FadeTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return show ? <>{children}</> : null;
  }

  const offset = directionOffset[direction];
  const scaledOffset = {
    x: offset.x ? (offset.x / 8) * distance : 0,
    y: offset.y ? (offset.y / 8) * distance : 0,
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, ...scaledOffset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...scaledOffset }}
          transition={{
            duration: duration / 1000,
            delay: delay / 1000,
            ease: "easeOut",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 7. SuggestionSkeleton.tsx

```typescript
"use client";

interface SuggestionSkeletonProps {
  count?: number;
  className?: string;
}

export function SuggestionSkeleton({
  count = 3,
  className = "",
}: SuggestionSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border rounded-lg p-4 animate-pulse"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-200 rounded-full" />
              <div className="w-24 h-4 bg-gray-200 rounded" />
            </div>
            <div className="w-16 h-6 bg-gray-200 rounded-full" />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="w-full h-4 bg-gray-200 rounded" />
            <div className="w-3/4 h-4 bg-gray-200 rounded" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <div className="w-20 h-8 bg-gray-200 rounded" />
            <div className="w-20 h-8 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 8. PreviewSkeleton.tsx

```typescript
"use client";

interface PreviewSkeletonProps {
  aspectRatio?: "letter" | "a4";
  className?: string;
}

export function PreviewSkeleton({
  aspectRatio = "letter",
  className = "",
}: PreviewSkeletonProps) {
  const ratio = aspectRatio === "letter" ? "aspect-[8.5/11]" : "aspect-[1/1.414]";

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm overflow-hidden ${ratio} ${className}`}
    >
      <div className="p-8 h-full animate-pulse">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-48 h-6 bg-gray-200 rounded mx-auto mb-2" />
          <div className="w-32 h-4 bg-gray-200 rounded mx-auto" />
        </div>

        {/* Contact Info */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-24 h-3 bg-gray-200 rounded" />
        </div>

        {/* Sections */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="mb-6">
            <div className="w-20 h-4 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="w-full h-3 bg-gray-200 rounded" />
              <div className="w-full h-3 bg-gray-200 rounded" />
              <div className="w-3/4 h-3 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 9. useReducedMotion.ts

```typescript
"use client";

import { useState, useEffect } from "react";

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}
```

---

## Integration Points

### 1. Workshop Context Integration

```typescript
// frontend/src/components/workshop/WorkshopContext.tsx

import { useUndoRedo } from "./hooks/useUndoRedo";

// Add to context
const {
  canUndo,
  canRedo,
  pushState,
  undo,
  redo,
} = useUndoRedo<WorkshopState>(initialState);

// Expose in context value
const contextValue = {
  ...existingContext,
  canUndo,
  canRedo,
  undo: () => {
    const prevState = undo();
    if (prevState) setState(prevState);
  },
  redo: () => {
    const nextState = redo();
    if (nextState) setState(nextState);
  },
};

// Call pushState when state changes (debounced)
useEffect(() => {
  const timeout = setTimeout(() => {
    pushState(state, getActionDescription(state));
  }, 500);
  return () => clearTimeout(timeout);
}, [state]);
```

### 2. Global Shortcuts Registration

```typescript
// frontend/src/components/workshop/WorkshopLayout.tsx

import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { KeyboardShortcutHelp } from "./KeyboardShortcutHelp";

function WorkshopLayout() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { undo, redo, canUndo, canRedo } = useWorkshop();

  const shortcuts = [
    // General
    {
      key: "?",
      action: () => setShowShortcuts(true),
      description: "Show keyboard shortcuts",
      category: "general",
    },
    {
      key: "z",
      modifiers: ["cmd"],
      action: undo,
      description: "Undo",
      category: "general",
      enabled: () => canUndo,
    },
    {
      key: "z",
      modifiers: ["cmd", "shift"],
      action: redo,
      description: "Redo",
      category: "general",
      enabled: () => canRedo,
    },
    // Navigation
    {
      key: "1",
      action: () => setActiveTab("overview"),
      description: "Overview tab",
      category: "navigation",
    },
    {
      key: "2",
      action: () => setActiveTab("suggestions"),
      description: "Suggestions tab",
      category: "navigation",
    },
    // ... more shortcuts
  ];

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      {/* Workshop content */}
      <KeyboardShortcutHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        groups={groupShortcuts(shortcuts)}
      />
    </>
  );
}
```

### 3. Tab Transition Wrapper

```typescript
// frontend/src/components/workshop/WorkshopTabs.tsx

import { FadeTransition } from "./animations/FadeTransition";

function TabContent({ activeTab }: { activeTab: string }) {
  return (
    <div className="relative">
      <FadeTransition show={activeTab === "overview"} direction="right">
        <OverviewPanel />
      </FadeTransition>

      <FadeTransition show={activeTab === "suggestions"} direction="right">
        <SuggestionsPanel />
      </FadeTransition>

      <FadeTransition show={activeTab === "editor"} direction="right">
        <EditorPanel />
      </FadeTransition>

      <FadeTransition show={activeTab === "style"} direction="right">
        <StylePanel />
      </FadeTransition>
    </div>
  );
}
```

---

## Visual Regression Testing

### PDF Export vs Preview Comparison

```typescript
// tests/visual/pdf-export.spec.ts

import { test, expect } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

test.describe("PDF Export Visual Regression", () => {
  test("exported PDF matches preview appearance", async ({ page }) => {
    // Navigate to workshop
    await page.goto("/dashboard/workshop/test-resume");

    // Wait for preview to load
    await page.waitForSelector('[data-testid="pdf-preview"]');

    // Screenshot the preview
    const previewElement = page.locator('[data-testid="pdf-preview"]');
    const previewScreenshot = await previewElement.screenshot();

    // Trigger PDF export
    await page.click('[data-testid="export-pdf"]');

    // Wait for export to complete
    const downloadPromise = page.waitForEvent("download");
    const download = await downloadPromise;
    const pdfPath = await download.path();

    // Convert PDF first page to image (using pdf-to-img or similar)
    const pdfImage = await convertPdfToImage(pdfPath);

    // Compare images using pixelmatch
    const preview = PNG.sync.read(previewScreenshot);
    const exported = PNG.sync.read(pdfImage);

    const diff = new PNG({ width: preview.width, height: preview.height });
    const mismatchedPixels = pixelmatch(
      preview.data,
      exported.data,
      diff.data,
      preview.width,
      preview.height,
      { threshold: 0.1 }
    );

    // Allow up to 1% pixel difference (fonts may render slightly differently)
    const totalPixels = preview.width * preview.height;
    const mismatchPercentage = (mismatchedPixels / totalPixels) * 100;

    expect(mismatchPercentage).toBeLessThan(1);
  });

  test("style changes reflect in both preview and export", async ({ page }) => {
    await page.goto("/dashboard/workshop/test-resume");

    // Change font
    await page.click('[data-testid="style-tab"]');
    await page.selectOption('[data-testid="font-select"]', "Georgia");

    // Wait for preview update
    await page.waitForTimeout(500);

    // Screenshot preview
    const previewWithNewFont = await page.locator('[data-testid="pdf-preview"]').screenshot();

    // Export and compare
    await page.click('[data-testid="export-pdf"]');
    const download = await page.waitForEvent("download");
    const pdfPath = await download.path();
    const pdfImage = await convertPdfToImage(pdfPath);

    // Visual comparison
    const preview = PNG.sync.read(previewWithNewFont);
    const exported = PNG.sync.read(pdfImage);

    // Ensure both show the new font (font metrics should match)
    const mismatchedPixels = pixelmatch(
      preview.data,
      exported.data,
      null,
      preview.width,
      preview.height,
      { threshold: 0.1 }
    );

    const totalPixels = preview.width * preview.height;
    const mismatchPercentage = (mismatchedPixels / totalPixels) * 100;

    expect(mismatchPercentage).toBeLessThan(1);
  });
});
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/useUndoRedo.spec.ts

describe("useUndoRedo", () => {
  test("initializes with initial state", () => {
    const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

    expect(result.current.getCurrentState()).toEqual({ text: "initial" });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  test("pushes state and enables undo", () => {
    const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

    act(() => {
      result.current.pushState({ text: "modified" }, "Edit text");
    });

    expect(result.current.getCurrentState()).toEqual({ text: "modified" });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  test("undo restores previous state", () => {
    const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

    act(() => {
      result.current.pushState({ text: "modified" }, "Edit text");
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.getCurrentState()).toEqual({ text: "initial" });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  test("redo restores undone state", () => {
    const { result } = renderHook(() => useUndoRedo({ text: "initial" }));

    act(() => {
      result.current.pushState({ text: "modified" }, "Edit text");
      result.current.undo();
      result.current.redo();
    });

    expect(result.current.getCurrentState()).toEqual({ text: "modified" });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  test("respects history limit", () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));

    // Push 60 states (limit is 50)
    for (let i = 1; i <= 60; i++) {
      act(() => {
        result.current.pushState({ count: i }, `Set count to ${i}`);
      });
    }

    expect(result.current.history.length).toBe(50);

    // Undo all the way should stop at the oldest retained state
    for (let i = 0; i < 60; i++) {
      act(() => {
        result.current.undo();
      });
    }

    expect(result.current.getCurrentState()?.count).toBeGreaterThan(0);
    expect(result.current.canUndo).toBe(false);
  });

  test("clears redo history on new push", () => {
    const { result } = renderHook(() => useUndoRedo({ text: "a" }));

    act(() => {
      result.current.pushState({ text: "b" }, "Set b");
      result.current.pushState({ text: "c" }, "Set c");
      result.current.undo(); // At b
      result.current.pushState({ text: "d" }, "Set d"); // Should clear c
    });

    expect(result.current.getCurrentState()).toEqual({ text: "d" });
    expect(result.current.canRedo).toBe(false);
  });
});
```

### Integration Tests

```typescript
// tests/integration/keyboard-shortcuts.spec.ts

describe("Keyboard Shortcuts", () => {
  test("? opens shortcuts help modal", async () => {
    render(<WorkshopLayout tailoredId="123" />);

    await userEvent.keyboard("?");

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  test("Escape closes shortcuts help modal", async () => {
    render(<WorkshopLayout tailoredId="123" />);

    await userEvent.keyboard("?");
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  test("number keys switch tabs", async () => {
    render(<WorkshopLayout tailoredId="123" />);

    await userEvent.keyboard("2");
    expect(screen.getByRole("tab", { name: "Suggestions" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await userEvent.keyboard("3");
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("Cmd/Ctrl+Z triggers undo", async () => {
    render(<WorkshopLayout tailoredId="123" />);

    // Make a change
    await userEvent.click(screen.getByTestId("accept-suggestion"));

    // Undo
    await userEvent.keyboard("{Meta>}z{/Meta}");

    // Verify change was undone (suggestion should reappear)
    expect(screen.getByTestId("suggestion-card")).toBeInTheDocument();
  });

  test("shortcuts disabled when typing in input", async () => {
    render(<WorkshopLayout tailoredId="123" />);

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.click(input);
    await userEvent.keyboard("2");

    // Tab should NOT have changed
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
```

### Animation Tests

```typescript
// tests/components/ScoreGauge.spec.tsx

describe("ScoreGauge", () => {
  test("renders score value", () => {
    render(<ScoreGauge score={75} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  test("shows positive delta when score increases", () => {
    render(<ScoreGauge score={80} previousScore={70} showDelta />);

    expect(screen.getByText("+10")).toBeInTheDocument();
  });

  test("shows negative delta when score decreases", () => {
    render(<ScoreGauge score={60} previousScore={70} showDelta />);

    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  test("applies correct color class based on score", () => {
    const { rerender } = render(<ScoreGauge score={90} />);
    expect(screen.getByText("Excellent match")).toBeInTheDocument();

    rerender(<ScoreGauge score={75} />);
    expect(screen.getByText("Good match")).toBeInTheDocument();

    rerender(<ScoreGauge score={55} />);
    expect(screen.getByText("Fair match")).toBeInTheDocument();

    rerender(<ScoreGauge score={40} />);
    expect(screen.getByText("Needs improvement")).toBeInTheDocument();
  });

  test("respects prefers-reduced-motion", async () => {
    // Mock reduced motion preference
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    render(<ScoreGauge score={80} previousScore={60} />);

    // Should immediately show final value without animation
    expect(screen.getByText("80%")).toBeInTheDocument();
  });
});
```

---

## Accessibility Considerations

### Reduced Motion Support

All animations must respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Keyboard Navigation

- All shortcuts must have visual alternatives (buttons)
- Focus indicators must remain visible during animations
- Tab order must follow logical reading order
- Escape key should always close modals

### Screen Reader Support

- Announce undo/redo actions with aria-live
- Announce score changes with aria-live="polite"
- Shortcuts modal should trap focus
- Loading skeletons should have aria-busy="true"

```typescript
// Announce undo/redo
<div aria-live="polite" className="sr-only">
  {lastAction === "undo" && "Action undone"}
  {lastAction === "redo" && "Action redone"}
</div>
```

---

## Performance Considerations

### Animation Performance

- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, or `top/left`
- Use `will-change` sparingly and only during animation
- Cancel animations on unmount to prevent memory leaks

### History Stack Optimization

- Debounce state pushes (500ms) to avoid excessive history entries
- Store minimal state diffs if possible for large documents
- Clear very old entries (beyond limit) to prevent memory growth
- Consider compression for large state objects

---

## Acceptance Criteria

- [ ] Undo/redo works correctly with 50-entry history limit
- [ ] Cmd/Ctrl+Z undoes last action
- [ ] Cmd/Ctrl+Shift+Z redoes last undone action
- [ ] History clears redo branch on new change
- [ ] ? opens keyboard shortcuts help modal
- [ ] Escape closes any open modal
- [ ] Number keys (1-4) switch between tabs
- [ ] Tab transitions animate smoothly (200ms fade+slide)
- [ ] Score gauge animates number counting (600ms)
- [ ] Score bar fill animates smoothly
- [ ] Suggestion accept shows green flash + slide out
- [ ] Suggestion reject shows red flash + shake + slide out
- [ ] Loading skeletons show shimmer animation
- [ ] All animations respect prefers-reduced-motion
- [ ] PDF export visually matches preview (< 1% pixel diff)
- [ ] Keyboard shortcuts disabled when typing in inputs
- [ ] Focus management works correctly with animations
- [ ] Screen reader announcements for undo/redo

---

## Dependencies

### New Package Required

```bash
bun add framer-motion
```

### Optional Testing Dependencies

```bash
bun add -D pixelmatch pngjs pdf-to-img
```

---

## Handoff Notes

**Files to reference:**
- `WorkshopContext.tsx` - State management (add undo/redo integration)
- `WorkshopLayout.tsx` - Main layout (register shortcuts)
- `WorkshopTabs.tsx` - Tab navigation (add transitions)
- `SuggestionCard.tsx` - Accept/reject buttons (add animations)
- `ScorePanel.tsx` - Score display (replace with ScoreGauge)

**Animation patterns:**
```typescript
// Framer Motion usage
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence>
  {show && (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

**Shortcut registration pattern:**
```typescript
const shortcuts = [
  { key: "z", modifiers: ["cmd"], action: undo, ... },
];
useKeyboardShortcuts(shortcuts);
```

---

## Phase Order Reference

A (PDF Preview) → B (Layout) → C-D (Score + Tabs) → E (AI Rewrite) → F (Editor) → G (Style) → H (Score Updates) → I (Wizard) → **J (Polish)** → Production Deployment
