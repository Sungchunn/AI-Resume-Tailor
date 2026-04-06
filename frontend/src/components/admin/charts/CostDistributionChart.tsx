"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface ProviderData {
  provider: string;
  model: string;
  total_cost_usd: number;
}

interface CostDistributionChartProps {
  data: ProviderData[];
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { provider: string; model: string; total_cost_usd: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">
        {data.provider} / {data.model}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(data.total_cost_usd)}
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

export function CostDistributionChart({ data, loading }: CostDistributionChartProps) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  // Aggregate by provider/model and sort by cost descending
  const chartData = [...data]
    .sort((a, b) => b.total_cost_usd - a.total_cost_usd)
    .map((item) => ({
      ...item,
      name: `${item.provider}/${item.model}`,
    }));

  const totalCost = chartData.reduce((sum, item) => sum + item.total_cost_usd, 0);

  return (
    <div className="h-[180px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="total_cost_usd"
            nameKey="name"
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
            wrapperStyle={{ fontSize: "11px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center -mt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(totalCost)}</p>
        </div>
      </div>
    </div>
  );
}
