# Resume Preview Rendering Approaches

This document outlines two approaches for rendering resume previews in the Library/Resume edit page, their technical implementation, tradeoffs, and expected outputs.

## Problem Statement

When a user uploads a PDF or DOCX resume:

1. **Document extraction** happens - we get `raw_content` (plain text) and `html_content` (formatted HTML)
2. **The preview needs structured data** - the block editor expects `parsed_content` (semantic JSON)
3. **Gap**: `parsed_content` is currently null after upload, so the preview shows "No structured content"

The user wants the preview to:

- Look like the original uploaded document
- Have clear, editable sections they can "play around with"

---

## Data Formats Overview

### raw_content (Plain Text)

```text
John Doe
john.doe@email.com | 555-123-4567 | San Francisco, CA

Summary
Experienced software engineer with 8+ years building scalable web applications...

Experience
Senior Software Engineer at Acme Corp, San Francisco, CA
Jan 2020 - Present
• Led development of microservices architecture
• Reduced API latency by 40%
...
```

### html_content (Structured HTML)

```html
<h1>John Doe</h1>
<p>john.doe@email.com | 555-123-4567 | San Francisco, CA</p>
<h2>Summary</h2>
<p>Experienced software engineer with 8+ years building scalable web applications...</p>
<h2>Experience</h2>
<p>Senior Software Engineer at Acme Corp, San Francisco, CA</p>
<p>Jan 2020 - Present</p>
<ul>
  <li>Led development of microservices architecture</li>
  <li>Reduced API latency by 40%</li>
</ul>
```

### parsed_content (Semantic JSON)

```json
{
  "contact": {
    "name": "John Doe",
    "email": "john.doe@email.com",
    "phone": "555-123-4567",
    "location": "San Francisco, CA"
  },
  "summary": "Experienced software engineer with 8+ years...",
  "experience": [
    {
      "title": "Senior Software Engineer",
      "company": "Acme Corp",
      "location": "San Francisco, CA",
      "start_date": "Jan 2020",
      "end_date": "Present",
      "bullets": [
        "Led development of microservices architecture",
        "Reduced API latency by 40%"
      ]
    }
  ],
  "education": [...],
  "skills": [...]
}
```

---

## Approach 1: AI-Powered Semantic Parsing

### Overview

Use the existing `ResumeParser` service to send `raw_content` to an AI model (Claude/GPT), which extracts semantic structure and returns `parsed_content` JSON.

### Technical Flow

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│ Extract     │────▶│  AI Parse   │────▶│   Store     │
│  PDF/DOCX   │     │ raw_content │     │  to JSON    │     │parsed_content│
└─────────────┘     │ html_content│     └─────────────┘     └─────────────┘
                    └─────────────┘            │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Block Editor Uses  │
                                    │  parsed_content for │
                                    │  Editable Sections  │
                                    └─────────────────────┘
```

### Implementation Details

**Backend Service**: `backend/app/services/resume/parser.py`

```python
class ResumeParser:
    async def parse(self, raw_content: str) -> ParsedResume:
        # 1. Check cache (avoid re-parsing same content)
        cached = await self.cache.get_parsed_resume(raw_content)
        if cached:
            return cached

        # 2. Call AI with structured prompt
        response = await self.ai.generate_json(
            system_prompt=RESUME_PARSER_SYSTEM_PROMPT,
            user_prompt=f"Parse the following resume:\n\n{raw_content}",
        )

        # 3. Parse JSON response
        parsed = json.loads(response)

        # 4. Cache and return
        await self.cache.set_parsed_resume(raw_content, parsed)
        return parsed
```

**New Endpoint Needed**: `POST /api/resumes/{id}/parse`

```python
@router.post("/{resume_id}/parse")
async def parse_resume(resume_id: int, db: AsyncSession, parser: ResumeParser):
    resume = await resume_crud.get(db, id=resume_id)
    parsed_content = await parser.parse(resume.raw_content)
    await resume_crud.update(db, resume, {"parsed_content": parsed_content})
    return resume
```

**Frontend Changes**:

- Call parse endpoint after resume creation
- Or call it when opening edit page if `parsed_content` is null

### Expected Output

**parsed_content JSON**:

```json
{
  "contact": {
    "name": "John Doe",
    "email": "john.doe@email.com",
    "phone": "555-123-4567",
    "location": "San Francisco, CA",
    "linkedin": "linkedin.com/in/johndoe",
    "github": "github.com/johndoe",
    "website": null
  },
  "summary": "Experienced software engineer with 8+ years building scalable web applications. Expert in Python, TypeScript, and cloud architecture.",
  "experience": [
    {
      "title": "Senior Software Engineer",
      "company": "Acme Corp",
      "location": "San Francisco, CA",
      "start_date": "Jan 2020",
      "end_date": "Present",
      "bullets": [
        "Led development of microservices architecture serving 10M+ requests/day",
        "Reduced API latency by 40% through caching and query optimization",
        "Mentored 3 junior developers and conducted technical interviews"
      ]
    },
    {
      "title": "Software Engineer",
      "company": "StartupXYZ",
      "location": "Remote",
      "start_date": "Mar 2017",
      "end_date": "Dec 2019",
      "bullets": [
        "Built real-time notification system using WebSockets",
        "Implemented CI/CD pipeline reducing deployment time by 60%"
      ]
    }
  ],
  "education": [
    {
      "degree": "B.S. Computer Science",
      "institution": "UC Berkeley",
      "location": "Berkeley, CA",
      "graduation_date": "May 2017",
      "gpa": "3.8",
      "honors": "Magna Cum Laude"
    }
  ],
  "skills": ["Python", "TypeScript", "React", "Node.js", "AWS", "PostgreSQL", "Docker", "Kubernetes"],
  "certifications": [
    {
      "name": "AWS Solutions Architect",
      "issuer": "Amazon Web Services",
      "date": "2021"
    }
  ],
  "projects": []
}
```

**Preview Rendering**:

```text
┌─────────────────────────────────────────────────────────────┐
│                         JOHN DOE                            │
│     john.doe@email.com | 555-123-4567 | San Francisco, CA   │
│          linkedin.com/in/johndoe | github.com/johndoe       │
├─────────────────────────────────────────────────────────────┤
│  SUMMARY                                                    │
│  ───────────────────────────────────────────────────────────│
│  Experienced software engineer with 8+ years building       │
│  scalable web applications. Expert in Python, TypeScript,   │
│  and cloud architecture.                                    │
├─────────────────────────────────────────────────────────────┤
│  EXPERIENCE                                                 │
│  ───────────────────────────────────────────────────────────│
│  Senior Software Engineer                 Jan 2020 - Present│
│  Acme Corp | San Francisco, CA                              │
│    • Led development of microservices architecture...       │
│    • Reduced API latency by 40% through caching...          │
│    • Mentored 3 junior developers and conducted...          │
│                                                             │
│  Software Engineer                       Mar 2017 - Dec 2019│
│  StartupXYZ | Remote                                        │
│    • Built real-time notification system using WebSockets   │
│    • Implemented CI/CD pipeline reducing deployment...      │
├─────────────────────────────────────────────────────────────┤
│  EDUCATION                                                  │
│  ───────────────────────────────────────────────────────────│
│  B.S. Computer Science                             May 2017 │
│  UC Berkeley | Berkeley, CA                                 │
│  GPA: 3.8 | Magna Cum Laude                                 │
├─────────────────────────────────────────────────────────────┤
│  SKILLS                                                     │
│  ───────────────────────────────────────────────────────────│
│  Python • TypeScript • React • Node.js • AWS • PostgreSQL   │
│  Docker • Kubernetes                                        │
├─────────────────────────────────────────────────────────────┤
│  CERTIFICATIONS                                             │
│  ───────────────────────────────────────────────────────────│
│  AWS Solutions Architect - Amazon Web Services (2021)       │
└─────────────────────────────────────────────────────────────┘
```

### Editor Capabilities

With structured `parsed_content`, the block editor provides:

| Feature | How It Works |
| --------- | -------------- |
| **Edit single field** | Click "Senior Software Engineer" → edit just the title |
| **Add experience entry** | Click "+ Add Experience" → new empty entry form |
| **Remove bullet point** | Click trash icon next to bullet |
| **Reorder sections** | Drag "Skills" above "Education" |
| **Hide section** | Toggle eye icon to hide "References" from export |
| **Add new section** | Click "+ Add Section" → choose from dropdown |

### Tradeoffs

| Pros | Cons |
| ------ | ------ |
| **Semantic understanding** - AI knows "Senior Software Engineer" is a job title | **Cost** - ~$0.01-0.05 per resume (API tokens) |
| **Field-level editing** - Edit company without touching title | **Latency** - 2-5 seconds for AI response |
| **Section reordering** - Drag & drop sections | **AI errors** - May misparse unusual formats |
| **Consistent structure** - Output always follows schema | **Requires AI config** - Need API key |
| **ATS analysis** - Match keywords to specific sections | **Cache management** - Need to invalidate on edits |
| **Multiple export formats** - Same data, different templates | |

---

## Approach 2: Direct HTML Rendering

### HTML Overview

Render the existing `html_content` directly in the preview, bypassing the need for structured `parsed_content`. The HTML already has basic structure from the document converter.

### HTML Technical Flow

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│  Extract    │────▶│   Render    │
│  PDF/DOCX   │     │ html_content│     │   Directly  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Rich Text Editor   │
                                    │ (TipTap/Prosemirror)│
                                    └─────────────────────┘
```

### HTML Implementation Details

**Existing Converter**: `backend/app/services/document/converter.py`

Already implements:

- Section header detection (`<h2>Experience</h2>`)
- Bullet point conversion (`<ul><li>...</li></ul>`)
- Name detection (`<h1>John Doe</h1>`)
- Paragraph wrapping (`<p>...</p>`)

**Frontend Changes**:

Create a new `HTMLResumePreview` component:

```tsx
// components/library/preview/HTMLResumePreview.tsx
export function HTMLResumePreview({ htmlContent, style }: Props) {
  return (
    <div
      className="resume-html-preview"
      style={{
        fontFamily: style.fontFamily,
        fontSize: style.fontSizeBody,
        padding: `${style.marginTop}px ${style.marginRight}px`,
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
```

**CSS Styling**:

```css
.resume-html-preview h1 {
  font-size: 24px;
  text-align: center;
  margin-bottom: 8px;
}

.resume-html-preview h2 {
  font-size: 14px;
  text-transform: uppercase;
  border-bottom: 1px solid #ccc;
  margin-top: 16px;
}

.resume-html-preview ul {
  margin-left: 20px;
  list-style-type: disc;
}
```

### HTML Expected Output

**html_content (from converter)**:

```html
<h1>John Doe</h1>
<p>john.doe@email.com | 555-123-4567 | San Francisco, CA</p>
<p>linkedin.com/in/johndoe | github.com/johndoe</p>

<h2>Summary</h2>
<p>Experienced software engineer with 8+ years building scalable web applications. Expert in Python, TypeScript, and cloud architecture.</p>

<h2>Experience</h2>
<p>Senior Software Engineer at Acme Corp, San Francisco, CA</p>
<p>Jan 2020 - Present</p>
<ul>
  <li>Led development of microservices architecture serving 10M+ requests/day</li>
  <li>Reduced API latency by 40% through caching and query optimization</li>
  <li>Mentored 3 junior developers and conducted technical interviews</li>
</ul>

<p>Software Engineer at StartupXYZ</p>
<p>Mar 2017 - Dec 2019</p>
<ul>
  <li>Built real-time notification system using WebSockets</li>
  <li>Implemented CI/CD pipeline reducing deployment time by 60%</li>
</ul>

<h2>Education</h2>
<p>B.S. Computer Science, UC Berkeley, May 2017, GPA: 3.8, Magna Cum Laude</p>

<h2>Skills</h2>
<p>Python, TypeScript, React, Node.js, AWS, PostgreSQL, Docker, Kubernetes</p>

<h2>Certifications</h2>
<p>AWS Solutions Architect - Amazon Web Services (2021)</p>
```

**Preview Rendering**:

```text
┌─────────────────────────────────────────────────────────────┐
│                         John Doe                             │
│                                                              │
│  john.doe@email.com | 555-123-4567 | San Francisco, CA      │
│  linkedin.com/in/johndoe | github.com/johndoe               │
│                                                              │
│  Summary                                                     │
│  ───────────────────────────────────────────────────────────│
│  Experienced software engineer with 8+ years building        │
│  scalable web applications. Expert in Python, TypeScript,   │
│  and cloud architecture.                                     │
│                                                              │
│  Experience                                                  │
│  ───────────────────────────────────────────────────────────│
│  Senior Software Engineer at Acme Corp, San Francisco, CA   │
│  Jan 2020 - Present                                         │
│    • Led development of microservices architecture...       │
│    • Reduced API latency by 40% through caching...          │
│    • Mentored 3 junior developers and conducted...          │
│                                                              │
│  Software Engineer at StartupXYZ                            │
│  Mar 2017 - Dec 2019                                        │
│    • Built real-time notification system using WebSockets   │
│    • Implemented CI/CD pipeline reducing deployment...      │
│                                                              │
│  Education                                                   │
│  ───────────────────────────────────────────────────────────│
│  B.S. Computer Science, UC Berkeley, May 2017, GPA: 3.8,    │
│  Magna Cum Laude                                            │
│                                                              │
│  Skills                                                      │
│  ───────────────────────────────────────────────────────────│
│  Python, TypeScript, React, Node.js, AWS, PostgreSQL,       │
│  Docker, Kubernetes                                          │
│                                                              │
│  Certifications                                              │
│  ───────────────────────────────────────────────────────────│
│  AWS Solutions Architect - Amazon Web Services (2021)       │
└─────────────────────────────────────────────────────────────┘
```

### HTML Editor Capabilities

With HTML-only approach, editing is done via rich text editor:

| Feature | How It Works |
| --------- | -------------- |
| **Edit text** | Click anywhere, type to edit |
| **Add bullet** | Press Enter in list, or use toolbar |
| **Bold/Italic** | Select text, use toolbar |
| **Add section** | Type heading, format as H2 |
| **Reorder sections** | Cut & paste manually |
| **Remove content** | Select and delete |

### HTML Tradeoffs

| Pros | Cons |
| ------ | ------ |
| **Instant** - No AI call, no latency | **No semantic editing** - Can't edit "job title" as a field |
| **Free** - No API costs | **No block reordering** - Must cut/paste |
| **Already extracted** - Just render existing data | **No field validation** - Can break structure easily |
| **WYSIWYG** - What you see is what you uploaded | **Limited ATS** - Can't analyze by section |
| **Simple implementation** - Just render HTML | **Inconsistent** - Different docs produce different HTML |
| | **No structured export** - Can't apply different templates |

---

## Comparison Matrix

| Feature | Approach 1 (AI Parser) | Approach 2 (HTML Direct) |
| --------- | ------------------------ | -------------------------- |
| **Edit job title only** | ✅ Click field, edit | ❌ Find in text, edit |
| **Add experience entry** | ✅ Click "Add" button | ❌ Type manually |
| **Reorder sections** | ✅ Drag & drop | ❌ Cut & paste |
| **Hide section** | ✅ Toggle visibility | ❌ Delete it |
| **ATS keyword analysis** | ✅ Per-section | ⚠️ Whole document |
| **Multiple export templates** | ✅ Yes | ❌ No |
| **Cost per resume** | ~$0.01-0.05 | $0 |
| **Processing time** | 2-5 seconds | Instant |
| **Works offline** | ❌ Needs AI API | ✅ Yes |
| **Handles unusual formats** | ⚠️ AI may misparse | ✅ Shows as-is |

---

## Hybrid Approach (Optional)

A third option combines both approaches:

1. **Immediately render HTML** - Show `html_content` preview instantly
2. **Parse in background** - Call AI parser asynchronously
3. **Upgrade when ready** - Switch to block editor when `parsed_content` is available

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Upload    │────▶│  Extract    │────▶│  Show HTML Preview  │
│  PDF/DOCX   │     │  html_content│     │  (Instant)          │
└─────────────┘     └─────────────┘     └─────────────────────┘
                           │
                           ▼ (Background)
                    ┌─────────────┐     ┌─────────────────────┐
                    │  AI Parse   │────▶│  Upgrade to Block   │
                    │  to JSON    │     │  Editor (2-5 sec)   │
                    └─────────────┘     └─────────────────────┘
```

This provides instant feedback while still enabling full editing capabilities.

---

## Recommendation

| Use Case | Recommended Approach |
| ---------- | --------------------- |
| Production resume builder with editing | **Approach 1** (AI Parser) |
| Quick preview during development | **Approach 2** (HTML Direct) |
| Cost-sensitive / offline-first | **Approach 2** (HTML Direct) |
| Full-featured resume tailoring | **Approach 1** (AI Parser) |
| MVP / prototype | **Approach 2** → migrate to **Approach 1** |

For the goal of "clear sections we can play around with", **Approach 1 (AI Parser)** is required. The HTML approach cannot provide field-level editing or section reordering.

---

## Implementation Checklist

### Approach 1 (AI Parser)

- [ ] Add `/api/resumes/{id}/parse` endpoint
- [ ] Wire `ResumeParser` service to endpoint
- [ ] Configure AI client (Claude/OpenAI API key)
- [ ] Set up Redis cache for parsed results
- [ ] Frontend: Call parse after resume creation
- [ ] Frontend: Show loading state during parsing
- [ ] Frontend: Handle parse errors gracefully
- [ ] Add "Re-parse" button for re-processing

### Approach 2 (HTML Direct)

- [ ] Create `HTMLResumePreview` component
- [ ] Add CSS styles for resume HTML rendering
- [ ] Modify edit page to use HTML preview when `parsed_content` is null
- [ ] Integrate TipTap editor for HTML editing
- [ ] Add basic formatting toolbar

---

## Related Files

**Backend**:

- `backend/app/services/resume/parser.py` - AI parsing service
- `backend/app/services/document/converter.py` - HTML conversion
- `backend/app/api/routes/resumes.py` - Resume endpoints
- `backend/app/models/resume.py` - Resume model

**Frontend**:

- `frontend/src/app/dashboard/library/resumes/[id]/edit/page.tsx` - Edit page
- `frontend/src/components/library/preview/PagedResumePreview.tsx` - Block preview
- `frontend/src/components/library/editor/BlockEditorProvider.tsx` - Editor state
- `frontend/src/lib/resume/transforms.ts` - Data transformations
