/**
 * RequestJobsModal Component
 *
 * A modal for users to submit LinkedIn job URLs for admin review.
 * Shows existing requests and allows submitting new ones.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Clock, CheckCircle2, XCircle, Link2, Tag, MessageSquare, Loader2, Trash2 } from "lucide-react";
import { useMyScraperRequests, useCreateScraperRequest, useCancelScraperRequest } from "@/lib/api/hooks";
import type { ScraperRequestResponse, ScraperRequestStatus } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/utils/date";

interface RequestJobsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

const STATUS_CONFIG: Record<ScraperRequestStatus, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending Review" },
  approved: { icon: CheckCircle2, color: "text-green-500", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
};

function RequestCard({
  request,
  onCancel,
  isCancelling,
}: {
  request: ScraperRequestResponse;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  const { icon: StatusIcon, color, label } = STATUS_CONFIG[request.status];

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
            <span className={`text-sm font-medium ${color}`}>{label}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(request.created_at)}
            </span>
          </div>

          {request.name && (
            <p className="text-sm font-medium text-foreground mb-1">{request.name}</p>
          )}

          <p className="text-xs text-muted-foreground truncate mb-2" title={request.url}>
            {request.url}
          </p>

          {request.reason && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {request.reason}
            </p>
          )}

          {request.admin_notes && (
            <div className={`text-sm p-2 rounded ${
              request.status === "rejected"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}>
              <span className="font-medium">Admin: </span>
              {request.admin_notes}
            </div>
          )}
        </div>

        {request.status === "pending" && (
          <button
            onClick={() => onCancel(request.id)}
            disabled={isCancelling}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Cancel request"
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function RequestJobsModal({ isOpen, onClose }: RequestJobsModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: requestsData, isLoading: isLoadingRequests } = useMyScraperRequests();
  const { mutate: createRequest, isPending: isCreating, error: createError, reset: resetCreateError } = useCreateScraperRequest();
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelScraperRequest();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setName("");
      setReason("");
      resetCreateError();
    }
  }, [isOpen, resetCreateError]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const isValidUrl = url.toLowerCase().includes("linkedin.com/jobs");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !isValidUrl) return;

    createRequest(
      {
        url,
        name: name.trim() || null,
        reason: reason.trim() || null,
      },
      {
        onSuccess: () => {
          setUrl("");
          setName("");
          setReason("");
        },
      }
    );
  };

  const handleCancel = (id: number) => {
    setCancellingId(id);
    cancelRequest(id, {
      onSettled: () => setCancellingId(null),
    });
  };

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
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-card rounded-xl shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Request Job Scraping
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Submit LinkedIn job URLs for admin review
                </p>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submit Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 mb-1.5">
                    <Link2 className="h-4 w-4" />
                    LinkedIn Job Search URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  {url && !isValidUrl && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      URL must be from linkedin.com/jobs
                    </p>
                  )}
                  {url && isValidUrl && (
                    <p className="mt-1.5 text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Valid LinkedIn jobs URL
                    </p>
                  )}
                </div>

                {/* Name Input */}
                <div>
                  <label htmlFor="name" className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 mb-1.5">
                    <Tag className="h-4 w-4" />
                    Suggested Preset Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Remote Software Engineer Jobs"
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional. Helps admins understand what jobs to expect.
                  </p>
                </div>

                {/* Reason Input */}
                <div>
                  <label htmlFor="reason" className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 mb-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Why do you want these jobs?
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Looking for remote opportunities in Europe..."
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Error */}
                {createError && (
                  <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                    {createError.message}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isCreating || !url || !isValidUrl}
                  className="w-full py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </form>

              {/* Previous Requests */}
              {(requestsData?.requests?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    Your Requests ({requestsData?.total})
                  </h3>
                  <div className="space-y-3">
                    {requestsData?.requests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onCancel={handleCancel}
                        isCancelling={isCancelling && cancellingId === request.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoadingRequests && (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                </div>
              )}

              {/* Empty State */}
              {!isLoadingRequests && requestsData?.requests?.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  You haven&apos;t submitted any requests yet.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl flex-shrink-0">
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

export default RequestJobsModal;
