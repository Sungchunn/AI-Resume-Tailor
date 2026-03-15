"use client";

import { useState, useCallback } from "react";
import type { AnyResumeBlock } from "@/lib/resume/types";
import type { ComputedPreviewStyle } from "./types";
import { BlockRenderer } from "./BlockRenderer";

interface InteractiveBlockRendererProps {
  block: AnyResumeBlock;
  style: ComputedPreviewStyle;
  isActive?: boolean;
  isHovered?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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
 * - Click to select (syncs with Section Dragger tab)
 */
export function InteractiveBlockRenderer({
  block,
  style,
  isActive = false,
  isHovered = false,
  onSelect,
  onHover,
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
      <BlockRenderer
        block={block}
        style={style}
        isActive={isActive}
      />
    </div>
  );
}
