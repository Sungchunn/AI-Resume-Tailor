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
  total_cost_usd: number;
  request_count: number;
}

interface EndpointCostChartProps {
  data: EndpointData[];
  loading: boolean;
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { endpoint: string; total_cost_usd: number; request_count: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1 font-mono">{data.endpoint}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(data.total_cost_usd)}
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

export function EndpointCostChart({ data, loading }: EndpointCostChartProps) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  // Sort by cost descending and take top entries
  const chartData = [...data]
    .sort((a, b) => b.total_cost_usd - a.total_cost_usd)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      // Shorten endpoint names for display (remove api prefix, truncate if too long)
      shortEndpoint: truncateEndpoint(item.endpoint.replace(/^\/api\/v\d+/, ""), 18),
    }));

  function truncateEndpoint(name: string, maxLen: number): string {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen - 1) + "…";
  }

  return (
    <div className="h-[180px] w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tickFormatter={formatCurrencyShort}
          />
          <YAxis
            type="category"
            dataKey="shortEndpoint"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={140}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.2 }} />
          <Bar dataKey="total_cost_usd" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
