# AI Usage Dashboard Visual Charts

## Overview

Add visual time-series charts to the existing AI Usage dashboard at `/admin/ai-usage` to provide graphical representation of usage trends over time.

## Current State

- Dashboard exists at `frontend/src/app/(protected)/admin/ai-usage/page.tsx`
- Has: StatsCards (5), time range selector (24h/7d/30d), tabbed tables (endpoint/provider/user)
- Missing: Visual charts for time-series data
- Backend `time-series` API exists but is not being used
- Chart color CSS variables are defined in `globals.css` (lines 35-40, 94-99)

## Implementation Plan

### Step 1: Install Recharts

```bash
cd frontend && bun add recharts
```

Recharts is React-native, lightweight (~35KB), and supports CSS variables for theming.

### Step 2: Create Chart Components

Create `frontend/src/components/admin/charts/` directory with:

**`UsageTimeSeriesChart.tsx`**

- Area chart showing usage trends over time
- Props: `data`, `loading`, `metric`, `granularity`
- Uses Recharts `AreaChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`
- Gradient fill for visual appeal
- Custom tooltip matching card styling

**`MetricToggle.tsx`**

- Toggle buttons for: Requests | Tokens | Cost
- Styled consistently with time range selector

### Step 3: Integrate into Dashboard Page

Modify `frontend/src/app/(protected)/admin/ai-usage/page.tsx`:

1. Import `useAIUsageTimeSeries` hook (already exists in hooks.ts)
2. Add state for `selectedMetric`
3. Derive `granularity` from `timeRange`:
   - 24h -> "hour"
   - 7d/30d -> "day"
4. Insert chart section between Stats Cards and Tabs

**New Layout:**

```text
[Header]
[Time Range Selector]
[Stats Cards - 5 across]
[Usage Over Time Chart]  <-- NEW
[Tabs: Endpoint | Provider | User]
[Table content]
```

### Step 4: Chart Styling

Use existing CSS variables for dark mode compatibility:

```typescript
const chartColors = {
  requests: "var(--color-chart-1)",
  tokens: "var(--color-chart-2)",
  cost: "var(--color-chart-3)",
  grid: "var(--color-border)",
  text: "var(--color-muted-foreground)",
};
```

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/package.json` | Add recharts dependency |
| `frontend/src/app/(protected)/admin/ai-usage/page.tsx` | Import chart, add time-series hook, add chart section |

## Files to Create

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/admin/charts/UsageTimeSeriesChart.tsx` | Main chart component |
| `frontend/src/components/admin/charts/MetricToggle.tsx` | Metric selection toggle |

## Verification

1. Run `bun dev` and navigate to `/admin/ai-usage`
2. Verify chart renders with data
3. Test metric toggle (Requests/Tokens/Cost)
4. Test time range changes update chart granularity
5. Verify dark mode styling
6. Check loading state displays skeleton
7. Check empty state when no data
