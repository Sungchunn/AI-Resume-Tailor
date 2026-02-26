"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronRight,
  Trash2,
  Plus,
  MoreVertical,
} from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { BLOCK_TYPE_INFO } from "@/lib/resume/defaults";
import type { AnyResumeBlock, ResumeBlockType } from "@/lib/resume/types";
import { BlockIcon } from "./BlockIcon";

interface BlockItemProps {
  block: AnyResumeBlock;
  isActive: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onAddAfter: (type: ResumeBlockType) => void;
  children?: ReactNode;
}

/**
 * BlockItem - Single draggable block in the editor
 *
 * Features:
 * - Drag handle for reordering
 * - Expand/collapse toggle
 * - Action menu (add after, delete)
 * - Visual feedback for active/dragging states
 */
export function BlockItem({
  block,
  isActive,
  onSelect,
  onToggleCollapse,
  onRemove,
  onAddAfter,
  children,
}: BlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get block metadata
  const blockInfo = BLOCK_TYPE_INFO[block.type];
  const isCollapsed = block.isCollapsed ?? false;

  // Get content preview/count
  const contentPreview = getContentPreview(block);

  // Style for drag transform
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border-2 transition-all ${
        isDragging
          ? "border-primary/40 bg-primary/10 shadow-lg opacity-90 z-50"
          : isActive
          ? "border-primary/30 bg-card shadow-sm"
          : "border-border bg-card hover:border-input"
      }`}
      onClick={onSelect}
    >
      {/* Block Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag Handle */}
        <button
          className="p-1 text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="p-1 text-muted-foreground hover:text-foreground/80 transition-transform shrink-0"
          aria-label={isCollapsed ? "Expand section" : "Collapse section"}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${
              !isCollapsed ? "rotate-90" : ""
            }`}
          />
        </button>

        {/* Block Icon */}
        <div className="shrink-0 text-muted-foreground/60">
          <BlockIcon iconName={blockInfo.icon} className="w-4 h-4" />
        </div>

        {/* Block Name & Preview */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground text-sm">
            {blockInfo.label}
          </span>
          {contentPreview && (
            <span className="ml-2 text-xs text-muted-foreground/60">{contentPreview}</span>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent rounded transition-colors"
            aria-label="Block actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // This would open a sub-menu or modal - simplified here
                  onAddAfter(block.type);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-foreground/80 hover:bg-accent flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add section below
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete section
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Block Content */}
      {!isCollapsed && children && (
        <div className="px-4 pb-4 pt-2 border-t border-border">{children}</div>
      )}
    </div>
  );
}

/**
 * Get a preview string for block content
 */
function getContentPreview(block: AnyResumeBlock): string | null {
  switch (block.type) {
    case "contact": {
      const content = block.content;
      return content.fullName || null;
    }
    case "experience": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length} ${entries.length === 1 ? "entry" : "entries"})`;
    }
    case "education": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length} ${entries.length === 1 ? "entry" : "entries"})`;
    }
    case "skills": {
      const skills = block.content;
      if (skills.length === 0) return "(empty)";
      return `(${skills.length} ${skills.length === 1 ? "skill" : "skills"})`;
    }
    case "certifications": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "projects": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length} ${entries.length === 1 ? "project" : "projects"})`;
    }
    case "languages": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "volunteer": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "publications": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "awards": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "references": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "courses": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "memberships": {
      const entries = block.content;
      if (entries.length === 0) return "(empty)";
      return `(${entries.length})`;
    }
    case "summary":
    case "interests": {
      const text = block.content;
      if (!text) return "(empty)";
      // Strip HTML and truncate
      const plainText = text.replace(/<[^>]*>/g, "").trim();
      if (!plainText) return "(empty)";
      return null; // Don't show preview for text content
    }
    default:
      return null;
  }
}
