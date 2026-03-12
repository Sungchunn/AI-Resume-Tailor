# AI Usage Dashboard - Master Plan

## Overview

An admin-only dashboard to track AI API usage (tokens, costs, latency) across all AI endpoints. The dashboard lives at `/admin/ai-usage`, positioned above the Apify scraper in the sidebar navigation.

---

## Problem Statement

Currently, AI operations are tracked in the AuditLog but without:

- Token counts (input/output)
- Cost per request
- Model/provider used per request
- Latency metrics

This makes it impossible to monitor AI spending, identify expensive operations, or optimize usage.

---

## Goals

1. Track per-request: endpoint, model, provider, tokens, cost, latency, user
2. Admin dashboard showing usage over time with breakdowns
3. Configurable pricing that can be updated as provider rates change
4. Identify top users and expensive endpoints

---

## Design Decisions

### 1. New Table vs Extending AuditLog

**Decision:** Create a new dedicated `ai_usage_logs` table

**Rationale:**

- AuditLog is designed for security/compliance auditing of CRUD operations
- AI usage tracking requires specific columns (tokens, cost, latency, model)
- Different retention policies may be needed
- AI logs have high cardinality with different query patterns (aggregations, time series)
- Existing AuditLog indexes are optimized for user/resource lookups, not time-based aggregations

### 2. Token Count Capture Strategy

**Decision:** Capture token counts from API responses at the client wrapper level

**Implementation:**

- Modify `BaseAIClient.generate()` to return `AIResponse` object with content + metrics
- OpenAI: `response.usage.prompt_tokens`, `response.usage.completion_tokens`
- Gemini: `response.usage_metadata.prompt_token_count`, `response.usage_metadata.candidates_token_count`

### 3. Pricing Configuration

**Decision:** Database-configurable pricing with seeded defaults

**Rationale:**

- Pricing changes frequently as AI providers update rates
- DB config allows runtime updates without deployment
- Seed migration provides sensible defaults

**Default Pricing (2026):**

| Model | Input $/1K | Output $/1K |
| ----- | ---------- | ----------- |
| gpt-4o-mini | $0.00015 | $0.0006 |
| gemini-2.0-flash | $0.000075 | $0.0003 |
| text-embedding-3-small | $0.00002 | N/A |
| text-embedding-004 | $0.000025 | N/A |

### 4. Dashboard UI Design

**Decision:** Card-based stats + tabbed breakdown views + time-range selector

Following the existing admin scraper page pattern for consistency.

---

## Implementation Phases

| Phase | Description | Files |
| ----- | ----------- | ----- |
| [Phase 1](./120326_phase-1-database.md) | Database models and migration | 3 new files |
| [Phase 2](./120326_phase-2-services.md) | Service layer modifications | 2 new, 2 modified |
| [Phase 3](./120326_phase-3-backend-api.md) | API endpoints and schemas | 3 new files |
| [Phase 4](./120326_phase-4-frontend.md) | Frontend dashboard | 4 new, 4 modified |

---

## File Changes Summary

### New Files (12)

| Path | Description |
| ---- | ----------- |
| `/backend/app/models/ai_usage_log.py` | Usage log model |
| `/backend/app/models/ai_pricing_config.py` | Pricing config model |
| `/backend/app/services/ai/response.py` | AIResponse dataclass |
| `/backend/app/services/ai/usage_tracker.py` | Usage tracking service |
| `/backend/app/crud/ai_usage.py` | CRUD operations |
| `/backend/app/schemas/ai_usage.py` | Pydantic schemas |
| `/backend/app/api/routes/admin_ai_usage.py` | Admin API routes |
| `/backend/alembic/versions/20260312_0003_*.py` | Migration |
| `/frontend/src/app/(protected)/admin/ai-usage/page.tsx` | Dashboard page |
| `/frontend/src/app/(protected)/admin/ai-usage/components/TimeRangeSelector.tsx` | Time selector |
| `/frontend/src/app/(protected)/admin/ai-usage/components/StatsCards.tsx` | Stats display |
| `/frontend/src/app/(protected)/admin/ai-usage/components/UsageTabs.tsx` | Tabbed breakdowns |

### Modified Files (8)

| Path | Changes |
| ---- | ------- |
| `/backend/app/models/__init__.py` | Export new models |
| `/backend/app/services/ai/client.py` | Return AIResponse with metrics |
| `/backend/app/services/ai/embedding.py` | Capture embedding token usage |
| `/backend/app/api/routes/__init__.py` | Register admin_ai_usage router |
| `/frontend/src/lib/api/types.ts` | Add AI usage types |
| `/frontend/src/lib/api/client.ts` | Add adminApi functions |
| `/frontend/src/lib/api/hooks.ts` | Add React Query hooks |
| `/frontend/src/components/layout/Sidebar.tsx` | Add AI Usage nav link |

---

## Verification Plan

### Backend Testing

1. Run migration: `alembic upgrade head`
2. Verify tables created: `ai_usage_logs`, `ai_pricing_configs`
3. Verify pricing seeded correctly
4. Make AI call and verify log created in database
5. Test each admin endpoint with curl/httpie

### Frontend Testing

1. Login as admin user
2. Verify "AI Usage" appears in sidebar above "Import Jobs"
3. Navigate to `/admin/ai-usage`
4. Verify stats cards show data
5. Test time range selector (24h, 7d, 30d)
6. Verify each tab shows correct breakdown data

### Integration Testing

1. Make several AI calls (improve section, chat, tailor)
2. Verify usage appears in dashboard with correct token counts
3. Verify costs calculated correctly against pricing config
4. Test non-admin user cannot access `/admin/ai-usage` (403)

---

## Notes & Considerations

1. **Breaking Change:** The AI client return type changes from `str` to `AIResponse`. All call sites need updating. Consider adding `generate_text()` compatibility method for gradual migration.

2. **Gemini Token Counts:** May need fallback estimation using tiktoken if not available in all response types.

3. **Cost Calculation:** Pricing captured at log time to avoid race conditions when pricing config is updated mid-request.

4. **High Volume:** Consider batch inserts and write-behind caching if usage volume becomes significant.
