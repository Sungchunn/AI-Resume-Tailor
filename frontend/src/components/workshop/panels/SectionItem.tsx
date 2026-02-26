"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SectionActions } from "./SectionActions";
import type { ReactNode } from "react";

interface SectionItemProps {
  section: string;
  label: string;
  count?: number | null;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onAIEnhance: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: ReactNode;
}

export function SectionItem({
  section,
  label,
  count,
  isExpanded,
  isActive,
  onToggle,
  onFocus,
  onAIEnhance,
  onDuplicate,
  onRemove,
  children,
}: SectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border-2 transition-all ${
        isDragging
          ? "border-primary-400 bg-primary-50 shadow-lg opacity-90 z-10"
          : isActive
          ? "border-primary-300 bg-white"
          : "border-border bg-card hover:border-input"
      }`}
      onClick={onFocus}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag Handle */}
        <button
          className="p-1 text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-1 text-muted-foreground hover:text-foreground/80 transition-transform"
          aria-label={isExpanded ? "Collapse section" : "Expand section"}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Section Name */}
        <span className="flex-1 font-medium text-foreground text-sm">
          {label}
          {count !== null && count !== undefined && (
            <span className="ml-2 text-xs text-muted-foreground/60">({count})</span>
          )}
        </span>

        {/* Actions Menu */}
        <SectionActions
          section={section}
          onAIEnhance={onAIEnhance}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>

      {/* Section Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
