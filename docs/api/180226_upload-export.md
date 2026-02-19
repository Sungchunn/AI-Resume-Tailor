# Upload & Export API

## Overview

The Upload API handles document ingestion, extracting text content from PDF and DOCX files. The Export API generates downloadable resume files in various formats.

---

# Upload API

**Base Path:** `/api/upload`

**Authentication:** Required

## Endpoints

### Extract Document Text

Upload a document and extract its text content.

```
POST /api/upload/extract
```

**Request:**

| Header | Value |
|--------|-------|
| `Content-Type` | `multipart/form-data` |
| `Authorization` | `Bearer <token>` |

**Form Data:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF or DOCX, max 10MB |

**Accepted MIME Types:**

| Format | MIME Type |
|--------|-----------|
| PDF | `application/pdf` |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/upload/extract \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/resume.pdf"
```

**Response (200 OK):**

```json
{
  "raw_content": "John Doe\nSoftware Engineer\n\nExperience:\n\nTechCorp Inc. | Senior Software Engineer | 2022 - Present\n- Led migration of monolithic application to microservices architecture\n- Reduced deployment time by 75%\n- Mentored team of 5 junior developers\n\nSkills:\nPython, JavaScript, AWS, Docker, Kubernetes\n\nEducation:\nBS Computer Science, State University, 2018",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 2,
  "word_count": 342,
  "warnings": []
}
```

**Response with Warnings:**

```json
{
  "raw_content": "John Doe\n[Some text extracted...]\n",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 3,
  "word_count": 156,
  "warnings": [
    "Some images or charts could not be processed",
    "Document contains scanned pages - OCR accuracy may vary"
  ]
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | No file uploaded |
| 413 | File exceeds 10MB limit |
| 415 | Unsupported file type |
| 422 | Document could not be processed |

---

## Data Models

### DocumentExtractionResponse

```typescript
{
  raw_content: string;        // Extracted text content
  source_filename: string;    // Original filename
  file_type: "pdf" | "docx";  // Detected file type
  page_count: number;         // Number of pages
  word_count: number;         // Approximate word count
  warnings: string[];         // Processing warnings
}
```

## Usage Notes

- Maximum file size is configurable via `MAX_UPLOAD_SIZE_MB` (default 10MB)
- PDF extraction handles both text-based and scanned documents (OCR)
- DOCX extraction preserves basic formatting structure
- Extracted content is returned but not automatically saved
- Use the response `raw_content` with the Resumes API to create a resume

### Typical Workflow

```
1. Upload document    →  POST /api/upload/extract
2. Review content     →  Check raw_content and warnings
3. Create resume      →  POST /api/resumes with extracted content
```

**Example Complete Flow:**

```bash
# Step 1: Extract text from PDF
CONTENT=$(curl -s -X POST http://localhost:8000/api/upload/extract \
  -H "Authorization: Bearer <token>" \
  -F "file=@resume.pdf" | jq -r '.raw_content')

# Step 2: Create resume with extracted content
curl -X POST http://localhost:8000/api/resumes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"My Resume\",
    \"raw_content\": \"$CONTENT\"
  }"
```

---

# Export API

**Base Path:** `/api/export`

**Authentication:** Required

## Endpoints

### Export Tailored Resume

Download a tailored resume as a file.

```
GET /api/export/{tailored_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tailored_id` | UUID | Tailored resume identifier |

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `format` | string | "pdf" | pdf, docx, txt |

**Example Requests:**

```bash
# Export as PDF
curl http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000?format=pdf \
  -H "Authorization: Bearer <token>" \
  --output tailored_resume.pdf

# Export as DOCX
curl http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000?format=docx \
  -H "Authorization: Bearer <token>" \
  --output tailored_resume.docx

# Export as plain text
curl http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000?format=txt \
  -H "Authorization: Bearer <token>" \
  --output tailored_resume.txt
```

**Response Headers:**

| Header | Example Value |
|--------|---------------|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="tailored_resume.pdf"` |

**Response:**

Binary file content.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid format specified |
| 403 | Tailored resume belongs to another user |
| 404 | Tailored resume not found |

---

## Export Formats

### PDF

**MIME Type:** `application/pdf`

- Professional formatting
- ATS-compatible when using standard fonts
- Best for final submissions

### DOCX

**MIME Type:** `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

- Editable in Microsoft Word
- Preserves formatting structure
- Good for further customization

### TXT

**MIME Type:** `text/plain`

- Plain text only
- Maximum ATS compatibility
- No formatting preserved

---

## Rate Limiting

Export endpoints have specific rate limits:

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| `/api/export/{id}` | 5 | 30 |

## Usage Notes

- Generate a tailored resume first using `/api/tailor`
- PDF is recommended for job applications
- DOCX is useful for manual editing before submission
- TXT ensures maximum ATS compatibility

## Related Endpoints

- [Resumes](180226_resumes.md) - Manage source resumes
- [Tailor](180226_tailor-match.md) - Generate tailored resumes
- [Workshops](180226_workshops.md) - Alternative workflow with export capability
