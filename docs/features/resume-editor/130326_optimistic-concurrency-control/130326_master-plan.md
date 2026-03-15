# Optimistic Concurrency Control: Master Plan

**Created:** 2026-03-13
**Status:** Planning
**Prerequisite For:** [Fit-to-One-Page](../fit-to-one-page/130326_master-plan.md) (Step 5: Save Coordination)

---

## Overview

Implement data integrity safeguards to prevent "Last Write Wins" (LWW) data clobbering in the resume editor. This establishes the foundation for the `useSaveCoordinator` hook required by the fit-to-one-page feature.

**Key Components:**

| Component | Scope | Purpose |
| --------- | ----- | ------- |
| Optimistic Concurrency Control (OCC) | Cross-device/session | Version checking prevents stale writes |
| BroadcastChannel API | Same-browser multi-tab | Notifies other tabs when saves complete |
| Conflict Resolution UI | User-facing | Freezes editor and prompts refresh on conflict |

---

## Relationship to Fit-to-One-Page

The fit-to-one-page feature requires **eager persistence** of auto-fitted styles. This introduces race condition risks documented in [Tradeoff 3: Eager Persistence](../fit-to-one-page/130326_tradeoff-3-eager-persistence.md).

The `useSaveCoordinator` hook specified in that document depends on:

1. **OCC backend support** - API returns HTTP 409 on version mismatch
2. **Version tracking** - Frontend tracks document version across saves
3. **BroadcastChannel** - Cross-tab synchronization within same browser
4. **Conflict UI** - User-facing resolution when conflict detected

This document plans the implementation of those dependencies.

---

## Architecture Note: MongoDB (Not PostgreSQL)

Resumes are stored in **MongoDB**, not PostgreSQL. The OCC implementation uses:

- MongoDB's atomic `findOneAndUpdate` with version matching
- `$inc` operator for atomic version increment
- No Alembic migrations required (MongoDB is schema-less)

---

## Implementation Phases

| Phase | Document | Key Deliverable |
| ----- | -------- | --------------- |
| 1 | [Backend OCC](./130326_phase-1-backend-occ.md) | Version field, atomic updates, HTTP 409 |
| 2 | [Frontend API](./130326_phase-2-frontend-api.md) | Types, error class, API client updates |
| 3 | [Save Coordinator](./130326_phase-3-save-coordinator.md) | `useSaveCoordinator` hook foundation |
| 4 | [BroadcastChannel](./130326_phase-4-broadcast-channel.md) | Cross-tab notification hook |
| 5 | [Conflict UI](./130326_phase-5-conflict-ui.md) | Modal, read-only state, BlockEditorProvider integration |

---

## Files Summary

### Backend (5 files)

| File | Action | Description |
| ---- | ------ | ----------- |
| `backend/app/models/mongo/resume.py` | Modify | Add `version` field to ResumeDocument and ResumeUpdate |
| `backend/app/crud/mongo/exceptions.py` | Create | New `VersionConflictError` exception |
| `backend/app/crud/mongo/resume.py` | Modify | Atomic update with version check |
| `backend/app/schemas/resume.py` | Modify | Add `version` to schemas |
| `backend/app/api/routes/resumes.py` | Modify | Handle 409 Conflict |

### Frontend (9 files)

| File | Action | Description |
| ---- | ------ | ----------- |
| `frontend/src/lib/api/types.ts` | Modify | Add `version` to types |
| `frontend/src/lib/api/errors.ts` | Create | `VersionConflictError` class |
| `frontend/src/lib/api/client.ts` | Modify | Handle 409 responses |
| `frontend/src/lib/api/hooks.ts` | Modify | Add conflict callback |
| `frontend/src/hooks/useSaveCoordinator.ts` | Create | Save coordination hook |
| `frontend/src/components/library/editor/hooks/useResumeBroadcast.ts` | Create | BroadcastChannel hook |
| `frontend/src/components/library/editor/ConflictModal.tsx` | Create | Conflict resolution UI |
| `frontend/src/components/library/editor/BlockEditorProvider.tsx` | Modify | Integrate OCC |
| `frontend/src/components/library/editor/BlockEditorContext.tsx` | Modify | Add context fields |

---

## Data Migration Strategy

**Approach:** Lazy migration (recommended)

Existing MongoDB documents lack the `version` field. Handle this gracefully:

```python
# In CRUD layer - treat missing version as 1
version = getattr(doc, "version", 1)
```

```typescript
// In frontend - treat missing version as 1
const version = resume.version ?? 1;
```

**Alternative:** One-time MongoDB script (if explicit migration preferred):

```javascript
db.resumes.updateMany(
  { version: { $exists: false } },
  { $set: { version: 1 } }
)
```

---

## Integration with useSaveCoordinator

The `useSaveCoordinator` hook (from fit-to-one-page Tradeoff 3) handles:

| Concern | Solution |
| ------- | -------- |
| Debounce management | Single timer ref with proper cleanup |
| Save operation lock | Prevents concurrent API calls within a tab |
| AI streaming awareness | Suspends auto-save during LLM operations |
| **OCC (this feature)** | Passes `version` to API; catches 409 |
| **BroadcastChannel (this feature)** | Notifies other tabs when save completes |

This OCC implementation provides the **backend support** and **frontend primitives** that `useSaveCoordinator` depends on.

---

## Verification Plan

See individual phase documents for detailed test cases.

### Quick Validation Checklist

| Test | Expected |
| ---- | -------- |
| Create resume | Response includes `version: 1` |
| Update resume | Response includes `version: 2` |
| Update with stale version | HTTP 409 with `error: "version_conflict"` |
| Frontend receives 409 | `VersionConflictError` thrown |
| ConflictModal appears | Editor frozen, refresh button visible |
| Two tabs open | Tab B sees conflict after Tab A saves |

---

## Related Documents

| Document | Relationship |
| -------- | ------------ |
| [Fit-to-One-Page Master Plan](../fit-to-one-page/130326_master-plan.md) | Parent feature requiring OCC |
| [Tradeoff 3: Eager Persistence](../fit-to-one-page/130326_tradeoff-3-eager-persistence.md) | Defines `useSaveCoordinator` hook |
| [Tradeoffs Summary](../fit-to-one-page/130326_tradeoffs-summary.md) | Lists OCC as medium-risk decision |
