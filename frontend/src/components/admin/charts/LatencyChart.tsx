"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface EndpointData {
  endpoint: string;
  avg_latency_ms: number;
  request_count: number;
}

interface LatencyChartProps {
  data: EndpointData[];
  loading: boolean;
}

// Color coding based on latency thresholds
function getLatencyColor(latency: number): string {
  if (latency < 100) return "var(--color-chart-2)"; // Green - fast
  if (latency < 500) return "var(--color-chart-3)"; // Yellow/orange - moderate
  return "var(--color-chart-5)"; // Red - slow
}

function formatLatency(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { endpoint: string; avg_latency_ms: number; request_count: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const latencyLabel =
    data.avg_latency_ms < 100
      ? "Fast"
      : data.avg_latency_ms < 500
        ? "Moderate"
        : "Slow";

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1 font-mono">{data.endpoint}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatLatency(data.avg_latency_ms)}
        <span className="text-xs text-muted-foreground ml-2">({latencyLabel})</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {data.request_count.toLocaleString()} requests
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[180px] bg-muted/30 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Loading chart...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[180px] bg-muted/30 rounded-lg flex items-center justify-center">
      <span className="text-muted-foreground text-sm">No data available</span>
    </div>
  );
}

export function LatencyChart({ data, loading }: LatencyChartProps) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  // Sort by latency descending (slowest first) and take top entries
  const chartData = [...data]
    .sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      // Shorten endpoint names for display
      shortEndpoint: item.endpoint.replace(/^\/api\/v\d+/, ""),
    }));

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tickFormatter={formatLatency}
          />
          <YAxis
            type="category"
            dataKey="shortEndpoint"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.2 }} />
          <Bar dataKey="avg_latency_ms" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getLatencyColor(entry.avg_latency_ms)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
