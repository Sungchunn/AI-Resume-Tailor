# Phase 2: Frontend Implementation

**Parent:** [Master Plan](./090326_master-plan.md)

## 2.1 TypeScript Types

**File:** `/frontend/src/lib/api/types.ts` - Add:

```typescript
// ============================================
// Scraper Request Types
// ============================================

export type ScraperRequestStatus = "pending" | "approved" | "rejected";

export interface ScraperRequestCreate {
  url: string;
  name?: string | null;
  reason?: string | null;
}

export interface ScraperRequestResponse {
  id: number;
  url: string;
  name: string | null;
  reason: string | null;
  status: ScraperRequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
  preset_id: number | null;
}

export interface ScraperRequestListResponse {
  requests: ScraperRequestResponse[];
  total: number;
}

// Admin types
export interface ScraperRequestAdminResponse extends ScraperRequestResponse {
  user_id: number;
  user_email: string;
  reviewed_by: number | null;
  reviewer_email: string | null;
}

export interface ScraperRequestAdminListResponse {
  requests: ScraperRequestAdminResponse[];
  total: number;
}

export interface ScraperRequestApproveRequest {
  admin_notes?: string | null;
  create_preset?: boolean;
  preset_name?: string | null;
  preset_count?: number;
  preset_is_active?: boolean;
}

export interface ScraperRequestRejectRequest {
  admin_notes: string;
}
```

## 2.2 API Client

**File:** `/frontend/src/lib/api/client.ts` - Add:

```typescript
import type {
  ScraperRequestCreate,
  ScraperRequestResponse,
  ScraperRequestListResponse,
  ScraperRequestStatus,
  ScraperRequestAdminListResponse,
  ScraperRequestAdminResponse,
  ScraperRequestApproveRequest,
  ScraperRequestRejectRequest,
} from "./types";

// User-facing API
export const scraperRequestApi = {
  create: (data: ScraperRequestCreate): Promise<ScraperRequestResponse> =>
    fetchApi("/api/scraper-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: (limit = 50, offset = 0): Promise<ScraperRequestListResponse> =>
    fetchApi(`/api/scraper-requests?limit=${limit}&offset=${offset}`),

  cancel: (id: number): Promise<void> =>
    fetchApi(`/api/scraper-requests/${id}`, { method: "DELETE" }),
};

// Add to existing adminApi object:
export const adminApi = {
  // ... existing methods ...

  // Scraper Requests
  listScraperRequests: (
    status?: ScraperRequestStatus,
    limit = 50,
    offset = 0
  ): Promise<ScraperRequestAdminListResponse> => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    return fetchApi(`/api/admin/scraper-requests?${params.toString()}`);
  },

  approveScraperRequest: (
    id: number,
    data: ScraperRequestApproveRequest
  ): Promise<ScraperRequestAdminResponse> =>
    fetchApi(`/api/admin/scraper-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rejectScraperRequest: (
    id: number,
    data: ScraperRequestRejectRequest
  ): Promise<ScraperRequestAdminResponse> =>
    fetchApi(`/api/admin/scraper-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
```

## 2.3 TanStack Query Hooks

**File:** `/frontend/src/lib/api/hooks.ts` - Add:

```typescript
import {
  scraperRequestApi,
  adminApi,
} from "./client";
import type {
  ScraperRequestCreate,
  ScraperRequestStatus,
  ScraperRequestApproveRequest,
  ScraperRequestRejectRequest,
} from "./types";

// Add to queryKeys object:
export const queryKeys = {
  // ... existing keys ...
  scraperRequests: {
    all: ["scraperRequests"] as const,
    list: () => [...queryKeys.scraperRequests.all, "list"] as const,
    adminList: (status?: ScraperRequestStatus) =>
      [...queryKeys.scraperRequests.all, "admin", "list", status] as const,
  },
};

// ============================================
// User Hooks
// ============================================

export function useMyScraperRequests(limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...queryKeys.scraperRequests.list(), limit, offset],
    queryFn: () => scraperRequestApi.list(limit, offset),
  });
}

export function useCreateScraperRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ScraperRequestCreate) => scraperRequestApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}

export function useCancelScraperRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scraperRequestApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}

// ============================================
// Admin Hooks
// ============================================

export function useAdminScraperRequests(status?: ScraperRequestStatus) {
  return useQuery({
    queryKey: queryKeys.scraperRequests.adminList(status),
    queryFn: () => adminApi.listScraperRequests(status),
  });
}

export function useApproveScraperRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScraperRequestApproveRequest }) =>
      adminApi.approveScraperRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

export function useRejectScraperRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScraperRequestRejectRequest }) =>
      adminApi.rejectScraperRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}
```

## 2.4 User Components

### RequestJobsModal

**File:** `/frontend/src/components/jobs/RequestJobsModal.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useCreateScraperRequest } from "@/lib/api/hooks";

interface RequestJobsModalProps {
  onClose: () => void;
}

export function RequestJobsModal({ onClose }: RequestJobsModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const { mutate: createRequest, isPending } = useCreateScraperRequest();

  const isValidUrl = url.toLowerCase().includes("linkedin.com/jobs");
  const canSubmit = url.length > 0 && isValidUrl && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createRequest(
      {
        url,
        name: name || null,
        reason: reason || null,
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Request Job Listings
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                LinkedIn Jobs URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://linkedin.com/jobs/search?..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {url && !isValidUrl && (
                <p className="mt-1 text-sm text-red-600">
                  URL must be a LinkedIn jobs search URL
                </p>
              )}
              {url && isValidUrl && (
                <p className="mt-1 text-sm text-green-600">
                  Valid LinkedIn jobs URL
                </p>
              )}
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Suggested Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Remote Frontend Jobs"
                maxLength={100}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Why do you want these jobs? (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Looking for senior React positions in Europe"
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### MyRequestsBanner (optional)

**File:** `/frontend/src/components/jobs/MyRequestsBanner.tsx`

Shows pending requests count inline on jobs page header.

## 2.5 Jobs Page Integration

**File:** `/frontend/src/app/(protected)/jobs/page.tsx` - Modify:

```tsx
"use client";

import { useState } from "react";
import { RequestJobsModal } from "@/components/jobs/RequestJobsModal";
// ... existing imports

export default function JobsPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);
  // ... existing state

  return (
    <div className="...">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Job Listings</h1>
        <div className="flex items-center gap-3">
          {/* Existing buttons (Applied, Saved, etc.) */}

          {/* New Request Jobs button */}
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10"
          >
            Request Jobs
          </button>
        </div>
      </div>

      {/* ... existing content ... */}

      {/* Request Modal */}
      {showRequestModal && (
        <RequestJobsModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}
```

## 2.6 Admin Components

### RequestQueue

**File:** `/frontend/src/app/(protected)/admin/scraper/components/RequestQueue.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  useAdminScraperRequests,
  useApproveScraperRequest,
  useRejectScraperRequest,
} from "@/lib/api/hooks";
import type {
  ScraperRequestStatus,
  ScraperRequestAdminResponse,
} from "@/lib/api/types";

const STATUS_TABS: { label: string; value: ScraperRequestStatus | undefined }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: undefined },
];

export function RequestQueue() {
  const [statusFilter, setStatusFilter] = useState<ScraperRequestStatus | undefined>("pending");
  const [selectedRequest, setSelectedRequest] = useState<ScraperRequestAdminResponse | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, isLoading } = useAdminScraperRequests(statusFilter);
  const { mutate: approve, isPending: isApproving } = useApproveScraperRequest();
  const { mutate: reject, isPending: isRejecting } = useRejectScraperRequest();

  const requests = data?.requests ?? [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          User Requests
          {statusFilter === "pending" && pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </h2>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              statusFilter === tab.value
                ? "bg-primary text-white"
                : "bg-muted text-foreground/80 hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          No {statusFilter || ""} requests
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 rounded-lg border border-border bg-background"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {request.name || `Request #${request.id}`}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {request.url}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    From: {request.user_email} •{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                  {request.reason && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      "{request.reason}"
                    </p>
                  )}
                </div>

                {request.status === "pending" && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowApproveModal(true);
                      }}
                      className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {request.status !== "pending" && (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      request.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {request.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <ApproveModal
          request={selectedRequest}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedRequest(null);
          }}
          onApprove={(data) => {
            approve(
              { id: selectedRequest.id, data },
              {
                onSuccess: () => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                },
              }
            );
          }}
          isLoading={isApproving}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <RejectModal
          request={selectedRequest}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedRequest(null);
          }}
          onReject={(notes) => {
            reject(
              { id: selectedRequest.id, data: { admin_notes: notes } },
              {
                onSuccess: () => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                },
              }
            );
          }}
          isLoading={isRejecting}
        />
      )}
    </div>
  );
}
```

### Admin Scraper Page Integration

**File:** `/frontend/src/app/(protected)/admin/scraper/page.tsx` - Add:

```tsx
import { RequestQueue } from "./components/RequestQueue";

// In the page component, add between ScheduleSettings and PresetList:
<RequestQueue />
```

## Verification

1. **User flow:**
   - Go to `/jobs`
   - Click "Request Jobs" button
   - Fill form with valid LinkedIn URL
   - Submit → modal closes
   - Refresh → request appears in user's list (if viewing)

2. **Admin flow:**
   - Go to `/admin/scraper`
   - See "User Requests" section with pending count
   - Click "Approve" → modal with preset options → approve
   - Check preset list → new preset appears
   - Click "Reject" → modal for notes → reject
   - Switch tabs → see approved/rejected requests
