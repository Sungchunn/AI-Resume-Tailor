"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProviderData {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

interface TokenIOChartProps {
  data: ProviderData[];
  loading: boolean;
}

function formatTokens(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm text-foreground flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatTokens(entry.value)}
        </p>
      ))}
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

export function TokenIOChart({ data, loading }: TokenIOChartProps) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  // Sort by total tokens descending and format for chart
  const chartData = [...data]
    .sort((a, b) => (b.input_tokens + b.output_tokens) - (a.input_tokens + a.output_tokens))
    .map((item) => ({
      name: item.model,
      "Input Tokens": item.input_tokens,
      "Output Tokens": item.output_tokens,
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
            tickFormatter={formatTokens}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.2 }} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
            wrapperStyle={{ fontSize: "11px" }}
          />
          <Bar dataKey="Input Tokens" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Output Tokens" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
