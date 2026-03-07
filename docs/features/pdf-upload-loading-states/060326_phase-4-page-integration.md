# Phase 4: Page Integration

**Parent:** [Master Plan](060326_master-plan.md)
**Scope:** Frontend only

## Problem

The upload page needs to orchestrate the flow between upload progress, parse stepper, and editor mode.

## Solution

Implement a state machine to manage the upload lifecycle phases.

## Implementation

### 4.1 Define upload state machine

**Modify:** `/frontend/src/app/(protected)/library/resumes/new/page.tsx`

```typescript
type UploadPhase =
  | { phase: "idle" }
  | {
      phase: "uploading";
      file: File;
      progress: { loaded: number; total: number; percent: number };
      abort: () => void;
    }
  | {
      phase: "parsing";
      taskId: string;
      resumeId: string;
    }
  | {
      phase: "complete";
      result: DocumentExtractionResponse;
    }
  | {
      phase: "error";
      error: string;
      file?: File;
      canRetry: boolean;
    };

const [uploadPhase, setUploadPhase] = useState<UploadPhase>({ phase: "idle" });
```

### 4.2 Update page rendering

```typescript
function NewResumePage() {
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>({ phase: "idle" });

  // Handle file drop
  const handleFileDrop = async (file: File) => {
    const { promise, abort } = uploadWithProgress<DocumentExtractionResponse>({
      file,
      url: `${API_BASE_URL}/api/upload/extract`,
      headers: { Authorization: `Bearer ${getToken()}` },
      onProgress: (progress) => {
        setUploadPhase(prev =>
          prev.phase === "uploading" ? { ...prev, progress } : prev
        );
      },
    });

    setUploadPhase({ phase: "uploading", file, progress: { loaded: 0, total: file.size, percent: 0 }, abort });

    try {
      const result = await promise;
      // If result includes taskId, we need to wait for parsing
      if (result.task_id) {
        setUploadPhase({ phase: "parsing", taskId: result.task_id, resumeId: result.resume_id });
      } else {
        // Synchronous extraction (no background parsing)
        setUploadPhase({ phase: "complete", result });
      }
    } catch (err) {
      setUploadPhase({
        phase: "error",
        error: err instanceof Error ? err.message : "Upload failed",
        file,
        canRetry: true,
      });
    }
  };

  // Render based on phase
  return (
    <div className="container max-w-2xl py-8">
      {uploadPhase.phase === "idle" && (
        <FileUploadZone onFileDrop={handleFileDrop} />
      )}

      {uploadPhase.phase === "uploading" && (
        <UploadProgressCard
          filename={uploadPhase.file.name}
          progress={uploadPhase.progress}
          onCancel={() => {
            uploadPhase.abort();
            setUploadPhase({ phase: "idle" });
          }}
        />
      )}

      {uploadPhase.phase === "parsing" && (
        <ParseProgressStepper
          resumeId={uploadPhase.resumeId}
          taskId={uploadPhase.taskId}
          onComplete={() => {
            // Fetch final result and switch to editor
          }}
          onError={(error) => {
            setUploadPhase({ phase: "error", error, canRetry: true });
          }}
        />
      )}

      {uploadPhase.phase === "complete" && (
        <ResumeEditor initialContent={uploadPhase.result} />
      )}

      {uploadPhase.phase === "error" && (
        <ErrorCard
          message={uploadPhase.error}
          onRetry={uploadPhase.canRetry ? () => {
            if (uploadPhase.file) {
              handleFileDrop(uploadPhase.file);
            } else {
              setUploadPhase({ phase: "idle" });
            }
          } : undefined}
        />
      )}
    </div>
  );
}
```

### 4.3 Navigation protection

Add warning when user tries to navigate away during upload/parsing:

```typescript
useEffect(() => {
  const isProcessing = uploadPhase.phase === "uploading" || uploadPhase.phase === "parsing";

  if (!isProcessing) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "Upload in progress. Are you sure you want to leave?";
    return e.returnValue;
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [uploadPhase.phase]);
```

### 4.4 Session recovery (optional enhancement)

Store task ID in sessionStorage for recovery if user navigates away and returns:

```typescript
// On entering parsing phase
sessionStorage.setItem("pending_parse", JSON.stringify({ taskId, resumeId }));

// On page load
useEffect(() => {
  const pending = sessionStorage.getItem("pending_parse");
  if (pending) {
    const { taskId, resumeId } = JSON.parse(pending);
    // Check if task is still pending/running and resume
  }
}, []);

// On completion/error
sessionStorage.removeItem("pending_parse");
```

## UI Layout

```text
+--------------------------------------------------+
|  New Resume                                      |
+--------------------------------------------------+
|                                                  |
|  Phase: idle                                     |
|  +--------------------------------------------+  |
|  |  [Drop Zone]                               |  |
|  |  Drag & drop your resume file              |  |
|  |  or click to browse (PDF, DOCX up to 10MB) |  |
|  +--------------------------------------------+  |
|                                                  |
|  Phase: uploading                                |
|  +--------------------------------------------+  |
|  |  [PDF] resume.pdf                      [X] |  |
|  |  [=============>          ] 65%            |  |
|  |  3.2 MB / 5.0 MB                           |  |
|  +--------------------------------------------+  |
|                                                  |
|  Phase: parsing                                  |
|  +--------------------------------------------+  |
|  |  Processing Resume                         |  |
|  |                                            |  |
|  |  [v] Extracting              0.8s          |  |
|  |  [o] AI Parsing              ...           |  |
|  |  [ ] Finalizing                            |  |
|  |                                            |  |
|  |  [========>                ] 45%           |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
```

## Files Changed

| File | Action |
| ---- | ------ |
| `/frontend/src/app/(protected)/library/resumes/new/page.tsx` | Modify - state machine, phase rendering |

## Testing

1. Complete full flow: idle -> uploading -> parsing -> complete -> editor
2. Cancel during upload, verify returns to idle
3. Navigate away during upload, verify browser warning
4. Simulate parsing failure, verify error state with retry
5. Refresh during parsing, verify session recovery (if implemented)
