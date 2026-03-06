# Phase 3: Parse Stepper UI

**Parent:** [Master Plan](060326_master-plan.md)
**Scope:** Frontend only

## Problem

After upload completes, AI parsing takes 10-30 seconds with no visibility into progress.

## Solution

Create a vertical stepper component (modeled after `ATSProgressStepper`) that shows parsing stages.

## Implementation

### 3.1 Update frontend types

**Modify:** `/frontend/src/lib/api/types.ts`

```typescript
export type ParseStage = "extracting" | "parsing" | "storing";

export interface ParseStatusResponse {
  task_id: string;
  status: "pending" | "completed" | "failed";
  resume_id: string;
  stage?: ParseStage | null;
  stage_progress?: number | null;
  error?: string | null;
}
```

### 3.2 Create ParseProgressStepper component

**New file:** `/frontend/src/components/upload/ParseProgressStepper.tsx`

```typescript
interface ParseProgressStepperProps {
  resumeId: string;
  taskId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}
```

Stage configuration:

```typescript
const PARSE_STAGES = [
  { id: "extracting", label: "Extracting", icon: FileSearch },
  { id: "parsing", label: "AI Parsing", icon: Brain },
  { id: "storing", label: "Finalizing", icon: Database },
] as const;

type StageState = "pending" | "running" | "completed" | "failed";
```

Features (mirroring ATSProgressStepper):

- 3-stage vertical stepper
- Stage states with appropriate icons:
  - Pending: gray circle with number
  - Running: blue spinner with pulse animation
  - Completed: green checkmark
  - Failed: red X
- Elapsed time per completed stage
- Overall progress bar (0-100%)
- Error message display with retry button
- Uses `motion` for animations

### 3.3 Create useParseProgress hook

**New file:** `/frontend/src/hooks/useParseProgress.ts`

Wraps existing `useParseStatus` with UI-friendly state:

```typescript
interface UseParseProgressOptions {
  resumeId: string;
  taskId: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface ParseStageState {
  id: ParseStage;
  state: "pending" | "running" | "completed" | "failed";
  progress: number;
  elapsedMs?: number;
}

interface UseParseProgressResult {
  stages: ParseStageState[];
  isComplete: boolean;
  hasError: boolean;
  error: string | null;
  overallProgress: number;
  retry: () => void;
}

export function useParseProgress(options: UseParseProgressOptions): UseParseProgressResult {
  const { data: status, refetch } = useParseStatus(options.resumeId, options.taskId);

  // Map backend stage to UI stage states
  const stages = useMemo(() => {
    const currentStage = status?.stage;
    const stageProgress = status?.stage_progress ?? 0;

    return PARSE_STAGES.map((stage, index) => {
      const currentIndex = currentStage
        ? PARSE_STAGES.findIndex(s => s.id === currentStage)
        : -1;

      let state: StageState;
      if (status?.status === "failed" && index === currentIndex) {
        state = "failed";
      } else if (index < currentIndex) {
        state = "completed";
      } else if (index === currentIndex) {
        state = "running";
      } else {
        state = "pending";
      }

      return {
        id: stage.id,
        state,
        progress: index === currentIndex ? stageProgress : (index < currentIndex ? 100 : 0),
      };
    });
  }, [status]);

  // ...
}
```

## Component Structure

```text
ParseProgressStepper
├── Header: "Processing Resume"
├── Stage List (vertical)
│   ├── Stage 1: Extracting [icon] [status]
│   ├── Stage 2: AI Parsing [icon] [status]
│   └── Stage 3: Finalizing [icon] [status]
├── Overall Progress Bar
└── Error Display (conditional)
    └── [Retry Button]
```

## Files Changed

| File | Action |
| ---- | ------ |
| `/frontend/src/lib/api/types.ts` | Modify - add ParseStage type, update ParseStatusResponse |
| `/frontend/src/components/upload/ParseProgressStepper.tsx` | Create |
| `/frontend/src/hooks/useParseProgress.ts` | Create |

## Testing

1. Trigger parsing and verify stepper shows correct stage
2. Verify stage transitions animate smoothly
3. Verify elapsed time displays for completed stages
4. Simulate failure and verify error state with retry button
5. Click retry and verify parsing restarts
