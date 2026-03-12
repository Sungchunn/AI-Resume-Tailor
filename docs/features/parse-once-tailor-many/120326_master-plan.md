# Parse-Once, Tailor-Many Architecture Refactoring

## Overview

This feature refactors the Resume Tailor application to enforce a clear separation between:

- **Phase 1 (Library)**: One-time resume parsing and verification (Master Resume)
- **Phase 2 (Tailor)**: Job-specific tailoring using the verified Master Resume

## Problem Statement

Currently, the verification step (`/tailor/verify/[id]`) is misplaced in the tailoring flow, causing:

1. Redundant LLM calls for parsing during tailoring
2. Bloated UX forcing users to verify parsed sections mid-tailoring
3. Violation of "Parse-Once, Tailor-Many" architectural constraint

### Current Flow (Problematic)

```text
Job Selection → ATS Analysis → Verify Parsed Sections → Editor
                                      ↑
                              (misplaced bottleneck)
```

### Target Flow

```text
LIBRARY (Parse-Once):
Upload → Parser LLM → Verify Sections → Master Resume (verified)

TAILOR (Tailor-Many):
Select Verified Resume → ATS Analysis → Tailor LLM → Diff Editor → Export
```

---

## User Decisions

Based on clarifying questions, the following decisions were made:

| Decision | Choice |
| -------- | ------ |
| Diff Viewer Location | Merge into `/tailor/editor/[id]` |
| Unverified Resume Handling | Block API + redirect to verification |
| Component Reuse | Reuse `ContentEditor` for library verification |
| Tailor Flow Steps | 3 steps: Select → Analyze → Editor |

---

## Implementation Phases

### Phase 1: Backend Changes

**Document:** [120326_phase1-backend-changes.md](./120326_phase1-backend-changes.md)

- Add `parsed_verified` and `parsed_verified_at` fields to Resume model
- Create `PATCH /resumes/{id}/verify-parsed` endpoint
- Add verification check to `POST /tailor` endpoint
- Update response schemas

### Phase 2: Frontend - Library Verification

**Document:** [120326_phase2-frontend-library.md](./120326_phase2-frontend-library.md)

- Create new `/library/resumes/[id]/verify` page
- Add API hooks and client methods for verification
- Update library resume detail page with verification badge
- Update types

### Phase 3: Frontend - Tailor Flow Changes

**Document:** [120326_phase3-frontend-tailor-flow.md](./120326_phase3-frontend-tailor-flow.md)

- Update `TailorFlowStepper` to 3 steps
- Convert `/tailor/verify/[id]` to redirect
- Update `/tailor/editor/[id]` with diff viewer
- Convert `/tailor/review/[id]` to redirect
- Handle verification errors in analyze page

---

## Critical Files Summary

### Backend Files

| File | Action |
| ---- | ------ |
| `/backend/app/models/mongo/resume.py` | Add verification fields |
| `/backend/app/schemas/resume.py` | Add fields to response schema |
| `/backend/app/api/routes/resumes.py` | Add verify endpoint |
| `/backend/app/api/routes/tailor.py` | Add verification check |

### Frontend Files

| File | Action |
| ---- | ------ |
| `/frontend/src/app/(protected)/library/resumes/[id]/verify/page.tsx` | **CREATE** |
| `/frontend/src/app/(protected)/library/resumes/[id]/page.tsx` | Add badge |
| `/frontend/src/components/tailoring/TailorFlowStepper.tsx` | Update steps |
| `/frontend/src/app/(protected)/tailor/verify/[id]/page.tsx` | Convert to redirect |
| `/frontend/src/app/(protected)/tailor/editor/[id]/page.tsx` | Add diff viewer |
| `/frontend/src/app/(protected)/tailor/review/[id]/page.tsx` | Convert to redirect |
| `/frontend/src/lib/api/hooks.ts` | Add verify hook |
| `/frontend/src/lib/api/client.ts` | Add verify method |
| `/frontend/src/lib/api/types.ts` | Add verification fields |

---

## Verification Plan

### Backend Testing

```bash
# Test verify endpoint
curl -X PATCH /api/resumes/{id}/verify-parsed -H "Authorization: Bearer $TOKEN"

# Test tailor rejects unverified
curl -X POST /api/tailor -d '{"resume_id": "...", "job_listing_id": 123}'
# Expected: 400 with X-Redirect header
```

### Frontend Testing

1. **Library verification flow:**
   - Upload resume → Parse → Navigate to `/library/resumes/[id]`
   - See "Needs Verification" badge
   - Click badge → Go to `/library/resumes/[id]/verify`
   - Edit sections → Save & Verify
   - Redirect to detail page → See green "Verified" badge

2. **Tailor flow with unverified resume:**
   - Go to `/tailor` → Select unverified resume → Select job → Analyze
   - On "Generate" click → Should redirect to `/library/resumes/[id]/verify`

3. **Tailor flow with verified resume:**
   - Full flow works: Select → Analyze → Editor (with diff panel)

4. **Redirect testing:**
   - Navigate to `/tailor/verify/[id]` → Should redirect to `/tailor/editor/[id]`
   - Navigate to `/tailor/review/[id]` → Should redirect to `/tailor/editor/[id]`

### Integration Testing

Full user journey:

```text
Upload → Parse → Verify → Select Job → Analyze → Tailor → Review Diffs → Export
```
