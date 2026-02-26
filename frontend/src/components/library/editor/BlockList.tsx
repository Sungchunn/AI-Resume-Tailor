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
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { BlockItem } from "./BlockItem";
import { BlockTypeMenu } from "./BlockTypeMenu";
import { BlockDragOverlay } from "./BlockDragOverlay";
import { useBlockEditor } from "./BlockEditorContext";
import type { AnyResumeBlock, ResumeBlockType } from "@/lib/resume/types";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";

interface BlockListProps {
  /** Render function for block editors */
  renderBlockEditor?: (block: AnyResumeBlock) => React.ReactNode;
  /** Show the add section button at the bottom */
  showAddButton?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * BlockList - Sortable list of resume blocks
 *
 * Provides drag-and-drop reordering of blocks using dnd-kit.
 * Manages expansion state and renders block editors.
 */
export function BlockList({
  renderBlockEditor,
  showAddButton = true,
  emptyMessage = "No sections yet. Click 'Add Section' to get started.",
}: BlockListProps) {
  const {
    state,
    reorderBlocks,
    addBlock,
    removeBlock,
    setActiveBlock,
    toggleBlockCollapse,
    hasBlockType,
  } = useBlockEditor();

  const { blocks, activeBlockId } = state;

  // Track which block is being dragged
  const [draggedBlock, setDraggedBlock] = useState<AnyResumeBlock | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevents accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track all expanded/collapsed state
  const allExpanded = blocks.every((b) => !b.isCollapsed);
  const allCollapsed = blocks.every((b) => b.isCollapsed);

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
    (blockType: ResumeBlockType, afterId?: string) => {
      addBlock(blockType, afterId);
    },
    [addBlock]
  );

  // Handle removing a block
  const handleRemoveBlock = useCallback(
    (id: string) => {
      removeBlock(id);
    },
    [removeBlock]
  );

  // Handle block selection
  const handleSelectBlock = useCallback(
    (id: string) => {
      setActiveBlock(id);
    },
    [setActiveBlock]
  );

  // Handle toggle collapse
  const handleToggleCollapse = useCallback(
    (id: string) => {
      toggleBlockCollapse(id);
    },
    [toggleBlockCollapse]
  );

  // Toggle all expanded/collapsed
  const handleToggleAll = useCallback(() => {
    // If any are expanded, collapse all. Otherwise expand all.
    blocks.forEach((block) => {
      if (allExpanded && !block.isCollapsed) {
        toggleBlockCollapse(block.id);
      } else if (!allExpanded && block.isCollapsed) {
        toggleBlockCollapse(block.id);
      }
    });
  }, [blocks, allExpanded, toggleBlockCollapse]);

  // Get block IDs for sortable context
  const blockIds = blocks.map((b) => b.id);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-foreground/80 truncate shrink-0">
          Sections ({blocks.length})
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {blocks.length > 0 && (
            <button
              onClick={handleToggleAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80 px-2 py-1 rounded hover:bg-accent transition-colors"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Expand All
                </>
              )}
            </button>
          )}
          <BlockTypeMenu
            existingTypes={blocks.map((b) => b.type)}
            onAdd={(type) => handleAddBlock(type)}
          />
        </div>
      </div>

      {/* Sortable Block List */}
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
              <div className="space-y-3">
                {blocks.map((block) => (
                  <BlockItem
                    key={block.id}
                    block={block}
                    isActive={activeBlockId === block.id}
                    onSelect={() => handleSelectBlock(block.id)}
                    onToggleCollapse={() => handleToggleCollapse(block.id)}
                    onRemove={() => handleRemoveBlock(block.id)}
                    onAddAfter={(type) => handleAddBlock(type, block.id)}
                  >
                    {renderBlockEditor?.(block)}
                  </BlockItem>
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {draggedBlock ? (
                <BlockDragOverlay block={draggedBlock} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <EmptyState message={emptyMessage} onAdd={handleAddBlock} />
        )}

        {/* Bottom Add Button */}
        {showAddButton && blocks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <BlockTypeMenu
              existingTypes={blocks.map((b) => b.type)}
              onAdd={(type) => handleAddBlock(type)}
              variant="full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Empty state component when no blocks exist
 */
function EmptyState({
  message,
  onAdd,
}: {
  message: string;
  onAdd: (type: ResumeBlockType) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Plus className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground mb-4 text-center">{message}</p>
      <BlockTypeMenu
        existingTypes={[]}
        onAdd={onAdd}
        variant="primary"
      />
    </div>
  );
}
