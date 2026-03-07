"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Send, Calendar, CheckCircle, XCircle, Ghost } from "lucide-react";
import type { ApplicationStatus, JobListingResponse } from "@/lib/api/types";
import { STATUS_CONFIG } from "./types";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  status: ApplicationStatus;
  jobs: JobListingResponse[];
}

const ICONS: Record<string, React.ElementType> = {
  Send,
  Calendar,
  CheckCircle,
  XCircle,
  Ghost,
};

export function KanbanColumn({ status, jobs }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const Icon = ICONS[config.icon] || Send;

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  const jobIds = jobs.map((job) => job.id);

  return (
    <div
      className={`
        flex flex-col w-72 min-w-72 rounded-lg border transition-colors
        ${config.bgColor} ${config.borderColor}
        ${isOver ? "ring-2 ring-primary/30 border-primary/40" : ""}
      `}
    >
      {/* Column Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${config.borderColor}`}>
        <Icon className={`w-4 h-4 ${config.textColor}`} />
        <h3 className={`text-sm font-semibold ${config.textColor}`}>
          {config.label}
        </h3>
        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
          {jobs.length}
        </span>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-280px)]"
      >
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          {jobs.length > 0 ? (
            jobs.map((job) => <KanbanCard key={job.id} job={job} />)
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/50 py-8">
              <p className="text-center">
                No jobs in this column
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
