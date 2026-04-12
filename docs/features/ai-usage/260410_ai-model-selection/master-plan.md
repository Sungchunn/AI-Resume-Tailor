# AI Model Selection & Usage Tracking

## Context

Currently, the AI model is a global singleton set via environment variable (`OPENAI_MODEL=gpt-4o-mini`). Users cannot choose which model powers their AI features. Additionally, several ATS keyword endpoints make AI calls without logging usage to the `ai_usage_logs` table.

**Goals:**

1. Let users select their preferred AI model (gpt-4o-mini, gpt-4o, o3-mini) via a dropdown in the editor header bar, persisted to the database
2. Default ATS scoring endpoints to `gpt-4o` (best OpenAI model for structured extraction/classification)
3. Close AI usage tracking gaps on ATS keyword endpoints

## Available Models

| Model ID | Display Name | Description | Input $/1K | Output $/1K |
| --------- | ------------ | ----------- | ---------- | ----------- |
| `gpt-4o-mini` | GPT-4o Mini | Fast & cost-effective | 0.00015 | 0.0006 |
| `gpt-4o` | GPT-4o | Most capable, best quality | 0.0025 | 0.01 |
| `o3-mini` | o3 Mini | Reasoning model, complex analysis | 0.0011 | 0.0044 |

**Endpoint defaults (when user has no preference):**

- ATS endpoints (`/ats/*`): `gpt-4o` -- best at structured keyword extraction and classification
- General AI (`/ai/chat`, `/ai/improve-section`): `gpt-4o-mini` -- cost-effective for conversational tasks
- Tailoring, parsing, profile: `gpt-4o-mini` -- existing behavior unchanged

---

## Phase 1: Backend Foundation

### 1.1 Database Migration

Add `preferred_ai_model` column to `users` table.

**File:** `backend/alembic/versions/20260410_add_user_ai_model_preference.py`

```text
- Add column: preferred_ai_model VARCHAR(50) NULLABLE DEFAULT NULL
- NULL means "use endpoint default"
```

### 1.2 Available Models Config

**New file:** `backend/app/core/ai_models.py`

```python
AVAILABLE_AI_MODELS = [
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast & cost-effective", "provider": "openai", "default_for": ["general"]},
    {"id": "gpt-4o", "name": "GPT-4o", "description": "Most capable, best quality", "provider": "openai", "default_for": ["ats"]},
    {"id": "o3-mini", "name": "o3 Mini", "description": "Reasoning model for complex analysis", "provider": "openai", "default_for": []},
]

ENDPOINT_MODEL_DEFAULTS = {
    "ats": "gpt-4o",
    "general": "gpt-4o-mini",
}
```

### 1.3 AI Client Factory Enhancement

**File:** `backend/app/services/ai/client.py`

Add `get_ai_client_for_model(model: str) -> AIClient`:

- Validates model is in `AVAILABLE_AI_MODELS`
- Caches clients per model string (dict-based cache, not `@lru_cache`)
- Reuses the same OpenAI API key from settings, just different model
- Falls back to `get_ai_client()` if model matches the default

### 1.4 Pricing Migration

**File:** `backend/alembic/versions/20260410_add_model_pricing.py`

Seed pricing configs for `gpt-4o` and `o3-mini` in `ai_pricing_configs` table (gpt-4o-mini already exists).

### 1.5 Model Resolution Dependency

**File:** `backend/app/api/deps.py`

Add helper function `resolve_ai_model(user_id, db, category) -> str`:

- Reads user's `preferred_ai_model` from DB
- If NULL, returns `ENDPOINT_MODEL_DEFAULTS[category]`
- Validates model exists in available list

### 1.6 User AI Preferences API

**File:** `backend/app/api/routes/users.py` (add to existing user routes)

- `GET /api/v1/users/me/ai-preferences` -> `{preferred_model: str | null, available_models: [...]}`
- `PUT /api/v1/users/me/ai-preferences` -> `{preferred_model: str | null}` (null = reset to defaults)

**File:** `backend/app/schemas/user.py` (add schemas)

- `AIPreferencesResponse` -- model preference + available models list
- `AIPreferencesUpdate` -- model string or null

---

## Phase 2: Update AI-Calling Endpoints

### 2.1 Thread Model Through ATS Analyzers

The `KeywordExtractor` already has a property setter for `_ai_client` (used by tests). Leverage this pattern:

**Files to modify:**

- `backend/app/services/job/ats/analyzers/keyword/extractor.py` -- Add `ai_client` constructor param (optional, falls back to singleton)
- `backend/app/services/job/ats/analyzers/keyword/analyzer.py` -- Add `ai_client` constructor param, pass to extractor
- `backend/app/services/job/ats/facade.py` -- Add `ai_client` constructor param, pass to keyword analyzer. Keep `get_ats_analyzer()` singleton for backward compat; add `create_ats_analyzer(ai_client)` for per-request use.

### 2.2 Update ATS Route Handlers with Model Selection

**`backend/app/api/routes/ats/keywords.py`:**

- `/keywords` (line 45): Resolve user model (ats default), create analyzer with that client
- `/keywords/detailed` (line 86): Same pattern
- `/keywords/enhanced` (line 149): Same pattern
- `/keywords/extract` (line 299): Already has AI tracking. Add model resolution.

**`backend/app/api/routes/ats/knockout.py`:**

- Replace `get_ai_client()` with `get_ai_client_for_model(resolved_model)`

**`backend/app/api/routes/ats/role_proximity.py`:**

- Replace `get_ai_client()` with `get_ai_client_for_model(resolved_model)`

**`backend/app/api/routes/ats/content.py`:**

- Replace `get_ai_client()` with `get_ai_client_for_model(resolved_model)`

**`backend/app/api/routes/ats/progressive.py`:**

- Add `model` query parameter (optional)
- Resolve model, pass to helper functions

### 2.3 Update General AI Endpoints with Model Selection

**`backend/app/api/routes/ai.py`:**

- `/ai/improve-section`: Resolve user model (general default), use `get_ai_client_for_model()`
- `/ai/chat`: Same

**`backend/app/api/routes/tailor.py`:**

- Resolve user model (general default) for tailoring calls

**`backend/app/api/routes/profile.py`:**

- Resolve user model (general default) for profile generation

### 2.4 Add return_metrics to Facade Methods

**`backend/app/services/job/ats/facade.py`:**

- `analyze_keywords()`: Add `return_metrics=False` param, thread to keyword analyzer
- `analyze_keywords_detailed()`: Add `return_metrics=False` param, thread to keyword analyzer

**`backend/app/services/job/ats/analyzers/keyword/analyzer.py`:**

- `analyze_keywords()`: Add `return_metrics` support -- extract from internal extractor call
- `analyze_keywords_detailed()`: Add `return_metrics` support

---

## Phase 3: Close AI Usage Tracking Gaps

### Endpoints Currently Missing Tracking

| Endpoint | AI Call | Fix |
| -------- | ------- | --- |
| `POST /ats/keywords` | `analyzer.analyze_keywords()` | Add `return_metrics=True`, log with tracker |
| `POST /ats/keywords/detailed` | `analyzer.analyze_keywords_detailed()` | Add `return_metrics=True`, log with tracker |
| `POST /ats/keywords/enhanced` | `analyzer.analyze_keywords_enhanced()` | Already supports `return_metrics` -- just call with `True` and log |

Pattern for each (same as existing `/ats/keywords/extract`):

```python
result, ai_metrics = await analyzer.method(..., return_metrics=True)
if ai_metrics:
    usage_tracker = get_usage_tracker()
    await usage_tracker.log_generation(
        db=db, user_id=user_id, endpoint="/ats/keywords/...", response=ai_metrics
    )
    await db.commit()
```

---

## Phase 4: Frontend

### 4.1 Types

**File:** `frontend/src/lib/api/types.ts`

```typescript
export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: string;
}

export interface AIPreferencesResponse {
  preferred_model: string | null;
  available_models: AIModel[];
}

export interface AIPreferencesUpdate {
  preferred_model: string | null;
}
```

### 4.2 API Client

**File:** `frontend/src/lib/api/client.ts`

Add to `userApi`:

- `getAIPreferences(): Promise<AIPreferencesResponse>`
- `updateAIPreferences(data: AIPreferencesUpdate): Promise<AIPreferencesResponse>`

### 4.3 React Query Hooks

**File:** `frontend/src/lib/api/hooks.ts`

- `useAIPreferences()` -- query hook
- `useUpdateAIPreferences()` -- mutation hook, invalidates preferences query on success

### 4.4 Model Selector Component

**New file:** `frontend/src/components/library/editor/AIModelSelector.tsx`

- Compact dropdown in editor header bar
- Shows current model name (e.g., "GPT-4o Mini")
- Dropdown shows all available models with descriptions
- On change: calls `updateAIPreferences` mutation
- Loading/disabled state while updating

### 4.5 EditorLayout Integration

**File:** `frontend/src/components/library/editor/EditorLayout.tsx`

- Import and render `AIModelSelector` in the header bar, between the title and save button
- Fetch user preferences on mount via `useAIPreferences()`

---

## Critical Files Summary

| File | Change Type |
| ---- | ----------- |
| `backend/app/models/user.py` | Add `preferred_ai_model` column |
| `backend/app/core/ai_models.py` | **New** - available models + defaults config |
| `backend/app/services/ai/client.py` | Add `get_ai_client_for_model()` factory |
| `backend/app/api/deps.py` | Add `resolve_ai_model()` helper |
| `backend/app/api/routes/users.py` | Add AI preferences endpoints |
| `backend/app/schemas/user.py` | Add preference schemas |
| `backend/app/services/job/ats/facade.py` | Add `ai_client` param + `return_metrics` to methods |
| `backend/app/services/job/ats/analyzers/keyword/analyzer.py` | Add `ai_client` param + `return_metrics` |
| `backend/app/services/job/ats/analyzers/keyword/extractor.py` | Add `ai_client` constructor param |
| `backend/app/api/routes/ats/keywords.py` | Model selection + usage tracking |
| `backend/app/api/routes/ats/knockout.py` | Model selection |
| `backend/app/api/routes/ats/role_proximity.py` | Model selection |
| `backend/app/api/routes/ats/content.py` | Model selection |
| `backend/app/api/routes/ats/progressive.py` | Model selection |
| `backend/app/api/routes/ai.py` | Model selection |
| `backend/app/api/routes/tailor.py` | Model selection |
| `backend/app/api/routes/profile.py` | Model selection |
| `backend/alembic/versions/` | **New** - 2 migration files |
| `frontend/src/lib/api/types.ts` | Add AI preference types |
| `frontend/src/lib/api/client.ts` | Add preference API methods |
| `frontend/src/lib/api/hooks.ts` | Add preference hooks |
| `frontend/src/components/library/editor/AIModelSelector.tsx` | **New** - model dropdown |
| `frontend/src/components/library/editor/EditorLayout.tsx` | Add model selector to header |

---

## Verification

1. **Backend unit test:** Create user, set `preferred_ai_model` to `gpt-4o`, verify `resolve_ai_model()` returns it
2. **API test:** `GET/PUT /users/me/ai-preferences` round-trip
3. **ATS tracking:** Call `/ats/keywords/detailed`, verify new row in `ai_usage_logs` with correct model
4. **Frontend manual test:** Open editor, change model in dropdown, verify preference persists on page reload
5. **Cost tracking:** Verify `ai_usage_logs` shows correct model and cost for gpt-4o calls vs gpt-4o-mini
