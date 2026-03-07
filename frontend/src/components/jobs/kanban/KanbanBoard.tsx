"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import type { ApplicationStatus, JobListingResponse, KanbanBoardResponse } from "@/lib/api/types";
import { useKanbanBoard, useUpdateApplicationStatus, useReorderKanbanColumn, queryKeys } from "@/lib/api/hooks";
import { APPLICATION_STATUSES } from "./types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCardOverlay } from "./KanbanCardOverlay";

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useKanbanBoard();
  const updateStatusMutation = useUpdateApplicationStatus();
  const reorderMutation = useReorderKanbanColumn();

  // Track which job is being dragged
  const [activeJob, setActiveJob] = useState<JobListingResponse | null>(null);

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

  // Find job by ID across all columns
  const findJob = useCallback((id: number): JobListingResponse | undefined => {
    if (!data) return undefined;
    for (const status of APPLICATION_STATUSES) {
      const job = data.columns[status]?.jobs.find((j) => j.id === id);
      if (job) return job;
    }
    return undefined;
  }, [data]);

  // Find which column a job is in
  const findColumn = useCallback((id: number): ApplicationStatus | undefined => {
    if (!data) return undefined;
    for (const status of APPLICATION_STATUSES) {
      if (data.columns[status]?.jobs.some((j) => j.id === id)) {
        return status;
      }
    }
    return undefined;
  }, [data]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const job = findJob(active.id as number);
    if (job) {
      setActiveJob(job);
    }
  }, [findJob]);

  // Handle drag over (for cross-column drags)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !data) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Get the column we're dragging over
    let targetStatus: ApplicationStatus | undefined;

    // Check if we're over a column directly
    if (typeof overId === "string" && overId.startsWith("column-")) {
      targetStatus = overId.replace("column-", "") as ApplicationStatus;
    } else {
      // We're over another card, find its column
      targetStatus = findColumn(overId as number);
    }

    if (!targetStatus) return;

    const sourceStatus = findColumn(activeId);
    if (!sourceStatus || sourceStatus === targetStatus) return;

    // Optimistically update the UI for cross-column drag
    queryClient.setQueryData<KanbanBoardResponse>(
      queryKeys.jobListings.kanban(),
      (old) => {
        if (!old) return old;

        const sourceJobs = old.columns[sourceStatus].jobs.filter((j) => j.id !== activeId);
        const movedJob = old.columns[sourceStatus].jobs.find((j) => j.id === activeId);
        if (!movedJob) return old;

        const targetJobs = [...old.columns[targetStatus].jobs, { ...movedJob, application_status: targetStatus }];

        return {
          columns: {
            ...old.columns,
            [sourceStatus]: {
              ...old.columns[sourceStatus],
              jobs: sourceJobs,
              total: sourceJobs.length,
            },
            [targetStatus]: {
              ...old.columns[targetStatus],
              jobs: targetJobs,
              total: targetJobs.length,
            },
          },
        };
      }
    );
  }, [data, findColumn, queryClient]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    if (!over || !data) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Get the target column
    let targetStatus: ApplicationStatus | undefined;

    if (typeof overId === "string" && overId.startsWith("column-")) {
      targetStatus = overId.replace("column-", "") as ApplicationStatus;
    } else {
      targetStatus = findColumn(overId as number);
    }

    if (!targetStatus) return;

    const sourceStatus = active.data.current?.sortable?.containerId?.replace("column-", "") as ApplicationStatus | undefined
      || findColumn(activeId);

    if (!sourceStatus) return;

    // Cross-column move: update status
    if (sourceStatus !== targetStatus) {
      updateStatusMutation.mutate({
        id: activeId,
        status: targetStatus,
      });
      return;
    }

    // Same column reorder
    const jobs = data.columns[targetStatus]?.jobs || [];
    const activeIndex = jobs.findIndex((j) => j.id === activeId);
    const overIndex = typeof overId === "number"
      ? jobs.findIndex((j) => j.id === overId)
      : jobs.length;

    if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
      const newJobs = arrayMove(jobs, activeIndex, overIndex);
      const newOrder = newJobs.map((j) => j.id);

      // Optimistically update UI
      queryClient.setQueryData<KanbanBoardResponse>(
        queryKeys.jobListings.kanban(),
        (old) => {
          if (!old) return old;
          return {
            columns: {
              ...old.columns,
              [targetStatus]: {
                ...old.columns[targetStatus],
                jobs: newJobs,
              },
            },
          };
        }
      );

      // Persist to server
      reorderMutation.mutate({
        status: targetStatus,
        jobListingIds: newOrder,
      });
    }
  }, [data, findColumn, queryClient, updateStatusMutation, reorderMutation]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {APPLICATION_STATUSES.map((status) => (
          <div
            key={status}
            className="w-72 min-w-72 h-96 rounded-lg border border-border bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
        <p className="font-medium">Error loading Kanban board</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  // Empty state - no data
  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No job application data available.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {APPLICATION_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            jobs={data.columns[status]?.jobs || []}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeJob ? <KanbanCardOverlay job={activeJob} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
