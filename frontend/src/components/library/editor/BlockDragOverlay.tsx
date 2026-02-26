"use client";

import { GripVertical, ChevronRight } from "lucide-react";
import { BLOCK_TYPE_INFO } from "@/lib/resume/defaults";
import type { AnyResumeBlock } from "@/lib/resume/types";
import { BlockIcon } from "./BlockIcon";

interface BlockDragOverlayProps {
  block: AnyResumeBlock;
}

/**
 * BlockDragOverlay - Visual representation of a block being dragged
 *
 * Shows a simplified version of the block header while dragging.
 * Used by DndContext's DragOverlay component.
 */
export function BlockDragOverlay({ block }: BlockDragOverlayProps) {
  const blockInfo = BLOCK_TYPE_INFO[block.type];

  return (
    <div
      className="rounded-lg border-2 border-primary/40 bg-primary/10 shadow-xl opacity-95 w-full"
      style={{
        // Match the width of the original item
        minWidth: "200px",
        maxWidth: "100%",
      }}
    >
      {/* Simplified Block Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag Handle (visual only) */}
        <div className="p-1 text-primary cursor-grabbing shrink-0">
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Expand/Collapse (visual only) */}
        <div className="p-1 text-primary/60 shrink-0">
          <ChevronRight className="w-4 h-4 rotate-90" />
        </div>

        {/* Block Icon */}
        <div className="shrink-0 text-primary/60">
          <BlockIcon iconName={blockInfo.icon} className="w-4 h-4" />
        </div>

        {/* Block Name */}
        <span className="font-medium text-foreground text-sm flex-1">
          {blockInfo.label}
        </span>

        {/* Dragging indicator */}
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
          Moving...
        </span>
      </div>
    </div>
  );
}
