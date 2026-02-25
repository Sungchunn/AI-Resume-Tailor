"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CollapseTransitionProps } from "./types";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * Collapse transition wrapper for height-based show/hide animations.
 * Useful for accordion-like behavior.
 * Respects prefers-reduced-motion.
 */
export function CollapseTransition({
  children,
  show,
  duration = 200,
  delay = 0,
  preserveWidth = true,
  onExitComplete,
}: CollapseTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return show ? <>{children}</> : null;
  }

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            duration: duration / 1000,
            delay: delay / 1000,
            ease: "easeOut",
          }}
          style={{
            overflow: "hidden",
            width: preserveWidth ? "100%" : "auto",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
