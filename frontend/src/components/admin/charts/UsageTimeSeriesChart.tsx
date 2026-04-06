"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TimeSeriesDataPoint } from "@/lib/api/types";

export type MetricType = "requests" | "tokens" | "cost";

interface UsageTimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  loading: boolean;
  metric: MetricType;
  granularity: "hour" | "day" | "week";
}

const metricConfig: Record<
  MetricType,
  {
    dataKey: keyof TimeSeriesDataPoint;
    label: string;
    color: string;
    formatter: (value: number) => string;
  }
> = {
  requests: {
    dataKey: "request_count",
    label: "Requests",
    color: "var(--color-chart-1)",
    formatter: (v) => new Intl.NumberFormat("en-US").format(v),
  },
  tokens: {
    dataKey: "total_tokens",
    label: "Tokens",
    color: "var(--color-chart-2)",
    formatter: (v) => new Intl.NumberFormat("en-US").format(v),
  },
  cost: {
    dataKey: "total_cost_usd",
    label: "Cost",
    color: "var(--color-chart-3)",
    formatter: (v) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 4,
      }).format(v),
  },
};

function formatTimestamp(timestamp: string, granularity: "hour" | "day" | "week"): string {
  const date = new Date(timestamp);
  switch (granularity) {
    case "hour":
      return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    case "day":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "week":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: TimeSeriesDataPoint }>;
  label?: string;
  metric: MetricType;
  granularity: "hour" | "day" | "week";
}

function CustomTooltip({ active, payload, metric, granularity }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const config = metricConfig[metric];
  const dataPoint = payload[0].payload;
  const date = new Date(dataPoint.timestamp);

  const dateLabel =
    granularity === "hour"
      ? date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{dateLabel}</p>
      <p className="text-sm font-semibold text-foreground">
        {config.label}: {config.formatter(payload[0].value)}
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full min-h-[200px] bg-muted/30 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Loading chart...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full min-h-[200px] bg-muted/30 rounded-lg flex items-center justify-center">
      <span className="text-muted-foreground text-sm">No data available for this period</span>
    </div>
  );
}

export function UsageTimeSeriesChart({
  data,
  loading,
  metric,
  granularity,
}: UsageTimeSeriesChartProps) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  const config = metricConfig[metric];

  // Transform data for chart - add formatted timestamp for x-axis
  const chartData = data.map((point) => ({
    ...point,
    formattedTime: formatTimestamp(point.timestamp, granularity),
  }));

  return (
    <div className="h-full min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={config.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="formattedTime"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              metric === "cost"
                ? `$${value.toFixed(2)}`
                : value >= 1000
                  ? `${(value / 1000).toFixed(0)}k`
                  : value.toString()
            }
            width={50}
          />
          <Tooltip
            content={<CustomTooltip metric={metric} granularity={granularity} />}
            cursor={{ stroke: "var(--color-muted-foreground)", strokeOpacity: 0.3 }}
          />
          <Area
            type="monotone"
            dataKey={config.dataKey}
            stroke={config.color}
            strokeWidth={2}
            fill={`url(#gradient-${metric})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
