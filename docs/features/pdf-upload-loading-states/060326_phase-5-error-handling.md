# Phase 5: Error Handling

**Parent:** [Master Plan](060326_master-plan.md)
**Scope:** Full stack

## Problem

Users have no visibility into what went wrong when upload or parsing fails, and no recovery options.

## Solution

Categorize errors and provide appropriate recovery actions for each type.

## Error Categories

| Error Type | Stage | Recovery Action | UI Message |
| ---------- | ----- | --------------- | ---------- |
| Network error | Upload | Retry with same file | "Upload failed. Check your connection and try again." |
| File too large | Upload | Select smaller file | "File exceeds 10MB limit. Please select a smaller file." |
| Invalid file type | Upload | Select valid file | "Only PDF and DOCX files are supported." |
| Server error (5xx) | Upload | Retry | "Server error. Please try again in a moment." |
| Text extraction failed | Parse | Manual paste option | "Couldn't extract text from this file. You can paste your resume content manually." |
| AI parsing failed | Parse | Save without parsing | "Parsing failed. Your resume was saved but structure analysis is unavailable. You can retry later." |
| Storage failed | Parse | Retry | "Failed to save. Please try again." |

## Implementation

### 5.1 Backend error classification

**Modify:** `/backend/app/api/routes/upload.py`

Return structured error responses:

```python
class UploadErrorCode(str, Enum):
    FILE_TOO_LARGE = "file_too_large"
    INVALID_FILE_TYPE = "invalid_file_type"
    EXTRACTION_FAILED = "extraction_failed"
    STORAGE_FAILED = "storage_failed"

class UploadErrorResponse(BaseModel):
    error_code: UploadErrorCode
    message: str
    recoverable: bool

@router.post("/extract")
async def extract_document(...):
    try:
        # ...
    except ExtractionError as e:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "extraction_failed",
                "message": str(e),
                "recoverable": False,  # Suggest manual paste
            }
        )
```

### 5.2 Backend partial success handling

**Modify:** `/backend/app/api/routes/resumes.py`

For AI parsing failures, save the resume without parsed content:

```python
async def run_parse_task(...):
    try:
        # ... parsing logic
    except AIParsingError as e:
        logger.warning(f"AI parsing failed for {resume_id}: {e}")

        # Save partial result with warning
        update_data = ResumeUpdate(
            parsed_content=None,
            parse_warning=str(e),
        )
        await resume_crud.update(mongo_db, id=resume_id, obj_in=update_data)

        # Mark task as completed with warning (not failed)
        await task_service.complete_task(
            task_id,
            resume_id,
            warning="AI parsing failed. Resume saved without structure."
        )
```

### 5.3 Frontend error display

**Modify:** `/frontend/src/components/upload/UploadProgressCard.tsx`

Add error state rendering:

```typescript
interface UploadProgressCardProps {
  // ...
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  } | null;
  onRetry?: () => void;
  onManualEntry?: () => void;
}

// In render:
{error && (
  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">{error.message}</p>
        <div className="mt-3 flex gap-2">
          {error.recoverable && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
          {error.code === "extraction_failed" && onManualEntry && (
            <Button size="sm" variant="ghost" onClick={onManualEntry}>
              Enter manually
            </Button>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

### 5.4 ParseProgressStepper error state

**Modify:** `/frontend/src/components/upload/ParseProgressStepper.tsx`

```typescript
// Show error at the failed stage
{stage.state === "failed" && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-2 rounded bg-destructive/10 p-3"
  >
    <p className="text-sm text-destructive">{error}</p>
    <Button
      size="sm"
      variant="outline"
      className="mt-2"
      onClick={onRetry}
    >
      Retry parsing
    </Button>
  </motion.div>
)}
```

### 5.5 Partial success notification

When parsing fails but resume is saved, show a toast:

```typescript
// In page component
const handleParseComplete = (result: ParseResult) => {
  if (result.warning) {
    toast({
      title: "Resume saved",
      description: result.warning,
      action: <Button size="sm" onClick={() => retryParsing(result.resumeId)}>Retry</Button>,
    });
  }
  // Continue to editor
};
```

## Error Recovery Flows

### Network Error (Upload)

```text
[Upload Failed]
    |
    v
"Upload failed. Check your connection and try again."
[Try again] [Cancel]
    |
    +--[Try again]--> Retry upload with same file
    +--[Cancel]----> Return to dropzone
```

### Extraction Failed

```text
[Extraction Failed]
    |
    v
"Couldn't extract text from this file."
[Enter manually]
    |
    v
Switch to blank editor with manual paste option
```

### AI Parsing Failed

```text
[Parsing Failed]
    |
    v
Resume saved without structure
[Continue to editor] (toast shows "Retry parsing" action)
    |
    v
Editor opens, user can retry parsing from menu
```

## Files Changed

| File | Action |
| ---- | ------ |
| `/backend/app/api/routes/upload.py` | Modify - structured error responses |
| `/backend/app/api/routes/resumes.py` | Modify - partial success handling |
| `/frontend/src/components/upload/UploadProgressCard.tsx` | Modify - error state UI |
| `/frontend/src/components/upload/ParseProgressStepper.tsx` | Modify - error state UI |
| `/frontend/src/app/(protected)/library/resumes/new/page.tsx` | Modify - error handling logic |

## Testing

1. Simulate network failure (DevTools offline), verify retry works
2. Upload corrupted PDF, verify extraction error with manual entry option
3. Mock AI failure, verify resume saves with warning toast
4. Test all error recovery paths work as expected
5. Verify error messages are clear and actionable
