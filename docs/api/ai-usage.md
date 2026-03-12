# AI Usage Dashboard API

## Overview

The AI Usage Dashboard API provides administrative endpoints for monitoring AI token usage, costs, and performance metrics. These endpoints enable cost tracking, usage analysis, and pricing configuration management.

**Base Path:** `/api/admin/ai-usage`

**Authentication:** All endpoints require admin role (`is_admin: true`)

---

## Usage Summary

### Get Usage Summary

Get aggregated AI usage statistics for a time period.

```http
GET /api/admin/ai-usage/summary
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `start_date` | datetime | Yes | Start of time range (inclusive), ISO 8601 format |
| `end_date` | datetime | Yes | End of time range (exclusive), ISO 8601 format |

**Example Request:**

```bash
curl "http://localhost:8000/api/admin/ai-usage/summary?start_date=2026-03-01T00:00:00Z&end_date=2026-03-13T00:00:00Z" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**

```json
{
  "total_requests": 1500,
  "successful_requests": 1485,
  "failed_requests": 15,
  "total_input_tokens": 2500000,
  "total_output_tokens": 750000,
  "total_tokens": 3250000,
  "total_cost_usd": 12.45,
  "avg_latency_ms": 850.5,
  "success_rate": 0.99,
  "period_start": "2026-03-01T00:00:00.000000",
  "period_end": "2026-03-13T00:00:00.000000"
}
```

---

## Usage Breakdowns

### Get Usage by Endpoint

Get AI usage breakdown by API endpoint.

```http
GET /api/admin/ai-usage/by-endpoint
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `start_date` | datetime | Yes | Start of time range (inclusive) |
| `end_date` | datetime | Yes | End of time range (exclusive) |

**Response (200 OK):**

```json
[
  {
    "endpoint": "/v1/ai/chat",
    "request_count": 500,
    "total_tokens": 1250000,
    "total_cost_usd": 5.25,
    "avg_latency_ms": 920.3,
    "success_rate": 0.98
  },
  {
    "endpoint": "/api/tailor/generate",
    "request_count": 350,
    "total_tokens": 875000,
    "total_cost_usd": 3.50,
    "avg_latency_ms": 1100.5,
    "success_rate": 0.99
  }
]
```

---

### Get Usage by Provider

Get AI usage breakdown by provider and model.

```http
GET /api/admin/ai-usage/by-provider
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `start_date` | datetime | Yes | Start of time range (inclusive) |
| `end_date` | datetime | Yes | End of time range (exclusive) |

**Response (200 OK):**

```json
[
  {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "request_count": 1200,
    "input_tokens": 2000000,
    "output_tokens": 600000,
    "total_tokens": 2600000,
    "total_cost_usd": 8.50,
    "avg_latency_ms": 750.2
  },
  {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "request_count": 300,
    "input_tokens": 500000,
    "output_tokens": 0,
    "total_tokens": 500000,
    "total_cost_usd": 0.10,
    "avg_latency_ms": 120.5
  }
]
```

---

### Get Usage by User

Get top users by AI usage.

```http
GET /api/admin/ai-usage/by-user
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `start_date` | datetime | Yes | Start of time range (inclusive) |
| `end_date` | datetime | Yes | End of time range (exclusive) |
| `limit` | integer | No | Number of users to return (1-50, default: 10) |

**Response (200 OK):**

```json
[
  {
    "user_id": 42,
    "user_email": "heavy_user@example.com",
    "user_name": "John Doe",
    "request_count": 150,
    "total_tokens": 500000,
    "total_cost_usd": 2.15
  },
  {
    "user_id": 17,
    "user_email": "power_user@example.com",
    "user_name": "Jane Smith",
    "request_count": 120,
    "total_tokens": 380000,
    "total_cost_usd": 1.65
  }
]
```

---

## Time Series Data

### Get Usage Time Series

Get usage data over time for charting.

```http
GET /api/admin/ai-usage/time-series
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `start_date` | datetime | Yes | Start of time range (inclusive) |
| `end_date` | datetime | Yes | End of time range (exclusive) |
| `granularity` | string | No | Time bucket size: `hour`, `day`, `week` (default: `day`) |

**Example Request:**

```bash
curl "http://localhost:8000/api/admin/ai-usage/time-series?start_date=2026-03-01T00:00:00Z&end_date=2026-03-13T00:00:00Z&granularity=day" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**

```json
{
  "granularity": "day",
  "data": [
    {
      "timestamp": "2026-03-01T00:00:00.000000",
      "request_count": 120,
      "total_tokens": 300000,
      "total_cost_usd": 1.25,
      "avg_latency_ms": 820.5
    },
    {
      "timestamp": "2026-03-02T00:00:00.000000",
      "request_count": 135,
      "total_tokens": 340000,
      "total_cost_usd": 1.40,
      "avg_latency_ms": 795.3
    }
  ]
}
```

---

## Pricing Configuration

### Get Active Pricing

Get all active AI pricing configurations.

```http
GET /api/admin/ai-usage/pricing
```

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "input_cost_per_1k": 0.0001,
    "output_cost_per_1k": 0.0004,
    "effective_date": "2026-03-01T00:00:00.000000",
    "is_active": true
  },
  {
    "id": 2,
    "provider": "openai",
    "model": "text-embedding-3-small",
    "input_cost_per_1k": 0.00002,
    "output_cost_per_1k": 0.0,
    "effective_date": "2026-03-01T00:00:00.000000",
    "is_active": true
  }
]
```

---

### Update Pricing

Update an existing pricing configuration.

```http
PUT /api/admin/ai-usage/pricing/{config_id}
```

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `config_id` | integer | Pricing configuration ID |

**Request Body:**

All fields optional:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `input_cost_per_1k` | float | Cost per 1K input tokens (USD) |
| `output_cost_per_1k` | float | Cost per 1K output tokens (USD) |
| `is_active` | boolean | Whether config is active |

**Example Request:**

```bash
curl -X PUT http://localhost:8000/api/admin/ai-usage/pricing/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input_cost_per_1k": 0.00015,
    "output_cost_per_1k": 0.0006
  }'
```

**Response (200 OK):**

Returns the updated pricing configuration.

**Error Responses:**

| Status | Condition |
| ------ | --------- |
| 404 | Pricing configuration not found |

---

### Create Pricing

Create a new pricing configuration for a provider/model combination.

```http
POST /api/admin/ai-usage/pricing
```

**Request Body:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `provider` | string | Yes | AI provider name (e.g., `gemini`, `openai`) |
| `model` | string | Yes | Model identifier |
| `input_cost_per_1k` | float | Yes | Cost per 1K input tokens (USD) |
| `output_cost_per_1k` | float | Yes | Cost per 1K output tokens (USD) |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/admin/ai-usage/pricing \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-2.0-pro",
    "input_cost_per_1k": 0.00125,
    "output_cost_per_1k": 0.005
  }'
```

**Response (201 Created):**

```json
{
  "id": 3,
  "provider": "gemini",
  "model": "gemini-2.0-pro",
  "input_cost_per_1k": 0.00125,
  "output_cost_per_1k": 0.005,
  "effective_date": "2026-03-13T10:30:00.000000",
  "is_active": true
}
```

---

## Data Models

### AIUsageSummaryResponse

```typescript
{
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  success_rate: number;           // 0.0 to 1.0
  period_start: string;           // ISO 8601
  period_end: string;             // ISO 8601
}
```

### EndpointUsageResponse

```typescript
{
  endpoint: string;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  success_rate: number;
}
```

### ProviderUsageResponse

```typescript
{
  provider: string;
  model: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}
```

### UserUsageResponse

```typescript
{
  user_id: number;
  user_email: string;
  user_name: string | null;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
}
```

### TimeSeriesResponse

```typescript
{
  granularity: "hour" | "day" | "week";
  data: TimeSeriesDataPoint[];
}
```

### TimeSeriesDataPoint

```typescript
{
  timestamp: string;              // ISO 8601
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}
```

### PricingConfigResponse

```typescript
{
  id: number;
  provider: string;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  effective_date: string;         // ISO 8601
  is_active: boolean;
}
```

### PricingConfigCreate

```typescript
{
  provider: string;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
}
```

### PricingConfigUpdate

```typescript
{
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  is_active?: boolean;
}
```

---

## Usage Notes

- All endpoints require the user to have `is_admin: true` in the database
- Date ranges use inclusive start and exclusive end (`[start, end)`)
- Costs are calculated at request time using active pricing configurations
- Time series data uses PostgreSQL `date_trunc` for accurate bucketing
- Usage data includes both LLM generation and embedding operations

---

## Related Endpoints

- [Admin API](admin.md) - Scraper and system administration
- [AI Chat](ai-chat.md) - AI-powered improvements (generates usage logs)
