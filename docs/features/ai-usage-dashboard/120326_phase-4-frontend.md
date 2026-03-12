# Phase 4: Frontend Implementation

## Overview

Create the admin dashboard page with stats cards, time range selection, and tabbed breakdowns.

---

## 4.1 Add TypeScript Types

**File:** `/frontend/src/lib/api/types.ts`

Add to existing types:

```typescript
// AI Usage Dashboard Types
export interface AIUsageSummaryResponse {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  success_rate: number;
  period_start: string;
  period_end: string;
}

export interface EndpointUsageResponse {
  endpoint: string;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  success_rate: number;
}

export interface ProviderUsageResponse {
  provider: string;
  model: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

export interface UserUsageResponse {
  user_id: number;
  user_email: string;
  user_name: string | null;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

export interface TimeSeriesResponse {
  granularity: "hour" | "day" | "week";
  data: TimeSeriesDataPoint[];
}

export interface PricingConfigResponse {
  id: number;
  provider: string;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  effective_date: string;
  is_active: boolean;
}
```

---

## 4.2 Add API Client Functions

**File:** `/frontend/src/lib/api/client.ts`

Add to `adminApi` object:

```typescript
// AI Usage endpoints
getAIUsageSummary: async (startDate: string, endDate: string) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return fetchWithAuth<AIUsageSummaryResponse>(
    `${API_BASE_URL}/admin/ai-usage/summary?${params}`
  );
},

getAIUsageByEndpoint: async (startDate: string, endDate: string) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return fetchWithAuth<EndpointUsageResponse[]>(
    `${API_BASE_URL}/admin/ai-usage/by-endpoint?${params}`
  );
},

getAIUsageByProvider: async (startDate: string, endDate: string) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return fetchWithAuth<ProviderUsageResponse[]>(
    `${API_BASE_URL}/admin/ai-usage/by-provider?${params}`
  );
},

getAIUsageByUser: async (startDate: string, endDate: string, limit: number = 10) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    limit: limit.toString(),
  });
  return fetchWithAuth<UserUsageResponse[]>(
    `${API_BASE_URL}/admin/ai-usage/by-user?${params}`
  );
},

getAIUsageTimeSeries: async (
  startDate: string,
  endDate: string,
  granularity: "hour" | "day" | "week" = "day"
) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
  return fetchWithAuth<TimeSeriesResponse>(
    `${API_BASE_URL}/admin/ai-usage/time-series?${params}`
  );
},

getAIPricing: async () => {
  return fetchWithAuth<PricingConfigResponse[]>(
    `${API_BASE_URL}/admin/ai-usage/pricing`
  );
},
```

---

## 4.3 Add React Query Hooks

**File:** `/frontend/src/lib/api/hooks.ts`

Add query keys and hooks:

```typescript
// Add to queryKeys object
aiUsage: {
  all: ["aiUsage"] as const,
  summary: (start: string, end: string) =>
    [...queryKeys.aiUsage.all, "summary", start, end] as const,
  byEndpoint: (start: string, end: string) =>
    [...queryKeys.aiUsage.all, "byEndpoint", start, end] as const,
  byProvider: (start: string, end: string) =>
    [...queryKeys.aiUsage.all, "byProvider", start, end] as const,
  byUser: (start: string, end: string, limit: number) =>
    [...queryKeys.aiUsage.all, "byUser", start, end, limit] as const,
  timeSeries: (start: string, end: string, granularity: string) =>
    [...queryKeys.aiUsage.all, "timeSeries", start, end, granularity] as const,
  pricing: () => [...queryKeys.aiUsage.all, "pricing"] as const,
},

// Hooks
export function useAIUsageSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.summary(startDate, endDate),
    queryFn: () => adminApi.getAIUsageSummary(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByEndpoint(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byEndpoint(startDate, endDate),
    queryFn: () => adminApi.getAIUsageByEndpoint(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByProvider(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byProvider(startDate, endDate),
    queryFn: () => adminApi.getAIUsageByProvider(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByUser(startDate: string, endDate: string, limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byUser(startDate, endDate, limit),
    queryFn: () => adminApi.getAIUsageByUser(startDate, endDate, limit),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageTimeSeries(
  startDate: string,
  endDate: string,
  granularity: "hour" | "day" | "week" = "day"
) {
  return useQuery({
    queryKey: queryKeys.aiUsage.timeSeries(startDate, endDate, granularity),
    queryFn: () => adminApi.getAIUsageTimeSeries(startDate, endDate, granularity),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIPricing() {
  return useQuery({
    queryKey: queryKeys.aiUsage.pricing(),
    queryFn: () => adminApi.getAIPricing(),
  });
}
```

---

## 4.4 Create Dashboard Page

**File:** `/frontend/src/app/(protected)/admin/ai-usage/page.tsx`

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  useAIUsageSummary,
  useAIUsageByEndpoint,
  useAIUsageByProvider,
  useAIUsageByUser,
} from "@/lib/api/hooks";

type TimeRange = "24h" | "7d" | "30d";

function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "24h":
      start.setHours(start.getHours() - 24);
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AIUsageDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [activeTab, setActiveTab] = useState<"endpoint" | "provider" | "user">("endpoint");

  const { start, end } = useMemo(() => getDateRange(timeRange), [timeRange]);

  const { data: summary, isLoading: summaryLoading } = useAIUsageSummary(start, end);
  const { data: byEndpoint, isLoading: endpointLoading } = useAIUsageByEndpoint(start, end);
  const { data: byProvider, isLoading: providerLoading } = useAIUsageByProvider(start, end);
  const { data: byUser, isLoading: userLoading } = useAIUsageByUser(start, end, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Usage Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor AI API usage, costs, and performance across all endpoints.
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(["24h", "7d", "30d"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeRange === range
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {range === "24h" ? "Last 24 Hours" : range === "7d" ? "Last 7 Days" : "Last 30 Days"}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard
          label="Total Requests"
          value={summary ? formatNumber(summary.total_requests) : "-"}
          loading={summaryLoading}
        />
        <StatsCard
          label="Total Cost"
          value={summary ? formatCurrency(summary.total_cost_usd) : "-"}
          loading={summaryLoading}
        />
        <StatsCard
          label="Total Tokens"
          value={summary ? formatNumber(summary.total_tokens) : "-"}
          loading={summaryLoading}
        />
        <StatsCard
          label="Avg Latency"
          value={summary ? `${Math.round(summary.avg_latency_ms)}ms` : "-"}
          loading={summaryLoading}
        />
        <StatsCard
          label="Success Rate"
          value={summary ? `${(summary.success_rate * 100).toFixed(1)}%` : "-"}
          loading={summaryLoading}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {[
            { id: "endpoint" as const, label: "By Endpoint" },
            { id: "provider" as const, label: "By Provider" },
            { id: "user" as const, label: "By User" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === "endpoint" && (
          <EndpointTable data={byEndpoint || []} loading={endpointLoading} />
        )}
        {activeTab === "provider" && (
          <ProviderTable data={byProvider || []} loading={providerLoading} />
        )}
        {activeTab === "user" && (
          <UserTable data={byUser || []} loading={userLoading} />
        )}
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="h-7 mt-1 bg-muted animate-pulse rounded" />
      ) : (
        <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
      )}
    </div>
  );
}

// Endpoint Table Component
function EndpointTable({
  data,
  loading,
}: {
  data: Array<{
    endpoint: string;
    request_count: number;
    total_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number;
    success_rate: number;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return <TableSkeleton rows={5} cols={5} />;
  }

  if (data.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No usage data for this period.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-3 font-medium text-muted-foreground">Endpoint</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Requests</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Tokens</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Cost</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Latency</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.endpoint} className="border-b border-border/50">
            <td className="py-3 font-mono text-xs">{row.endpoint}</td>
            <td className="py-3 text-right">{formatNumber(row.request_count)}</td>
            <td className="py-3 text-right">{formatNumber(row.total_tokens)}</td>
            <td className="py-3 text-right">{formatCurrency(row.total_cost_usd)}</td>
            <td className="py-3 text-right">{Math.round(row.avg_latency_ms)}ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Provider Table Component
function ProviderTable({
  data,
  loading,
}: {
  data: Array<{
    provider: string;
    model: string;
    request_count: number;
    input_tokens: number;
    output_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return <TableSkeleton rows={4} cols={6} />;
  }

  if (data.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No usage data for this period.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-3 font-medium text-muted-foreground">Provider / Model</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Requests</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Input</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Output</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Cost</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Latency</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={`${row.provider}-${row.model}`} className="border-b border-border/50">
            <td className="py-3">
              <span className="font-medium">{row.provider}</span>
              <span className="text-muted-foreground"> / {row.model}</span>
            </td>
            <td className="py-3 text-right">{formatNumber(row.request_count)}</td>
            <td className="py-3 text-right">{formatNumber(row.input_tokens)}</td>
            <td className="py-3 text-right">{formatNumber(row.output_tokens)}</td>
            <td className="py-3 text-right">{formatCurrency(row.total_cost_usd)}</td>
            <td className="py-3 text-right">{Math.round(row.avg_latency_ms)}ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// User Table Component
function UserTable({
  data,
  loading,
}: {
  data: Array<{
    user_id: number;
    user_email: string;
    user_name: string | null;
    request_count: number;
    total_tokens: number;
    total_cost_usd: number;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return <TableSkeleton rows={5} cols={4} />;
  }

  if (data.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No user data for this period.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-3 font-medium text-muted-foreground">User</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Requests</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Tokens</th>
          <th className="text-right py-3 font-medium text-muted-foreground">Cost</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.user_id} className="border-b border-border/50">
            <td className="py-3">
              <div className="font-medium">{row.user_name || "Unknown"}</div>
              <div className="text-xs text-muted-foreground">{row.user_email}</div>
            </td>
            <td className="py-3 text-right">{formatNumber(row.request_count)}</td>
            <td className="py-3 text-right">{formatNumber(row.total_tokens)}</td>
            <td className="py-3 text-right">{formatCurrency(row.total_cost_usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Table Loading Skeleton
function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-6 bg-muted animate-pulse rounded flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## 4.5 Update Sidebar Navigation

**File:** `/frontend/src/components/layout/Sidebar.tsx`

Replace the admin section (lines 111-133) with:

```tsx
{/* Admin Section */}
{user?.is_admin && (
  <div className="py-2 px-3 space-y-0.5">
    <Link
      href="/admin/ai-usage"
      className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
        pathname === "/admin/ai-usage"
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <svg
        className={`h-5 w-5 shrink-0 ${
          pathname === "/admin/ai-usage"
            ? "text-sidebar-primary-foreground"
            : "text-sidebar-foreground/60"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
      AI Usage
    </Link>
    <Link
      href="/admin/scraper"
      className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
        pathname === "/admin/scraper"
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 overflow-visible">
        <Image
          src="/icons/apify-symbol-safe.png"
          alt="Import Jobs"
          width={30}
          height={30}
        />
      </span>
      Import Jobs
    </Link>
  </div>
)}
```

---

## Verification

1. **Sidebar Navigation:**
   - Login as admin user
   - Verify "AI Usage" link appears above "Import Jobs"
   - Verify non-admin users don't see the link

2. **Dashboard Page:**
   - Navigate to `/admin/ai-usage`
   - Verify time range selector works (24h, 7d, 30d)
   - Verify stats cards show summary data
   - Verify tabs switch between endpoint/provider/user views
   - Verify tables show correct data
   - Verify loading states display properly
   - Verify empty states when no data exists

3. **Responsive Design:**
   - Test on mobile viewport
   - Verify tables scroll horizontally if needed
   - Verify stats cards stack properly

4. **Dark Mode:**
   - Toggle dark mode
   - Verify all elements use proper dark mode colors
