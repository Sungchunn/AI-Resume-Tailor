"use client";

import { useState, useEffect, useRef } from "react";

interface UseAnimatedNumberOptions {
  duration?: number;
  easing?: (t: number) => number;
  decimals?: number;
}

// Easing function: ease-out cubic
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Hook to animate a number from its previous value to a target value.
 * Respects prefers-reduced-motion.
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 500, easing = easeOutCubic, decimals = 0 } = options;

  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValueRef = useRef(targetValue);
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const delta = targetValue - startValue;

    // Skip animation if no change
    if (delta === 0) return;

    // Skip animation if user prefers reduced motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === undefined) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - (startTimeRef.current ?? timestamp);
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
