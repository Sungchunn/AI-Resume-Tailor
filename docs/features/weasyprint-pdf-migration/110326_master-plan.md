# Plan: Migrate PDF Generation from ReportLab to WeasyPrint

## Objective

Eliminate ReportLab PDF generation path and route all resume PDF exports through WeasyPrint with a unified Jinja2 template system.

---

## Current State

### ReportLab Code (TO BE REMOVED)

- **File:** `backend/app/services/export/service.py:138-243`
- `generate_pdf()` accepts `tailored_content` dict:

  ```python
  {"summary": "...", "experience": [...], "skills": [...], "highlights": [...]}
  ```

- Called by:
  - `/api/export/{tailored_id}` (export.py:77)
  - `/api/resume_builds/{id}/export` (resume_builds.py:675)

### WeasyPrint (EXISTING - TO EXTEND)

- **File:** `backend/app/services/export/html_to_document.py`
- Has CSS templates: CLASSIC, MODERN, MINIMAL (lines 64-270)
- Has `render_page_count()` for fit-to-page
- Used by `/api/resumes/{id}/export`

---

## Implementation Plan

### Phase 1: Infrastructure Setup

1. **Create directory structure:**

   ```text
   backend/app/services/export/
   ├── templates/
   │   ├── resume.html.j2
   │   └── _macros.html.j2
   ├── styles/
   │   ├── _base.css
   │   ├── _fonts.css
   │   ├── classic.css
   │   ├── modern.css
   │   └── minimal.css
   └── fonts/
       ├── inter/
       ├── roboto/
       ├── open-sans/
       └── lato/
   ```

2. **Download woff2 fonts** from Google Fonts:
   - **Preview fonts:** Inter, Roboto, Open Sans, Lato (exact match with frontend)
   - **Export dialog fonts:** Configure system font fallbacks for Arial, Times New Roman, Calibri, Georgia, Helvetica

3. **Add Jinja2 dependency** to `pyproject.toml`

### Phase 2: Jinja2 Template System

1. **Create `_fonts.css`** with @font-face declarations using `file://` URLs

2. **Create `_base.css`** with:
   - `@page { size: 210mm 297mm; }` (A4) with margin variables
   - Explicit px values for all sizing (no em/rem)
   - `.section { break-inside: avoid; }`
   - `.entry { break-inside: avoid; }`

3. **Create style templates** (classic.css, modern.css, minimal.css):
   - Port existing CSS from `TEMPLATE_CSS` dict in html_to_document.py
   - Convert to separate files for maintainability

4. **Create `_macros.html.j2`** with section renderers:
   - `render_experience(entries)`
   - `render_education(entries)`
   - `render_skills(entries)`
   - `render_highlights(entries)`
   - `render_generic(entries)` for extensibility

5. **Create `resume.html.j2`** main template:
   - Include fonts CSS via Jinja
   - Include base CSS + selected style template
   - Render contact header, summary, dynamic sections

### Phase 3: Data Normalization Layer

1. **Create `backend/app/services/export/template_renderer.py`:**

   ```python
   @dataclass
   class NormalizedResume:
       contact: ContactInfo | None
       summary: str | None
       sections: list[ResumeSection]

   @dataclass
   class ResumeSection:
       type: str  # "experience", "skills", etc.
       label: str  # Display header
       entries: list[dict]

   class ResumeTemplateRenderer:
       def normalize_tailored_content(content: dict) -> NormalizedResume
       def render(resume: NormalizedResume, options: ExportOptions) -> str
   ```

### Phase 4: Service Layer Updates

1. **Modify `service.py`:**
    - Rewrite `generate_pdf()` to:
      1. Normalize input via `ResumeTemplateRenderer`
      2. Render HTML via Jinja2
      3. Generate PDF via `HTMLToDocumentService`
      4. Return `(pdf_bytes, page_count, overflows)` tuple
    - Keep `generate_docx()` unchanged (uses python-docx)
    - Keep `generate_plain_text()` unchanged

### Phase 5: API Endpoint Updates

1. **Update `backend/app/api/routes/export.py`:**
    - Add response headers: `X-Page-Count`, `X-Overflows`
    - Keep fit-to-page endpoint unchanged

2. **Update `backend/app/api/routes/resume_builds.py`:**
    - Use new PDF generation for PDF format
    - Add metadata headers

### Phase 6: Cleanup

1. **Remove ReportLab:**
    - Delete lines 7-11 (imports) and 138-243 (generate_pdf) from service.py
    - Remove `reportlab = "^4.2.0"` from pyproject.toml
    - Run `poetry lock && poetry install`

2. **Update documentation:**
    - Update `/docs/architecture/170226_backend-architecture.md`
    - Update `/docs/api/upload-export.md` with page_count/overflows in response

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `backend/app/services/export/service.py` | Rewrite generate_pdf(), remove ReportLab |
| `backend/app/services/export/template_renderer.py` | CREATE - Jinja2 rendering service |
| `backend/app/services/export/templates/resume.html.j2` | CREATE - Main template |
| `backend/app/services/export/templates/_macros.html.j2` | CREATE - Section macros |
| `backend/app/services/export/styles/*.css` | CREATE - CSS files |
| `backend/app/services/export/fonts/` | CREATE - woff2 font files |
| `backend/app/api/routes/export.py` | Add response headers |
| `backend/app/api/routes/resume_builds.py` | Add response headers |
| `backend/pyproject.toml` | Remove reportlab, add jinja2 |
| `docs/architecture/170226_backend-architecture.md` | Document PDF pipeline change |
| `docs/api/upload-export.md` | Add page_count/overflows to schema |

---

## Files NOT to Touch

- DOCX export (python-docx in service.py)
- TipTap workshop export flow
- ATS scoring pipeline
- pdfplumber extraction logic
- Any frontend files
- fit_to_page.py (uses HTMLToDocumentService.render_page_count - preserved)

---

## Verification

1. **Unit tests:**
   - Test `normalize_tailored_content()` with all section types
   - Test template rendering output

2. **Integration tests:**
   - Export PDF via `/api/export/{tailored_id}`
   - Export PDF via `/api/resume_builds/{id}/export`
   - Verify page_count and overflows headers

3. **Manual verification:**
   - Compare PDF output for Classic, Modern, Minimal templates
   - Verify fonts render identically to frontend preview
   - Test fit-to-page still compresses correctly
