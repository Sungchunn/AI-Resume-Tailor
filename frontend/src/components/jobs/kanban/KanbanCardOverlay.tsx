"use client";

import { GripVertical } from "lucide-react";
import type { JobListingResponse } from "@/lib/api/types";

interface KanbanCardOverlayProps {
  job: JobListingResponse;
}

export function KanbanCardOverlay({ job }: KanbanCardOverlayProps) {
  return (
    <div className="bg-card rounded-lg border border-primary/40 p-3 shadow-lg ring-2 ring-primary/30 w-64">
      <div className="flex items-start gap-2">
        {/* Drag Handle (visual only) */}
        <div className="p-1 text-muted-foreground shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Company Logo */}
            {job.company_logo && (
              <img
                src={job.company_logo}
                alt=""
                className="w-8 h-8 rounded object-contain border border-border shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              {/* Job Title */}
              <h4 className="text-sm font-medium text-foreground truncate">
                {job.job_title}
              </h4>

              {/* Company Name */}
              <p className="text-xs text-muted-foreground truncate">
                {job.company_name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
