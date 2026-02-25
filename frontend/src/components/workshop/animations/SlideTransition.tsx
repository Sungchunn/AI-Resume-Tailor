"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SlideTransitionProps } from "./types";
import { useReducedMotion } from "../hooks/useReducedMotion";

const directionValues = {
  up: { initial: { y: 20 }, exit: { y: -20 } },
  down: { initial: { y: -20 }, exit: { y: 20 } },
  left: { initial: { x: 20 }, exit: { x: -20 } },
  right: { initial: { x: -20 }, exit: { x: 20 } },
};

/**
 * Slide transition wrapper for directional animations.
 * Respects prefers-reduced-motion.
 */
export function SlideTransition({
  children,
  show,
  duration = 200,
  delay = 0,
  direction = "right",
  distance = 20,
  onExitComplete,
}: SlideTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return show ? <>{children}</> : null;
  }

  const baseValues = directionValues[direction];
  const scale = distance / 20;

  const initialOffset =
    "x" in baseValues.initial
      ? { x: baseValues.initial.x * scale }
      : { y: baseValues.initial.y * scale };

  const exitOffset =
    "x" in baseValues.exit
      ? { x: baseValues.exit.x * scale }
      : { y: baseValues.exit.y * scale };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, ...initialOffset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...exitOffset }}
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
