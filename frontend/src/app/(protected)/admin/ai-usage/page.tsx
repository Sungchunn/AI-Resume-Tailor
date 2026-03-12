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
