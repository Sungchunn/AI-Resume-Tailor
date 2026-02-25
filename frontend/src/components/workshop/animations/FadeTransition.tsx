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

/**
 * Fade transition wrapper with optional directional slide.
 * Respects prefers-reduced-motion.
 */
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
