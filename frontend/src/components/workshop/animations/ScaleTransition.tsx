"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ScaleTransitionProps } from "./types";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * Scale transition wrapper for zoom-in/out animations.
 * Respects prefers-reduced-motion.
 */
export function ScaleTransition({
  children,
  show,
  duration = 200,
  delay = 0,
  initialScale = 0.95,
  originX = 0.5,
  originY = 0.5,
  onExitComplete,
}: ScaleTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return show ? <>{children}</> : null;
  }

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: initialScale }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: initialScale }}
          transition={{
            duration: duration / 1000,
            delay: delay / 1000,
            ease: "easeOut",
          }}
          style={{
            transformOrigin: `${originX * 100}% ${originY * 100}%`,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
