# Phase 1: Upload Progress (Frontend)

**Parent:** [Master Plan](060326_master-plan.md)
**Scope:** Frontend only

## Problem

The current `FileUploadZone` uses `fetch` API via `useExtractDocument` hook. The Fetch API does not support upload progress events for request bodies.

## Solution

Create an XMLHttpRequest wrapper that provides upload progress events and integrate it into the upload flow.

## Implementation

### 1.1 Create XHR upload utility

**New file:** `/frontend/src/lib/api/uploadWithProgress.ts`

```typescript
interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

interface UploadOptions<T> {
  file: File;
  url: string;
  headers?: Record<string, string>;
  onProgress?: (event: UploadProgressEvent) => void;
}

interface UploadResult<T> {
  promise: Promise<T>;
  abort: () => void;
}

export function uploadWithProgress<T>(options: UploadOptions<T>): UploadResult<T> {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    const formData = new FormData();
    formData.append("file", options.file);

    xhr.open("POST", options.url);
    Object.entries(options.headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}
```

### 1.2 Create UploadProgressCard component

**New file:** `/frontend/src/components/upload/UploadProgressCard.tsx`

```typescript
interface UploadProgressCardProps {
  filename: string;
  progress: { loaded: number; total: number; percent: number };
  onCancel?: () => void;
  error?: string | null;
  onRetry?: () => void;
}
```

Features:

- File icon based on type (PDF/DOCX)
- Filename display (truncated if long)
- Determinate progress bar showing bytes transferred
- "2.1 MB / 5.0 MB" text below bar
- Cancel button (X icon)
- Error state with retry button
- Uses `motion` for smooth progress animation

### 1.3 Update FileUploadZone

**Modify:** `/frontend/src/components/upload/FileUploadZone.tsx`

Changes:

1. Add state for tracking upload:

```typescript
const [uploadState, setUploadState] = useState<{
  file: File;
  progress: { loaded: number; total: number; percent: number };
  abort: () => void;
} | null>(null);
```

1. Replace `useExtractDocument` call with `uploadWithProgress`:

```typescript
const { promise, abort } = uploadWithProgress<DocumentExtractionResponse>({
  file,
  url: `${API_BASE_URL}/api/upload/extract`,
  headers: { Authorization: `Bearer ${tokenManager.getAccessToken()}` },
  onProgress: (progress) => setUploadState((s) => s ? { ...s, progress } : null),
});
```

1. Render `UploadProgressCard` when `uploadState` is set instead of the spinner

## Files Changed

| File | Action |
| ---- | ------ |
| `/frontend/src/lib/api/uploadWithProgress.ts` | Create |
| `/frontend/src/components/upload/UploadProgressCard.tsx` | Create |
| `/frontend/src/components/upload/FileUploadZone.tsx` | Modify |

## Testing

1. Upload a 5MB PDF and verify progress bar fills smoothly
2. Click cancel during upload and verify request is aborted
3. Simulate slow network (DevTools throttling) to see progress clearly
4. Verify error state shows when upload fails
