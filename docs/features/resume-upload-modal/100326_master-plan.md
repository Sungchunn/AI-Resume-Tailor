# Resume Upload Modal - Master Plan

## Goal

Consolidate the resume upload flow into a single-step modal experience. When a user uploads a file, it should automatically extract content, create the resume, and trigger AI parsing - all with progress feedback in one place.

**Old Flow:**

```text
Add Resume → New Page → Upload → Create → Library → Edit → Parsing
```

**New Flow:**

```text
Add Resume → Modal → Upload + Extract + Create + Parse → Done
```

---

## Reference UI

The modal should match this design:

- Dashed border dropzone with upload icon
- "Choose a file or drag & drop it here"
- "PDF, DOCX formats, up to 10 MB"
- "Browse File" button
- File cards below dropzone showing:
  - Document icon with PDF/DOCX badge
  - Filename
  - Progress: "0 KB of 120 KB - Uploading..." with spinner
  - Progress bar (blue)
  - Cancel button (X) or Delete button (trash)
  - Green checkmark + "Completed" when done

---

## Files to Create

### 1. `ResumeUploadModal.tsx`

**Path:** `/frontend/src/components/upload/ResumeUploadModal.tsx`

Modal component following existing patterns (CreateSectionModal, InsertKeywordModal):

- Fixed overlay with backdrop (`fixed inset-0 z-50 bg-black/50`)
- Escape key and backdrop click to close (when no active uploads)
- Header: "Upload Resumes" with close button
- DropZone for file selection (accepts PDF/DOCX)
- List of file cards showing progress
- `beforeunload` warning when uploads are active

### 2. `ResumeUploadFileCard.tsx`

**Path:** `/frontend/src/components/upload/ResumeUploadFileCard.tsx`

Enhanced file card combining upload and parse progress:

- File icon (PDF red, DOCX blue) - reuse pattern from UploadProgressCard
- Filename with truncation
- Combined progress bar showing all phases
- Status text: "Uploading...", "Extracting...", "Creating...", "AI Parsing...", "Completed"
- Cancel button (X) during processing
- Delete button (trash) after completion
- Checkmark icon when complete

### 3. `useResumeUploadFlow.ts`

**Path:** `/frontend/src/hooks/useResumeUploadFlow.ts`

Hook to orchestrate the full flow for a single file:

1. Upload with progress → `/api/upload/extract`
2. Create resume → `useCreateResume` mutation
3. Trigger parse → `resumeApi.parse(id)`
4. Poll status → `resumeApi.getParseStatus(id, taskId)` every 3s
5. Complete when parse finishes

**Reuses existing utilities:**

- `uploadWithProgress` from `/frontend/src/lib/api/uploadWithProgress.ts`
- `generateTitleFromFilename` from `/frontend/src/lib/utils/filename.ts`
- API client methods from `/frontend/src/lib/api/client.ts`

---

## Files to Modify

### 4. `library/page.tsx`

**Path:** `/frontend/src/app/(protected)/library/page.tsx`

In `ResumesTab` component (line 157):

- Replace `<Link href="/library/resumes/new">` with `<button onClick={openModal}>`
- Add modal state: `const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)`
- Render `<ResumeUploadModal open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen} />`

### 5. `upload/index.ts`

**Path:** `/frontend/src/components/upload/index.ts`

Add exports:

```typescript
export { ResumeUploadModal } from "./ResumeUploadModal";
export { ResumeUploadFileCard } from "./ResumeUploadFileCard";
```

---

## State Management

Use local React state within the modal (no global store needed):

```typescript
interface FileUploadItem {
  id: string;                    // nanoid
  file: File;
  phase: "uploading" | "extracting" | "creating" | "parsing" | "complete" | "error";
  uploadProgress: number;        // 0-100
  parseProgress: number;         // 0-100
  resumeId?: string;
  taskId?: string;
  error?: { message: string; recoverable: boolean };
}

const [files, setFiles] = useState<FileUploadItem[]>([]);
```

---

## Progress Bar Mapping

Combined progress calculation for the unified progress bar:

| Phase | Range | Display |
| ----- | ----- | ----- |
| uploading | 0-30% | "X KB of Y KB - Uploading..." |
| extracting | 30-45% | "Extracting text..." |
| creating | 45-55% | "Creating resume..." |
| parsing | 55-100% | "AI Processing..." |
| complete | 100% | "Completed" with checkmark |

---

## Implementation Order

1. Create `ResumeUploadFileCard.tsx` - the file card component
2. Create `useResumeUploadFlow.ts` - the orchestration hook
3. Create `ResumeUploadModal.tsx` - the modal with dropzone and file list
4. Update `upload/index.ts` - add exports
5. Modify `library/page.tsx` - integrate modal

---

## Verification

1. Run `bun dev` from `/frontend`
2. Navigate to `http://localhost:3000/library`
3. Click "Add Resume" - modal should open
4. Drop a PDF file
5. Verify progress: Upload → Extract → Create → Parse → Complete
6. Check the resume appears in library after closing modal
7. Verify the resume has parsed content (check edit page)

---

## Notes

- Keep `/library/resumes/new` page intact for now (can deprecate later)
- Single file upload first (multi-file can be added later)
- Polling interval: 3 seconds for parse status (matches existing)
- Max file size: 10MB (matches existing)
- Accepted types: PDF, DOCX (matches existing)
