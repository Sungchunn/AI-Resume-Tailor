# AI Usage Dashboard Visual Charts

## Overview

Add visual charts to the existing AI Usage dashboard at `/admin/ai-usage` to provide graphical representation of usage data.

## Phase 1: Time-Series Chart (COMPLETED)

Added area chart with metric toggle for visualizing usage trends over time.

**Components Created:**

- `UsageTimeSeriesChart.tsx` - Area chart with gradient fill
- `MetricToggle.tsx` - Toggle for Requests/Tokens/Cost

**Integration:** Between Stats Cards and Tabs in the dashboard

## Phase 2: Analytics Charts

Add 4 additional charts using existing backend endpoints (frontend-only changes).

### Charts to Add

| Chart | Data Source | Purpose |
| ----- | ----------- | ------- |
| Cost Distribution Donut | by-provider | Visualize where money is going by provider/model |
| Token I/O Bar Chart | by-provider | Compare input vs output tokens - spot inefficient prompts |
| Endpoint Cost Ranking | by-endpoint | Which features/endpoints cost the most |
| Latency by Endpoint | by-endpoint | Performance monitoring - which endpoints are slowest |

### New Layout

```text
[Header]
[Time Range Selector]
[Stats Cards - 5 across]
[Usage Over Time Chart]              <- Phase 1

[Cost Distribution]  [Token I/O]     <- Phase 2 (2x2 grid)
[Endpoint Costs]     [Latency]

[Tabs: Endpoint | Provider | User]   <- existing tables for detail
[Table content]
```

### Files to Create

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/admin/charts/CostDistributionChart.tsx` | Donut chart for cost by provider |
| `frontend/src/components/admin/charts/TokenIOChart.tsx` | Grouped bar chart for input vs output tokens |
| `frontend/src/components/admin/charts/EndpointCostChart.tsx` | Horizontal bar chart for endpoint costs |
| `frontend/src/components/admin/charts/LatencyChart.tsx` | Horizontal bar chart for endpoint latency |

### Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/components/admin/charts/index.ts` | Export new chart components |
| `frontend/src/app/(protected)/admin/ai-usage/page.tsx` | Add new chart section with 2x2 grid |

### Component Specifications

#### CostDistributionChart.tsx

- Recharts `PieChart` with `Pie`, `Cell`, `Legend`
- Custom colors using `--color-chart-1` through `--color-chart-5`
- Inner radius for donut style
- Center label showing total cost
- Tooltip showing provider/model with exact $ amount

#### TokenIOChart.tsx

- Recharts `BarChart` with horizontal layout (`layout="vertical"`)
- Two bars per model: Input Tokens (blue), Output Tokens (green)
- Format large numbers with K/M suffixes
- Sorted by total tokens descending

#### EndpointCostChart.tsx

- Recharts `BarChart` with horizontal layout
- Single bar per endpoint showing cost
- Sorted by cost descending
- Format currency in tooltip/label

#### LatencyChart.tsx

- Recharts `BarChart` with horizontal layout
- Single bar per endpoint showing avg latency
- Color coded: <100ms green, 100-500ms yellow, >500ms red
- "Xms" labels

### Dashboard Page Changes

Add after time-series chart section (line ~149):

```tsx
{/* Analytics Charts Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="card">
    <h3 className="text-sm font-medium text-foreground mb-4">Cost by Provider</h3>
    <CostDistributionChart data={byProvider || []} loading={providerLoading} />
  </div>
  <div className="card">
    <h3 className="text-sm font-medium text-foreground mb-4">Token Usage by Model</h3>
    <TokenIOChart data={byProvider || []} loading={providerLoading} />
  </div>
  <div className="card">
    <h3 className="text-sm font-medium text-foreground mb-4">Cost by Endpoint</h3>
    <EndpointCostChart data={byEndpoint || []} loading={endpointLoading} />
  </div>
  <div className="card">
    <h3 className="text-sm font-medium text-foreground mb-4">Latency by Endpoint</h3>
    <LatencyChart data={byEndpoint || []} loading={endpointLoading} />
  </div>
</div>
```

### Styling

Chart colors from `globals.css`:

- `--color-chart-1`: Primary (blue)
- `--color-chart-2`: Secondary (green)
- `--color-chart-3`: Tertiary (orange)
- `--color-chart-4`, `--color-chart-5`: Additional colors

All charts:

- Height: 200-250px (smaller than time-series chart)
- Loading state: Skeleton with same dimensions
- Empty state: "No data" message

## Verification

1. Run `bun dev` and navigate to `/admin/ai-usage`
2. Verify all charts render correctly
3. Test with different time ranges (24h, 7d, 30d)
4. Verify loading states show skeletons
5. Verify empty states when no data
6. Check dark mode styling
7. Test responsive layout (charts stack on mobile)
8. Verify tooltips show correct values
