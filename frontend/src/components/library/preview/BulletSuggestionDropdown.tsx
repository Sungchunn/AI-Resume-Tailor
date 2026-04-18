"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown, Check, X } from "lucide-react";

import {
  useCurrentQueueSuggestion,
  useQueueProgress,
  useIsInlineReviewActive,
  useInlineSuggestionQueueStore,
} from "@/lib/stores/inlineSuggestionQueueStore";
import { analysisBulletIdToElementId } from "@/lib/resume/bulletIdMapping";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useInlineSuggestionQueueContext } from "@/components/library/editor/InlineSuggestionQueueProvider";
import type { AnyResumeBlock } from "@/lib/resume/types";

interface BulletSuggestionDropdownProps {
  portalTarget: HTMLDivElement | null;
  containerRef: HTMLDivElement | null;
  blocks: AnyResumeBlock[];
  scrollContainerRef?: HTMLDivElement | null;
}

const IMPACT_COLORS = {
  high: "bg-red-500/10 text-red-400 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
} as const;

export function BulletSuggestionDropdown({
  portalTarget,
  containerRef,
  blocks,
  scrollContainerRef,
}: BulletSuggestionDropdownProps) {
  const isActive = useIsInlineReviewActive();
  const suggestion = useCurrentQueueSuggestion();
  const progress = useQueueProgress();
  const requestFastForward = useInlineSuggestionQueueStore(
    (s) => s.requestFastForward
  );
  const setRequestFastForward = useInlineSuggestionQueueStore(
    (s) => s.setRequestFastForward
  );
  const setTypewriterDone = useInlineSuggestionQueueStore(
    (s) => s.setTypewriterDone
  );
  const dismissCurrent = useInlineSuggestionQueueStore(
    (s) => s.dismissCurrent
  );
  const { acceptCurrent } = useInlineSuggestionQueueContext();

  const { displayText, isDone, fastForward } = useTypewriter(
    suggestion?.suggested ?? ""
  );

  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Bridge: fast-forward request from keyboard hook
  useEffect(() => {
    if (requestFastForward) {
      fastForward();
      setRequestFastForward(false);
    }
  }, [requestFastForward, fastForward, setRequestFastForward]);

  // Report typewriter completion back to store so keyboard hook knows when to accept
  useEffect(() => {
    setTypewriterDone(isDone);
  }, [isDone, setTypewriterDone]);

  // Compute position based on target bullet element
  const updatePosition = useCallback(() => {
    if (!suggestion || !containerRef) {
      setPosition(null);
      return;
    }

    const elementId = analysisBulletIdToElementId(
      suggestion.bulletId,
      blocks
    );
    if (!elementId) {
      setPosition(null);
      return;
    }

    const bulletEl = containerRef.querySelector(
      `[data-bullet-element-id="${CSS.escape(elementId)}"]`
    );
    if (!bulletEl) {
      setPosition(null);
      return;
    }

    // getBoundingClientRect returns screen-space coords that account for CSS transforms.
    // Since portalLayer is a sibling of pagesWrapper (not inside it), the subtraction
    // of containerRect from bulletRect cancels out correctly at any scale.
    const bulletRect = bulletEl.getBoundingClientRect();
    const containerRect = containerRef.getBoundingClientRect();

    setPosition({
      top: bulletRect.bottom - containerRect.top + 4,
      left: bulletRect.left - containerRect.left,
      width: bulletRect.width,
    });
  }, [suggestion, containerRef, blocks]);

  // Update position when suggestion changes
  useEffect(() => {
    if (!isActive || !suggestion) {
      setPosition(null);
      setIsVisible(false);
      return;
    }

    requestAnimationFrame(() => {
      updatePosition();
      setIsVisible(true);
    });
  }, [isActive, suggestion, updatePosition]);

  // Scroll handling: hide during scroll, reposition after idle
  useEffect(() => {
    const scrollEl = scrollContainerRef;
    if (!scrollEl) return;

    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
        requestAnimationFrame(updatePosition);
      }, 200);
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollContainerRef, updatePosition]);

  if (!isActive || !suggestion || !portalTarget || !position) return null;

  const impactColor = IMPACT_COLORS[suggestion.impact];

  return createPortal(
    <div
      ref={dropdownRef}
      data-print-hidden="true"
      data-no-export="true"
      className={`transition-all duration-200 ${isVisible && !isScrolling ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: Math.max(position.width, 320),
        pointerEvents: "auto",
        zIndex: 50,
      }}
    >
      <div className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-700/50 border-b border-zinc-600">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${impactColor}`}
            >
              {suggestion.impact}
            </span>
            <span className="text-xs text-zinc-400">
              {progress.reviewed + 1} of {progress.total}
            </span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            {suggestion.keywordsAdded.length > 0 && (
              <span className="text-[10px] text-emerald-400">
                +{suggestion.keywordsAdded.length} keywords
              </span>
            )}
          </div>
        </div>

        {/* Current (original) bullet text */}
        <div className="px-3 pt-2 pb-1.5 border-b border-zinc-700/50">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
            Current
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed line-through">
            {suggestion.original}
          </p>
        </div>

        {/* Suggested text with typewriter effect */}
        <div className="px-3 pt-2 pb-1.5">
          <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide mb-0.5">
            Suggested
          </p>
          <p className="text-sm text-zinc-200 leading-relaxed">
            {displayText}
            {!isDone && (
              <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />
            )}
          </p>
        </div>

        {/* Reason - fades in after typing completes */}
        <div
          className={`px-3 pb-2 transition-opacity duration-300 ${isDone ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-xs text-zinc-400 italic">{suggestion.reason}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              void acceptCurrent();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => {
              dismissCurrent();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-700/30 border-t border-zinc-600 text-[10px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-zinc-400 font-mono">
                Tab
              </kbd>
              <span>{isDone ? "Accept" : "Reveal"}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-zinc-400 font-mono">
                Esc
              </kbd>
              <span>Skip</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              <span>Navigate</span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
