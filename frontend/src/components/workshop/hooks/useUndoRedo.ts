"use client";

import { useState, useCallback } from "react";

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  description: string;
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

export const HISTORY_LIMIT = 50;

// Internal state type for combined history + index updates
interface HistoryState<T> {
  history: HistoryEntry<T>[];
  currentIndex: number;
}

/**
 * Hook to manage undo/redo history for any state type.
 * Maintains a stack of up to 50 history entries.
 */
export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [state, setState] = useState<HistoryState<T>>({
    history: [
      {
        state: initialState,
        timestamp: Date.now(),
        description: "Initial state",
      },
    ],
    currentIndex: 0,
  });

  const pushState = useCallback((newState: T, description: string) => {
    setState((prev) => {
      // Remove any redo states (everything after current index)
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);

      // Add new state
      newHistory.push({
        state: newState,
        timestamp: Date.now(),
        description,
      });

      // Trim to limit
      const trimmedHistory =
        newHistory.length > HISTORY_LIMIT
          ? newHistory.slice(-HISTORY_LIMIT)
          : newHistory;

      return {
        history: trimmedHistory,
        currentIndex: trimmedHistory.length - 1,
      };
    });
  }, []);

  const undo = useCallback((): T | null => {
    let result: T | null = null;

    setState((prev) => {
      if (prev.currentIndex <= 0) {
        result = null;
        return prev;
      }

      const newIndex = prev.currentIndex - 1;
      result = prev.history[newIndex]?.state ?? null;

      return {
        ...prev,
        currentIndex: newIndex,
      };
    });

    return result;
  }, []);

  const redo = useCallback((): T | null => {
    let result: T | null = null;

    setState((prev) => {
      if (prev.currentIndex >= prev.history.length - 1) {
        result = null;
        return prev;
      }

      const newIndex = prev.currentIndex + 1;
      result = prev.history[newIndex]?.state ?? null;

      return {
        ...prev,
        currentIndex: newIndex,
      };
    });

    return result;
  }, []);

  const clear = useCallback(() => {
    setState((prev) => {
      const currentState = prev.history[prev.currentIndex]?.state;
      if (!currentState) return prev;

      return {
        history: [
          {
            state: currentState,
            timestamp: Date.now(),
            description: "History cleared",
          },
        ],
        currentIndex: 0,
      };
    });
  }, []);

  const getCurrentState = useCallback((): T | null => {
    return state.history[state.currentIndex]?.state ?? null;
  }, [state.history, state.currentIndex]);

  return {
    history: state.history,
    currentIndex: state.currentIndex,
    canUndo: state.currentIndex > 0,
    canRedo: state.currentIndex < state.history.length - 1,
    pushState,
    undo,
    redo,
    clear,
    getCurrentState,
  };
}
