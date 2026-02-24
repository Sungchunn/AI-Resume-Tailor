# Upload & Export API

## Overview

The Upload and Export APIs handle document processing for resumes. Upload allows extracting text from PDF and DOCX files, while Export generates resume files in various formats.

---

# Upload API

**Base Path:** `/api/upload`

**Authentication:** All endpoints require authentication.

## Endpoints

### Extract Document

Extract text content from uploaded PDF or DOCX files, convert to HTML for rich text editing, and optionally store the original file.

```http
POST /api/upload/extract
```

**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF or DOCX file |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `store_file` | boolean | true | Whether to store the original file in object storage |

**Constraints:**

- Maximum file size: 10MB (configurable)
- Supported formats: PDF, DOCX

**Example Request:**

```bash
# Upload and store original file (default)
curl -X POST http://localhost:8000/api/upload/extract \
  -H "Authorization: Bearer <token>" \
  -F "file=@resume.pdf"

# Upload without storing original file
curl -X POST "http://localhost:8000/api/upload/extract?store_file=false" \
  -H "Authorization: Bearer <token>" \
  -F "file=@resume.pdf"
```

**Response (200 OK):**

```json
{
  "raw_content": "John Doe\nSenior Software Engineer\n\nExperience:\n- Led development of microservices...\n\nSkills:\n- Python, AWS, Kubernetes...",
  "html_content": "<h1>John Doe</h1><p>Senior Software Engineer</p><h2>Experience</h2><ul><li>Led development of microservices...</li></ul><h2>Skills</h2><ul><li>Python, AWS, Kubernetes...</li></ul>",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 2,
  "word_count": 450,
  "file_key": "users/123/resumes/a1b2c3d4_resume.pdf",
  "file_size_bytes": 245760,
  "warnings": []
}
```

**Response with Warnings:**

```json
{
  "raw_content": "John Doe\nSenior Software Engineer...",
  "html_content": "<h1>John Doe</h1><p>Senior Software Engineer...</p>",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 3,
  "word_count": 520,
  "file_key": "users/123/resumes/e5f6g7h8_resume.pdf",
  "file_size_bytes": 512000,
  "warnings": [
    "Page 2 contained no extractable text"
  ]
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid file type or empty file |
| 400 | File size exceeds maximum limit |
| 422 | File could not be processed |

---

## Data Models

### DocumentExtractionResponse

```typescript
{
  raw_content: string;         // Extracted plain text content
  html_content: string;        // TipTap-compatible HTML for rich editing
  source_filename: string;     // Original filename
  file_type: "pdf" | "docx";   // Document type
  page_count: number | null;   // Number of pages (PDF only)
  word_count: number;          // Approximate word count
  file_key: string | null;     // Object storage key (null if not stored)
  file_size_bytes: number | null;  // Original file size in bytes
  warnings: string[];          // Processing warnings
}
```

---

# Export API

**Base Path:** `/api/export`

**Authentication:** All endpoints require authentication.

## Endpoints

### Export Tailored Resume

Export a tailored resume to a downloadable file.

```http
GET /api/export/{tailored_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tailored_id` | UUID | Tailored resume identifier |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | pdf | Output format: `pdf`, `docx`, `txt` |

**Example Request:**

```bash
# Export as PDF (default)
curl http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  --output resume.pdf

# Export as DOCX
curl "http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000?format=docx" \
  -H "Authorization: Bearer <token>" \
  --output resume.docx

# Export as TXT
curl "http://localhost:8000/api/export/aa0e8400-e29b-41d4-a716-446655440000?format=txt" \
  -H "Authorization: Bearer <token>" \
  --output resume.txt
```

**Response:**

Binary file with appropriate headers:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="tailored_resume.pdf"
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 404 | Tailored resume not found |
| 422 | Export format not supported |

---

## Supported Formats

| Format | MIME Type | Description |
|--------|-----------|-------------|
| `pdf` | `application/pdf` | PDF document (default) |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Microsoft Word document |
| `txt` | `text/plain` | Plain text |

## Rate Limiting

Export endpoints have specific rate limits to prevent abuse:

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| `/api/upload/extract` | 10 | 100 |
| `/api/export/*` | 5 | 30 |

## Usage Notes

### Upload Tips

- For best results, upload text-based PDFs rather than scanned images
- DOCX files preserve formatting better than PDF
- Very large files may take longer to process
- Check the `warnings` array for potential extraction issues

### Export Tips

- PDF format is most widely accepted by ATS systems
- DOCX allows further editing in word processors
- TXT is useful for plain-text job applications
- Exported files use sensible filenames based on content

## Related Endpoints

- [Resumes](resumes.md) - Store extracted content as a resume
- [Blocks](blocks.md) - Import extracted content as blocks
- [Tailor](tailor-match.md) - Create tailored resumes to export
- [Resume Builds](resume-builds.md) - Export from resume builds
