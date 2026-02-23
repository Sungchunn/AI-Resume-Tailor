# Upload & Export API

## Overview

The Upload and Export APIs handle document processing for resumes. Upload allows extracting text from PDF and DOCX files, while Export generates resume files in various formats.

---

# Upload API

**Base Path:** `/api/upload`

**Authentication:** All endpoints require authentication.

## Endpoints

### Extract Document

Extract text content from uploaded PDF or DOCX files.

```http
POST /api/upload/extract
```

**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF or DOCX file |

**Constraints:**

- Maximum file size: 10MB (configurable)
- Supported formats: PDF, DOCX

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/upload/extract \
  -H "Authorization: Bearer <token>" \
  -F "file=@resume.pdf"
```

**Response (200 OK):**

```json
{
  "raw_content": "John Doe\nSenior Software Engineer\n\nExperience:\n- Led development of microservices...\n\nSkills:\n- Python, AWS, Kubernetes...",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 2,
  "word_count": 450,
  "warnings": []
}
```

**Response with Warnings:**

```json
{
  "raw_content": "John Doe\nSenior Software Engineer...",
  "source_filename": "resume.pdf",
  "file_type": "pdf",
  "page_count": 3,
  "word_count": 520,
  "warnings": [
    "Page 2 contains a scanned image that may not be fully readable",
    "Some formatting may have been lost during extraction"
  ]
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 413 | File size exceeds maximum limit |
| 415 | File type not supported |
| 422 | File could not be processed |

---

## Data Models

### DocumentExtractionResponse

```typescript
{
  raw_content: string;         // Extracted text content
  source_filename: string;     // Original filename
  file_type: string;           // "pdf" or "docx"
  page_count: number;          // Number of pages
  word_count: number;          // Approximate word count
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
