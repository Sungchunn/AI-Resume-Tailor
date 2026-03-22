# Phase 2: Backend Parse Stages

**Parent:** [Master Plan](060326_master-plan.md)
**Scope:** Backend + Redis

## Problem

The current `ParseStatusResponse` only has:

- `task_id`
- `status`: "pending" | "completed" | "failed"
- `resume_id`
- `error`

There is no visibility into which stage the parsing is in.

## Solution

Add `stage` and `stage_progress` fields to Redis task data and expose them in the API.

## Implementation

### 2.1 Add stage enum and update schemas

**Modify:** `/backend/app/schemas/resume.py`

```python
from enum import Enum

class ParseStage(str, Enum):
    """Stages of resume parsing."""
    EXTRACTING = "extracting"
    PARSING = "parsing"
    STORING = "storing"


class ParseStatusResponse(BaseModel):
    """Response when checking parse task status."""

    task_id: str
    status: Literal["pending", "completed", "failed"]
    resume_id: str
    stage: ParseStage | None = None  # NEW
    stage_progress: int | None = None  # NEW: 0-100 within stage
    error: str | None = None
```

### 2.2 Extend ParseTaskService for stages

**Modify:** `/backend/app/services/resume/parse_task.py`

Add `stage` and `stage_progress` to Redis data structure:

```python
async def create_task(self, resume_id: int) -> str:
    task_data = {
        "task_id": task_id,
        "status": "pending",
        "resume_id": resume_id,
        "stage": None,  # NEW
        "stage_progress": None,  # NEW
        "error": None,
    }
    # ...

async def update_stage(self, task_id: str, stage: str, progress: int = 0) -> None:
    """
    Update task stage and progress within that stage.

    Args:
        task_id: The task ID to update
        stage: One of "extracting", "parsing", "storing"
        progress: 0-100 progress within the stage
    """
    key = self._make_key(task_id)
    existing = await self.redis.get(key)

    if existing:
        task_data = json.loads(existing)
        task_data["stage"] = stage
        task_data["stage_progress"] = progress
        await self.redis.setex(key, TASK_TTL, json.dumps(task_data))
        logger.debug(f"Task {task_id} stage: {stage} ({progress}%)")

async def get_task_status(self, task_id: str) -> ParseStatusResponse | None:
    # Update to include stage fields
    return ParseStatusResponse(
        task_id=task_data["task_id"],
        status=task_data["status"],
        resume_id=task_data["resume_id"],
        stage=task_data.get("stage"),  # NEW
        stage_progress=task_data.get("stage_progress"),  # NEW
        error=task_data.get("error"),
    )
```

### 2.3 Emit stage updates in parse task

**Modify:** `/backend/app/api/routes/resumes.py`

Update `run_parse_task` background function:

```python
async def run_parse_task(
    task_id: str,
    resume_id: str,
    raw_content: str,
    force: bool,
) -> None:
    """Background task - the actual parsing work."""
    task_service = get_parse_task_service()

    try:
        # Stage 1: Extracting (validation stage)
        await task_service.update_stage(task_id, "extracting", 0)
        # Validation happens here if needed
        await task_service.update_stage(task_id, "extracting", 100)

        # Stage 2: AI Parsing
        await task_service.update_stage(task_id, "parsing", 0)
        parser = ResumeParser(ai_client=ai_client, cache=cache_service)
        parsed_content = await parser.parse(raw_content)
        await task_service.update_stage(task_id, "parsing", 100)

        # Stage 3: Storing
        await task_service.update_stage(task_id, "storing", 0)
        update_data = ResumeUpdate(parsed_content=parsed_content)
        await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)
        await task_service.update_stage(task_id, "storing", 100)

        # Complete
        await task_service.complete_task(task_id, resume_id)

    except Exception as e:
        logger.error(f"Parse task {task_id} failed: {e}")
        await task_service.fail_task(task_id, str(e))
```

## Redis Data Structure

Before:

```json
{
  "task_id": "uuid",
  "status": "pending",
  "resume_id": "mongo_id",
  "error": null
}
```

After:

```json
{
  "task_id": "uuid",
  "status": "pending",
  "resume_id": "mongo_id",
  "stage": "parsing",
  "stage_progress": 50,
  "error": null
}
```

## Files Changed

| File | Action |
| ---- | ------ |
| `/backend/app/schemas/resume.py` | Modify - add ParseStage enum, update ParseStatusResponse |
| `/backend/app/services/resume/parse_task.py` | Modify - add update_stage method |
| `/backend/app/api/routes/resumes.py` | Modify - emit stage updates in run_parse_task |

## Testing

1. Trigger a parse task and poll `/resumes/{id}/parse/status?task_id={task_id}`
2. Verify `stage` field changes: extracting -> parsing -> storing
3. Verify `stage_progress` updates within each stage
4. Test failure case - verify `stage` shows where it failed
