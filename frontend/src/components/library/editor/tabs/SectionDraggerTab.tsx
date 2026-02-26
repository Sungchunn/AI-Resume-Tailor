"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { GripVertical, Plus, Layers, Eye, EyeOff, Trash2 } from "lucide-react";
import { useBlockEditor } from "../BlockEditorContext";
import { BlockIcon } from "../BlockIcon";
import { BlockTypeMenu } from "../BlockTypeMenu";
import { BLOCK_TYPE_INFO } from "@/lib/resume/defaults";
import type { AnyResumeBlock, ResumeBlockType } from "@/lib/resume/types";

/**
 * SectionDraggerTab - Simplified section ordering interface
 *
 * Features:
 * - Drag-and-drop section reordering
 * - Add/remove section buttons
 * - Syncs with preview selection
 */
export function SectionDraggerTab() {
  const {
    state,
    reorderBlocks,
    addBlock,
    removeBlock,
    setActiveBlock,
    toggleBlockVisibility,
    setHoveredBlock,
  } = useBlockEditor();

  const { blocks, activeBlockId, hoveredBlockId } = state;

  // Count visible sections
  const visibleCount = blocks.filter((b) => !b.isHidden).length;

  // Track which block is being dragged
  const [draggedBlock, setDraggedBlock] = useState<AnyResumeBlock | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const block = blocks.find((b) => b.id === active.id);
      if (block) {
        setDraggedBlock(block);
      }
    },
    [blocks]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedBlock(null);

      if (over && active.id !== over.id) {
        reorderBlocks(active.id as string, over.id as string);
      }
    },
    [reorderBlocks]
  );

  // Handle adding a new block
  const handleAddBlock = useCallback(
    (blockType: ResumeBlockType) => {
      addBlock(blockType);
    },
    [addBlock]
  );

  // Handle block selection
  const handleSelectBlock = useCallback(
    (id: string) => {
      setActiveBlock(id);
    },
    [setActiveBlock]
  );

  // Get block IDs for sortable context
  const blockIds = blocks.map((b) => b.id);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>Sections</span>
          <span className="text-muted-foreground font-normal">
            ({visibleCount}/{blocks.length} visible)
          </span>
        </h3>
        <BlockTypeMenu
          existingTypes={blocks.map((b) => b.type)}
          onAdd={handleAddBlock}
        />
      </div>

      {/* Sortable List */}
      <div className="flex-1 overflow-y-auto p-4">
        {blocks.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blockIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {blocks.map((block) => (
                  <SortableSectionItem
                    key={block.id}
                    block={block}
                    isActive={activeBlockId === block.id}
                    isHovered={hoveredBlockId === block.id}
                    onSelect={() => handleSelectBlock(block.id)}
                    onRemove={() => removeBlock(block.id)}
                    onToggleVisibility={() => toggleBlockVisibility(block.id)}
                    onHover={(hovered) => setHoveredBlock(hovered ? block.id : null)}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {draggedBlock ? (
                <SectionItemOverlay block={draggedBlock} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              No sections yet
            </p>
            <BlockTypeMenu
              existingTypes={[]}
              onAdd={handleAddBlock}
              variant="primary"
            />
          </div>
        )}

        {/* Bottom Add Button */}
        {blocks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <BlockTypeMenu
              existingTypes={blocks.map((b) => b.type)}
              onAdd={handleAddBlock}
              variant="full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sortable section item with visibility toggle
 */
function SortableSectionItem({
  block,
  isActive,
  isHovered,
  onSelect,
  onRemove,
  onToggleVisibility,
  onHover,
}: {
  block: AnyResumeBlock;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blockInfo = BLOCK_TYPE_INFO[block.type];
  const isHiddenBlock = block.isHidden ?? false;

  // Determine border/background classes based on state
  const getStateClasses = () => {
    if (isDragging) return "opacity-50 border-primary/40 bg-primary/10";
    if (isActive) return "border-primary/30 bg-primary/5";
    if (isHovered && !isHiddenBlock) return "border-primary/30 bg-primary/5 ring-1 ring-dashed ring-primary/30";
    if (isHiddenBlock) return "border-border/50 bg-muted/30";
    return "border-border hover:border-input hover:bg-accent/50";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${getStateClasses()}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={`p-1 cursor-grab active:cursor-grabbing ${
          isHiddenBlock ? "text-muted-foreground/40" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Block Info */}
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <BlockIcon
          iconName={blockInfo.icon}
          className={`w-4 h-4 shrink-0 ${isHiddenBlock ? "text-muted-foreground/40" : "text-muted-foreground"}`}
        />
        <span
          className={`text-sm font-medium truncate ${
            isHiddenBlock ? "text-muted-foreground/60 line-through" : "text-foreground"
          }`}
        >
          {blockInfo.label}
        </span>
        {isHiddenBlock && (
          <span className="text-xs text-muted-foreground/50">(hidden)</span>
        )}
      </button>

      {/* Visibility Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={`p-1.5 rounded transition-colors ${
          isHiddenBlock
            ? "text-muted-foreground/60 hover:text-foreground hover:bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        title={isHiddenBlock ? "Show section" : "Hide section"}
      >
        {isHiddenBlock ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
        title="Remove section"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Drag overlay for section item
 */
function SectionItemOverlay({ block }: { block: AnyResumeBlock }) {
  const blockInfo = BLOCK_TYPE_INFO[block.type];

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/40 bg-card shadow-lg">
      <div className="p-1 text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <BlockIcon iconName={blockInfo.icon} className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">
        {blockInfo.label}
      </span>
    </div>
  );
}
