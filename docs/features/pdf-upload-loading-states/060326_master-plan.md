# PDF Upload Loading States - Master Plan

**Created:** 2026-03-06
**Status:** Planning

## Problem Summary

When a user uploads a PDF, they see only "Extracting text..." spinner for 10-30 seconds with:

- No upload progress indication (bytes transferred)
- No visibility into parsing stages
- No error recovery options
- No indication that background work is happening

## Design Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Upload progress | XMLHttpRequest wrapper | Fetch API doesn't support upload progress |
| Stage tracking | Backend stages in Redis | Real stages, not frontend simulation |
| Status updates | Polling (3s interval) | Already exists, SSE overkill for short operations |
| Partial failures | Save with warning | Allow retry of AI parsing later |

## Phase Overview

| Phase | Description | Scope |
| ----- | ----------- | ----- |
| [Phase 1](060326_phase-1-upload-progress.md) | Upload progress bar | Frontend only |
| [Phase 2](060326_phase-2-backend-stages.md) | Backend parse stages | Backend + Redis |
| [Phase 3](060326_phase-3-parse-stepper-ui.md) | Parse stepper component | Frontend only |
| [Phase 4](060326_phase-4-page-integration.md) | Page integration | Frontend only |
| [Phase 5](060326_phase-5-error-handling.md) | Error handling | Full stack |

## Files Summary

**New files (4):**

- `/frontend/src/lib/api/uploadWithProgress.ts`
- `/frontend/src/components/upload/UploadProgressCard.tsx`
- `/frontend/src/components/upload/ParseProgressStepper.tsx`
- `/frontend/src/hooks/useParseProgress.ts`

**Modified files (6):**

- `/frontend/src/components/upload/FileUploadZone.tsx`
- `/frontend/src/app/(protected)/library/resumes/new/page.tsx`
- `/frontend/src/lib/api/types.ts`
- `/backend/app/schemas/resume.py`
- `/backend/app/services/resume/parse_task.py`
- `/backend/app/api/routes/resumes.py`

## UX Flow

```text
[Drop File] -> [Upload Progress Card] -> [Parse Stepper] -> [Editor Mode]
     |               |                        |
     v               v                        v
  Dropzone      Bytes: 2.1/5.0 MB        Extracting...
  UI            [=====>    ] 42%          AI Parsing...
                [Cancel]                  Finalizing...
```

## Verification

1. **Upload progress:** Drop a 5MB PDF, verify progress bar shows bytes transferred
2. **Parse stages:** Verify stepper shows Extracting -> Parsing -> Storing transitions
3. **Error recovery:** Simulate network failure, verify retry button works
4. **Navigation warning:** Try to close tab during upload, verify browser warning appears
5. **Completion flow:** Verify auto-transition to editor mode when parsing completes
