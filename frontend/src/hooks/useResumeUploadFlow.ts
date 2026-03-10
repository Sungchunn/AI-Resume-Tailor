"use client";

/**
 * useResumeUploadFlow Hook
 *
 * Orchestrates the full resume upload flow for a single file:
 * 1. Upload with progress → /api/upload/extract
 * 2. Create resume → resumeApi.create()
 * 3. Trigger parse → resumeApi.parse(id)
 * 4. Poll status → resumeApi.getParseStatus(id, taskId) every 3s
 * 5. Complete when parse finishes
 */

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import {
  uploadWithProgress,
  type UploadProgressEvent,
} from "@/lib/api/uploadWithProgress";
import { resumeApi } from "@/lib/api/client";
import { generateTitleFromFilename } from "@/lib/utils/filename";
import { queryKeys } from "@/lib/api/hooks";
import type { DocumentExtractionResponse } from "@/lib/api/types";
import type { FileUploadItem, UploadPhase } from "@/components/upload/ResumeUploadFileCard";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL = 3000; // 3 seconds

export interface UseResumeUploadFlowOptions {
  onUpdate: (id: string, updates: Partial<FileUploadItem>) => void;
  onComplete: (id: string, resumeId: string) => void;
  onError: (id: string, error: { message: string; recoverable: boolean }) => void;
}

export interface UploadFlowHandle {
  start: (file: File) => FileUploadItem;
  cancel: (id: string) => void;
}

export function useResumeUploadFlow(
  options: UseResumeUploadFlowOptions
): UploadFlowHandle {
  const { onUpdate, onComplete, onError } = options;
  const queryClient = useQueryClient();

  // Track active uploads and their abort functions
  const activeUploads = useRef<Map<string, () => void>>(new Map());
  // Track active poll intervals
  const activePolls = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track cancelled items to prevent further updates
  const cancelledItems = useRef<Set<string>>(new Set());

  const cleanup = useCallback((id: string) => {
    // Clear upload abort function
    activeUploads.current.delete(id);
    // Clear poll interval
    const pollInterval = activePolls.current.get(id);
    if (pollInterval) {
      clearInterval(pollInterval);
      activePolls.current.delete(id);
    }
  }, []);

  const cancel = useCallback(
    (id: string) => {
      cancelledItems.current.add(id);

      // Abort active upload
      const abortFn = activeUploads.current.get(id);
      if (abortFn) {
        abortFn();
      }

      cleanup(id);
    },
    [cleanup]
  );

  const start = useCallback(
    (file: File): FileUploadItem => {
      const id = nanoid();

      // Create initial item
      const item: FileUploadItem = {
        id,
        file,
        phase: "uploading",
        uploadProgress: 0,
        parseProgress: 0,
      };

      // Start the upload flow
      runUploadFlow(id, file);

      return item;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function runUploadFlow(id: string, file: File) {
    // Helper to check if cancelled
    const isCancelled = () => cancelledItems.current.has(id);

    // Helper to update state safely
    const update = (updates: Partial<FileUploadItem>) => {
      if (isCancelled()) return;
      onUpdate(id, updates);
    };

    try {
      // ================================================================
      // Phase 1: Upload with progress
      // ================================================================
      update({ phase: "uploading", uploadProgress: 0 });

      const { promise: uploadPromise, abort } = uploadWithProgress<DocumentExtractionResponse>({
        file,
        url: `${API_BASE_URL}/api/upload/extract`,
        onProgress: (event: UploadProgressEvent) => {
          update({ uploadProgress: event.percent });
        },
      });

      // Store abort function
      activeUploads.current.set(id, abort);

      const extractionResult = await uploadPromise;

      if (isCancelled()) return;

      // ================================================================
      // Phase 2: Extracting (happens on server during upload, but we show it)
      // ================================================================
      update({ phase: "extracting", uploadProgress: 100 });

      // Small delay to show extraction phase
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (isCancelled()) return;

      // ================================================================
      // Phase 3: Create resume
      // ================================================================
      update({ phase: "creating" });

      const title = generateTitleFromFilename(file.name);
      const resume = await resumeApi.create({
        title,
        raw_content: extractionResult.raw_content,
        html_content: extractionResult.html_content,
        original_file_key: extractionResult.file_key ?? undefined,
        original_filename: extractionResult.source_filename,
        file_type: extractionResult.file_type,
        file_size_bytes: file.size,
      });

      if (isCancelled()) return;

      update({ resumeId: resume.id });

      // ================================================================
      // Phase 4: Trigger AI parsing
      // ================================================================
      update({ phase: "parsing", parseProgress: 0 });

      const parseTask = await resumeApi.parse(resume.id);

      if (isCancelled()) return;

      update({ taskId: parseTask.task_id });

      // ================================================================
      // Phase 5: Poll for parse completion
      // ================================================================
      if (parseTask.status === "completed") {
        // Already done (cached result)
        update({ phase: "complete", parseProgress: 100 });
        onComplete(id, resume.id);
        cleanup(id);
        // Invalidate both the list and the specific resume detail
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.resumes.detail(resume.id) }),
        ]);
        return;
      }

      // Start polling
      const pollInterval = setInterval(async () => {
        if (isCancelled()) {
          cleanup(id);
          return;
        }

        try {
          const status = await resumeApi.getParseStatus(resume.id, parseTask.task_id);

          if (isCancelled()) {
            cleanup(id);
            return;
          }

          // Update parse progress
          if (status.stage_progress !== null && status.stage_progress !== undefined) {
            update({ parseProgress: status.stage_progress });
          }

          if (status.status === "completed") {
            update({ phase: "complete", parseProgress: 100 });
            onComplete(id, resume.id);
            cleanup(id);
            // Invalidate both the list and the specific resume detail
            queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.resumes.detail(resume.id) });
          } else if (status.status === "failed") {
            onError(id, {
              message: status.error || "AI parsing failed",
              recoverable: false,
            });
            cleanup(id);
          }
        } catch (pollError) {
          // Don't fail the whole upload on poll errors, just log
          console.error("Poll error:", pollError);
        }
      }, POLL_INTERVAL);

      activePolls.current.set(id, pollInterval);
    } catch (err) {
      if (isCancelled()) return;

      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";

      // Check if it's a cancellation error
      if (message === "Upload cancelled") {
        cleanup(id);
        return;
      }

      onError(id, {
        message,
        recoverable: true,
      });
      cleanup(id);
    }
  }

  return { start, cancel };
}
