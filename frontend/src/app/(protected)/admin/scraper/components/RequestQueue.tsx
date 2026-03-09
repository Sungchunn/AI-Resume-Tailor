"use client";

import { useState } from "react";
import {
  useAdminScraperRequests,
  useApproveScraperRequest,
  useRejectScraperRequest,
} from "@/lib/api/hooks";
import type {
  ScraperRequestAdminResponse,
  ScraperRequestStatus,
  ScraperRequestApproveRequest,
} from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/utils/date";

const STATUS_TABS: { status: ScraperRequestStatus | undefined; label: string }[] = [
  { status: undefined, label: "All" },
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

function ApproveModal({
  request,
  onClose,
  onConfirm,
  isPending,
}: {
  request: ScraperRequestAdminResponse;
  onClose: () => void;
  onConfirm: (data: ScraperRequestApproveRequest) => void;
  isPending: boolean;
}) {
  const [adminNotes, setAdminNotes] = useState("");
  const [createPreset, setCreatePreset] = useState(true);
  const [presetName, setPresetName] = useState(request.name || "");
  const [presetCount, setPresetCount] = useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      admin_notes: adminNotes.trim() || null,
      create_preset: createPreset,
      preset_name: presetName.trim() || null,
      preset_count: presetCount,
      preset_is_active: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl border border-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Approve Request</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Create Preset Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Create scraper preset</label>
              <button
                type="button"
                onClick={() => setCreatePreset(!createPreset)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  createPreset ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    createPreset ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {createPreset && (
              <>
                {/* Preset Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Preset Name
                  </label>
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Enter preset name"
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Job Count */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Max Jobs Per Run
                  </label>
                  <input
                    type="number"
                    value={presetCount}
                    onChange={(e) => setPresetCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
                    min={1}
                    max={500}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional notes for the user"
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Approve
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  request,
  onClose,
  onConfirm,
  isPending,
}: {
  request: ScraperRequestAdminResponse;
  onClose: () => void;
  onConfirm: (adminNotes: string) => void;
  isPending: boolean;
}) {
  const [adminNotes, setAdminNotes] = useState("");
  const [notesError, setNotesError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNotes.trim()) {
      setNotesError("Admin notes are required when rejecting a request");
      return;
    }
    setNotesError(null);
    onConfirm(adminNotes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl border border-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Reject Request</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => {
                  setAdminNotes(e.target.value);
                  if (notesError) setNotesError(null);
                }}
                placeholder="Explain why this request was rejected"
                maxLength={500}
                rows={3}
                required
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  notesError ? "border-red-500" : "border-input"
                }`}
              />
              {notesError ? (
                <p className="mt-1 text-xs text-red-500">{notesError}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  This will be visible to the user.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !adminNotes.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                Reject
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RequestQueue() {
  const [statusFilter, setStatusFilter] = useState<ScraperRequestStatus | undefined>("pending");
  const [approvingRequest, setApprovingRequest] = useState<ScraperRequestAdminResponse | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<ScraperRequestAdminResponse | null>(null);

  const { data, isLoading } = useAdminScraperRequests(statusFilter);
  const { mutate: approveRequest, isPending: isApproving } = useApproveScraperRequest();
  const { mutate: rejectRequest, isPending: isRejecting } = useRejectScraperRequest();

  const handleApprove = (data: ScraperRequestApproveRequest) => {
    if (!approvingRequest) return;
    approveRequest(
      { id: approvingRequest.id, data },
      { onSuccess: () => setApprovingRequest(null) }
    );
  };

  const handleReject = (adminNotes: string) => {
    if (!rejectingRequest) return;
    rejectRequest(
      { id: rejectingRequest.id, data: { admin_notes: adminNotes } },
      { onSuccess: () => setRejectingRequest(null) }
    );
  };

  const truncateUrl = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + "...";
  };

  const getStatusBadge = (status: ScraperRequestStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-500">
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-500">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-500">
            Rejected
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const requests = data?.requests ?? [];
  const pendingCount = statusFilter === undefined
    ? requests.filter(r => r.status === "pending").length
    : (statusFilter === "pending" ? data?.total ?? 0 : 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User Requests</h2>
          <p className="text-sm text-muted-foreground">
            {requests.length === 0
              ? "No requests to review."
              : `${data?.total ?? 0} request${(data?.total ?? 0) === 1 ? "" : "s"}`}
            {pendingCount > 0 && statusFilter !== "pending" && (
              <span className="ml-1 text-yellow-500">
                ({pendingCount} pending)
              </span>
            )}
          </p>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {STATUS_TABS.map(({ status, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground/60"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No requests</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter
              ? `No ${statusFilter} requests.`
              : "Users haven't submitted any requests yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className={`p-4 rounded-lg border ${
                request.status === "pending"
                  ? "border-yellow-500/20 bg-yellow-500/5"
                  : request.status === "approved"
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(request.status)}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(request.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      by {request.user_email}
                    </span>
                  </div>

                  {/* Name & URL */}
                  {request.name && (
                    <p className="text-sm font-medium text-foreground mb-1">{request.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate" title={request.url}>
                    {truncateUrl(request.url)}
                  </p>

                  {/* Reason */}
                  {request.reason && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {request.reason}
                    </p>
                  )}

                  {/* Admin Notes */}
                  {request.admin_notes && (
                    <div className={`mt-2 text-sm p-2 rounded ${
                      request.status === "rejected"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                    }`}>
                      <span className="font-medium">
                        {request.reviewer_email ? `${request.reviewer_email}: ` : "Admin: "}
                      </span>
                      {request.admin_notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {request.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovingRequest(request)}
                      className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingRequest(request)}
                      className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approvingRequest && (
        <ApproveModal
          request={approvingRequest}
          onClose={() => setApprovingRequest(null)}
          onConfirm={handleApprove}
          isPending={isApproving}
        />
      )}

      {/* Reject Modal */}
      {rejectingRequest && (
        <RejectModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onConfirm={handleReject}
          isPending={isRejecting}
        />
      )}
    </div>
  );
}
