"use client";

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type { ComputedPreviewStyle } from "./types";
import { BlockRenderer } from "./BlockRenderer";

interface InteractiveBlockRendererProps {
  block: AnyResumeBlock;
  style: ComputedPreviewStyle;
  isActive?: boolean;
  isHovered?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect?: () => void;
  onHover?: (isHovered: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * InteractiveBlockRenderer - Wrapper component that adds hover interactions
 *
 * Features:
 * - Dashed selection box on hover
 * - Up/down move arrows on hover (left edge)
 * - Click to select (syncs with Section Dragger tab)
 */
export function InteractiveBlockRenderer({
  block,
  style,
  isActive = false,
  isHovered = false,
  canMoveUp,
  canMoveDown,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
}: InteractiveBlockRendererProps) {
  // Local hover state for immediate visual feedback
  const [localHover, setLocalHover] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setLocalHover(true);
    onHover?.(true);
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    setLocalHover(false);
    onHover?.(false);
  }, [onHover]);

  const handleMoveUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMoveUp?.();
    },
    [onMoveUp]
  );

  const handleMoveDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMoveDown?.();
    },
    [onMoveDown]
  );

  const showHoverControls = localHover || isHovered;

  const wrapperClasses = [
    "relative group transition-all duration-150",
    showHoverControls && !isActive ? "ring-2 ring-dashed ring-primary/50" : "",
    isActive ? "ring-2 ring-primary" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={wrapperClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onSelect}
      style={{ marginBottom: style.sectionGap }}
    >
      {/* Move controls - appear on left edge when hovered */}
      {showHoverControls && (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={handleMoveUp}
            disabled={!canMoveUp}
            className="p-1 rounded bg-card border border-border shadow-sm hover:bg-accent hover:border-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-card"
            title="Move section up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMoveDown}
            disabled={!canMoveDown}
            className="p-1 rounded bg-card border border-border shadow-sm hover:bg-accent hover:border-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-card"
            title="Move section down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Actual block content - we don't pass onClick since we handle it on the wrapper */}
      <BlockRenderer
        block={block}
        style={style}
        isActive={isActive}
      />
    </div>
  );
}
