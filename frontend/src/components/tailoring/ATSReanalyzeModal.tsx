/**
 * ATSReanalyzeModal Component
 *
 * A modal dialog for re-running ATS analysis on a tailored resume.
 * Displays the ATSProgressStepper and updates scores when complete.
 */

"use client";

import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { ATSProgressStepper } from "./ATSProgressStepper";
import type { ATSCompositeScore } from "@/lib/stores/atsProgressStore";

interface ATSReanalyzeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Resume ID for analysis */
  resumeId: number;
  /** Job ID for analysis */
  jobId: number;
  /** Job title for display */
  jobTitle?: string;
  /** Company name for display */
  companyName?: string;
  /** Callback when analysis completes with new scores */
  onComplete?: (compositeScore: ATSCompositeScore) => void;
  /** Callback on analysis error */
  onError?: (error: string) => void;
}

export function ATSReanalyzeModal({
  isOpen,
  onClose,
  resumeId,
  jobId,
  jobTitle,
  companyName,
  onComplete,
  onError,
}: ATSReanalyzeModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleComplete = useCallback(
    (score: ATSCompositeScore) => {
      onComplete?.(score);
      // Don't auto-close - let user see the results
    },
    [onComplete]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Re-analyze ATS Score
                </h2>
                {(jobTitle || companyName) && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {jobTitle}
                    {jobTitle && companyName && " @ "}
                    {companyName}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <ATSProgressStepper
                resumeId={resumeId}
                jobId={jobId}
                autoStart={true}
                showDetails={false}
                onComplete={handleComplete}
                onError={onError}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ATSReanalyzeModal;
