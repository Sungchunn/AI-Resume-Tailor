/**
 * useBulletNavigation - Keyboard-driven bullet point navigation hook
 *
 * Manages focus state for bullet points within experience entries and
 * handles arrow key navigation between bullets.
 */

import { useState, useCallback, useMemo } from "react";

export interface BulletFocusState {
  entryIndex: number | null;
  bulletIndex: number | null;
}

interface ExperienceEntry {
  bullets: string[];
}

interface UseBulletNavigationOptions {
  entries: ExperienceEntry[];
  onFocusChange?: (focus: BulletFocusState) => void;
}

interface UseBulletNavigationReturn {
  focusedBullet: BulletFocusState;
  setFocusedBullet: (focus: BulletFocusState) => void;
  focusOnBullet: (entryIndex: number, bulletIndex: number) => void;
  clearFocus: () => void;
  moveToNextBullet: () => void;
  moveToPrevBullet: () => void;
  isFocused: (entryIndex: number, bulletIndex: number) => boolean;
  getFocusedBulletText: () => string | null;
  totalBulletCount: number;
}

export function useBulletNavigation({
  entries,
  onFocusChange,
}: UseBulletNavigationOptions): UseBulletNavigationReturn {
  const [focusedBullet, setFocusedBulletState] = useState<BulletFocusState>({
    entryIndex: null,
    bulletIndex: null,
  });

  // Compute flat list of all bullets for navigation
  const bulletMap = useMemo(() => {
    const map: Array<{ entryIndex: number; bulletIndex: number }> = [];
    entries.forEach((entry, entryIndex) => {
      entry.bullets.forEach((_, bulletIndex) => {
        map.push({ entryIndex, bulletIndex });
      });
    });
    return map;
  }, [entries]);

  const totalBulletCount = bulletMap.length;

  const setFocusedBullet = useCallback(
    (focus: BulletFocusState) => {
      setFocusedBulletState(focus);
      onFocusChange?.(focus);
    },
    [onFocusChange]
  );

  const focusOnBullet = useCallback(
    (entryIndex: number, bulletIndex: number) => {
      // Validate indices
      if (
        entryIndex >= 0 &&
        entryIndex < entries.length &&
        bulletIndex >= 0 &&
        bulletIndex < entries[entryIndex].bullets.length
      ) {
        setFocusedBullet({ entryIndex, bulletIndex });
      }
    },
    [entries, setFocusedBullet]
  );

  const clearFocus = useCallback(() => {
    setFocusedBullet({ entryIndex: null, bulletIndex: null });
  }, [setFocusedBullet]);

  const getCurrentFlatIndex = useCallback(() => {
    if (focusedBullet.entryIndex === null || focusedBullet.bulletIndex === null) {
      return -1;
    }
    return bulletMap.findIndex(
      (b) =>
        b.entryIndex === focusedBullet.entryIndex &&
        b.bulletIndex === focusedBullet.bulletIndex
    );
  }, [focusedBullet, bulletMap]);

  const moveToNextBullet = useCallback(() => {
    if (bulletMap.length === 0) return;

    const currentIndex = getCurrentFlatIndex();
    let nextIndex: number;

    if (currentIndex === -1) {
      // No current focus, start at the first bullet
      nextIndex = 0;
    } else if (currentIndex >= bulletMap.length - 1) {
      // Already at last bullet, wrap to first
      nextIndex = 0;
    } else {
      // Move to next bullet
      nextIndex = currentIndex + 1;
    }

    const next = bulletMap[nextIndex];
    if (next) {
      setFocusedBullet({ entryIndex: next.entryIndex, bulletIndex: next.bulletIndex });
    }
  }, [bulletMap, getCurrentFlatIndex, setFocusedBullet]);

  const moveToPrevBullet = useCallback(() => {
    if (bulletMap.length === 0) return;

    const currentIndex = getCurrentFlatIndex();
    let prevIndex: number;

    if (currentIndex === -1) {
      // No current focus, start at the last bullet
      prevIndex = bulletMap.length - 1;
    } else if (currentIndex <= 0) {
      // Already at first bullet, wrap to last
      prevIndex = bulletMap.length - 1;
    } else {
      // Move to previous bullet
      prevIndex = currentIndex - 1;
    }

    const prev = bulletMap[prevIndex];
    if (prev) {
      setFocusedBullet({ entryIndex: prev.entryIndex, bulletIndex: prev.bulletIndex });
    }
  }, [bulletMap, getCurrentFlatIndex, setFocusedBullet]);

  const isFocused = useCallback(
    (entryIndex: number, bulletIndex: number) => {
      return (
        focusedBullet.entryIndex === entryIndex &&
        focusedBullet.bulletIndex === bulletIndex
      );
    },
    [focusedBullet]
  );

  const getFocusedBulletText = useCallback(() => {
    if (focusedBullet.entryIndex === null || focusedBullet.bulletIndex === null) {
      return null;
    }
    const entry = entries[focusedBullet.entryIndex];
    if (!entry) return null;
    return entry.bullets[focusedBullet.bulletIndex] ?? null;
  }, [focusedBullet, entries]);

  return {
    focusedBullet,
    setFocusedBullet,
    focusOnBullet,
    clearFocus,
    moveToNextBullet,
    moveToPrevBullet,
    isFocused,
    getFocusedBulletText,
    totalBulletCount,
  };
}
