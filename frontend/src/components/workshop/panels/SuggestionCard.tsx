"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Suggestion } from "@/lib/api/types";
import { ChevronDownIcon } from "@/components/icons/JobIcons";
import { useReducedMotion } from "../hooks/useReducedMotion";

const IMPACT_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-muted text-foreground/80 border-border",
};

const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  highlights: "Highlights",
};

type AnimationState = "idle" | "accepting" | "rejecting" | "exiting";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
  defaultExpanded?: boolean;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  defaultExpanded = false,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [animationState, setAnimationState] = useState<AnimationState>("idle");
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  // Track whether exit is from accept or reject for direction
  const exitDirectionRef = useRef<"accept" | "reject">("accept");

  const handleAccept = useCallback(() => {
    if (prefersReducedMotion) {
      onAccept();
      return;
    }

    exitDirectionRef.current = "accept";
    setAnimationState("accepting");

    // Animation sequence: flash -> shrink -> exit
    setTimeout(() => {
      setAnimationState("exiting");
      setTimeout(() => {
        setIsVisible(false);
        onAccept();
      }, 150);
    }, 250);
  }, [onAccept, prefersReducedMotion]);

  const handleReject = useCallback(() => {
    if (prefersReducedMotion) {
      onReject();
      return;
    }

    exitDirectionRef.current = "reject";
    setAnimationState("rejecting");

    // Animation sequence: flash -> shake -> exit
    setTimeout(() => {
      setAnimationState("exiting");
      setTimeout(() => {
        setIsVisible(false);
        onReject();
      }, 150);
    }, 250);
  }, [onReject, prefersReducedMotion]);

  if (!isVisible) return null;

  const getExitX = () => {
    return exitDirectionRef.current === "accept" ? 30 : -30;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1, scale: 1, x: 0, height: "auto" }}
          animate={{
            opacity: animationState === "exiting" ? 0 : 1,
            scale: animationState === "accepting" ? 0.98 : 1,
            x:
              animationState === "exiting"
                ? getExitX()
                : animationState === "rejecting"
                  ? [0, -6, 6, -6, 6, -3, 3, 0]
                  : 0,
            backgroundColor:
              animationState === "accepting"
                ? "rgba(34, 197, 94, 0.15)"
                : animationState === "rejecting"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(0, 0, 0, 0)",
          }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
            x: animationState === "rejecting" ? { duration: 0.15 } : undefined,
          }}
          className={`border rounded-lg overflow-hidden ${
            isExpanded ? "border-primary-300 shadow-sm" : "border-border"
          }`}
        >
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-3 bg-muted hover:bg-accent text-left"
            disabled={animationState !== "idle"}
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded bg-muted text-foreground/80 font-medium">
                {SECTION_LABELS[suggestion.section] || suggestion.section}
              </span>
              <span
                className={`px-2 py-0.5 text-xs rounded border ${
                  IMPACT_COLORS[suggestion.impact as keyof typeof IMPACT_COLORS] ||
                  IMPACT_COLORS.low
                }`}
              >
                {suggestion.impact}
              </span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-3">
                  {suggestion.original && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Original
                      </div>
                      <p className="text-sm text-muted-foreground bg-red-50 p-2 rounded border border-red-100 line-through">
                        {suggestion.original}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Suggested
                    </div>
                    <p className="text-sm text-foreground bg-green-50 p-2 rounded border border-green-100">
                      {suggestion.suggested}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Reason
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAccept}
                      disabled={animationState !== "idle"}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={animationState !== "idle"}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-foreground/80 bg-muted hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
