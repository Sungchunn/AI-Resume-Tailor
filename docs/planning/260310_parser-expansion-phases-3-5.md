# Backend Parser Expansion: Phases 3-5 Implementation Plan

**Date:** 2026-03-10
**Status:** Ready for Implementation
**Prerequisite:** Phases 1-2 completed (MongoDB models, Parser TypedDicts, AI prompts)

---

## Current State Summary

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase 1: MongoDB Models | ✅ Complete | All 16 entry models in `resume.py` |
| Phase 2: Parser TypedDicts | ✅ Complete | All TypedDicts + AI prompt updated |
| Phase 3: Tailor Service | ✅ Mostly Complete | Need field name alignment |
| Phase 4: API Schemas | ✅ Mostly Complete | Need field name alignment |
| Phase 5: Testing | ❌ Not Started | Full verification needed |

---

## Phase 3: Tailor Service Alignment

### 3.1 Issue: Leadership Field Name Inconsistency

**Problem:** The `Leadership` entry has inconsistent field naming across files:

| File | Field Name | Should Be |
| ---- | ---------- | --------- |
| `parser.py` Leadership TypedDict | `title` | `title` ✅ |
| `resume.py` LeadershipEntry | `role` | `title` ❌ |
| `tailor.py` LeadershipEntrySchema | `role` | `title` ❌ |
| `tailor.py` TAILORING_SYSTEM_PROMPT | `title` | `title` ✅ |
| Frontend TailoredContent | `title` | `title` ✅ |

**Action Required:**

#### File 1: `backend/app/models/mongo/resume.py`

Change `LeadershipEntry.role` to `LeadershipEntry.title`:

```python
class LeadershipEntry(BaseModel):
    """Leadership experience entry in parsed resume."""

    id: str | None = None
    title: str | None = None  # Changed from 'role' to align with frontend
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)
```

#### File 2: `backend/app/schemas/tailor.py`

Change `LeadershipEntrySchema.role` to `LeadershipEntrySchema.title`:

```python
class LeadershipEntrySchema(BaseModel):
    """Leadership experience entry in parsed resume."""

    id: str | None = None
    title: str | None = None  # Changed from 'role' to align with frontend
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = []
```

### 3.2 Verify Tailor Service Components

**Already Complete:**

- [x] `TAILORING_SYSTEM_PROMPT` includes all 16 sections (lines 51-218)
- [x] `_ensure_ids()` handles all 12 entry-based sections (lines 508-537)
- [x] `_validate_ids_preserved()` logs warnings for missing IDs

**No additional changes needed after field alignment.**

---

## Phase 4: API Schema Verification

### 4.1 Verify All Entry Schemas Exist

**Already Complete in `backend/app/schemas/tailor.py`:**

| Schema | Lines | Status |
| ------ | ----- | ------ |
| ContactInfoSchema | 41-50 | ✅ |
| ExperienceEntrySchema | 53-62 | ✅ |
| EducationEntrySchema | 65-76 | ✅ (has minor, relevant_courses) |
| ProjectEntrySchema | 79-89 | ✅ (has bullets, start/end dates) |
| LanguageEntrySchema | 92-97 | ✅ |
| VolunteerEntrySchema | 100-110 | ✅ |
| PublicationEntrySchema | 113-122 | ✅ |
| AwardEntrySchema | 125-132 | ✅ |
| ReferenceEntrySchema | 135-144 | ✅ |
| CourseEntrySchema | 147-154 | ✅ |
| MembershipEntrySchema | 157-164 | ✅ |
| LeadershipEntrySchema | 167-177 | ⚠️ (needs field rename) |
| CertificationEntrySchema | 180-189 | ✅ |
| ParsedContentSchema | 192-213 | ✅ (has all 16 sections) |

### 4.2 Verify Certification Migration

**Already Complete:**

```python
@model_validator(mode="before")
@classmethod
def migrate_certifications(cls, data: Any) -> Any:
    """Migrate old certifications format (list[str]) to new format."""
    if isinstance(data, dict) and "certifications" in data:
        certs = data["certifications"]
        if certs and isinstance(certs, list) and len(certs) > 0:
            if isinstance(certs[0], str):
                data["certifications"] = [{"name": cert} for cert in certs]
    return data
```

This is implemented in both:

- `backend/app/models/mongo/resume.py` ParsedContent (lines 211-227)
- `backend/app/schemas/tailor.py` ParsedContentSchema (lines 215-224)

---

## Phase 5: Testing & Verification

### 5.1 Backend Unit Tests

Create `backend/tests/services/test_parser_16_sections.py`:

```python
"""Test resume parser extracts all 16 section types."""

import pytest
from app.services.resume.parser import ResumeParser

# Sample resume text with all sections
FULL_RESUME_TEXT = """
John Doe
john@email.com | (555) 123-4567 | San Francisco, CA
linkedin.com/in/johndoe | github.com/johndoe

SUMMARY
Experienced software engineer with 8+ years...

EXPERIENCE
Senior Software Engineer | TechCorp | San Francisco, CA | Jan 2020 - Present
- Led development of microservices architecture
- Reduced API latency by 40%

Software Engineer | StartupXYZ | New York, NY | Jun 2016 - Dec 2019
- Built real-time data pipeline processing 1M events/day
- Mentored 3 junior developers

EDUCATION
Master of Science in Computer Science | Stanford University | 2016
GPA: 3.9 | Minor: Mathematics
Honors: Dean's List, Graduate Fellowship

SKILLS
Python, TypeScript, AWS, Docker, Kubernetes, PostgreSQL

CERTIFICATIONS
AWS Solutions Architect Professional | Amazon Web Services | 2023
Certified Kubernetes Administrator | CNCF | 2022

PROJECTS
Open Source CLI Tool | github.com/johndoe/cli-tool
Built a developer productivity tool used by 5000+ developers
Technologies: Rust, GitHub Actions
- Automated release pipeline with 99.9% uptime
- Reduced build times by 60%

LANGUAGES
English (Native), Spanish (Fluent), Mandarin (Intermediate)

VOLUNTEER
Tech Mentor | Code.org | 2019 - Present
- Taught programming to 200+ underrepresented students

PUBLICATIONS
"Scalable Microservices Patterns" | IEEE Software | 2021
Authors: John Doe, Jane Smith

AWARDS
Employee of the Year | TechCorp | 2022
Innovation Award | StartupXYZ | 2018

INTERESTS
Open source contribution, rock climbing, photography

REFERENCES
Jane Smith | Engineering Director | TechCorp | jane@techcorp.com

COURSES
Machine Learning Specialization | Coursera (Stanford) | 2021

MEMBERSHIPS
Association for Computing Machinery (ACM) | Member | 2015 - Present

LEADERSHIP
Tech Lead | Company Hackathon | 2021
- Organized 3-day hackathon with 50 participants
- Secured $10K in prizes from sponsors
"""


@pytest.mark.asyncio
async def test_parser_extracts_all_16_sections():
    """Verify parser extracts all 16 section types."""
    parser = ResumeParser()
    result = await parser.parse(FULL_RESUME_TEXT)

    # Contact info
    assert result["contact"]["name"] == "John Doe"
    assert result["contact"]["email"] == "john@email.com"

    # Summary
    assert "software engineer" in result["summary"].lower()

    # Experience
    assert len(result["experience"]) == 2
    assert result["experience"][0]["company"] == "TechCorp"
    assert len(result["experience"][0]["bullets"]) >= 2

    # Education
    assert len(result["education"]) == 1
    assert result["education"][0]["minor"] == "Mathematics"

    # Skills
    assert "Python" in result["skills"]

    # Certifications (structured)
    assert len(result["certifications"]) == 2
    assert result["certifications"][0]["name"] == "AWS Solutions Architect Professional"
    assert result["certifications"][0]["issuer"] == "Amazon Web Services"

    # Projects with bullets
    assert len(result["projects"]) == 1
    assert len(result["projects"][0]["bullets"]) >= 2

    # Languages
    assert len(result["languages"]) == 3
    assert result["languages"][0]["proficiency"] in ["native", "fluent", "advanced", "intermediate", "basic"]

    # Volunteer
    assert len(result["volunteer"]) == 1
    assert result["volunteer"][0]["organization"] == "Code.org"

    # Publications
    assert len(result["publications"]) == 1

    # Awards
    assert len(result["awards"]) == 2

    # Interests
    assert "photography" in result["interests"].lower()

    # References
    assert len(result["references"]) == 1

    # Courses
    assert len(result["courses"]) == 1

    # Memberships
    assert len(result["memberships"]) == 1

    # Leadership
    assert len(result["leadership"]) == 1
    assert result["leadership"][0]["title"] == "Tech Lead"  # Note: 'title' not 'role'


@pytest.mark.asyncio
async def test_parser_backward_compat_7_sections():
    """Verify parser still works with resumes having only 7 original sections."""
    parser = ResumeParser()
    simple_resume = """
    Jane Smith
    jane@email.com

    SUMMARY
    Product manager with 5 years experience.

    EXPERIENCE
    Product Manager | BigCo | 2018 - Present
    - Launched 3 products

    EDUCATION
    BS Business | UCLA | 2017

    SKILLS
    Product Management, Agile, SQL
    """

    result = await parser.parse(simple_resume)

    # Should have the basic sections
    assert result["contact"]["name"] == "Jane Smith"
    assert len(result["experience"]) == 1

    # Missing sections should be empty, not cause errors
    assert result["languages"] == []
    assert result["volunteer"] == []
    assert result["leadership"] == []


@pytest.mark.asyncio
async def test_parser_generates_ids():
    """Verify parser generates IDs for all entry types."""
    parser = ResumeParser()
    result = await parser.parse(FULL_RESUME_TEXT)

    # Check IDs are generated for all entry-based sections
    entry_sections = [
        "experience", "education", "projects", "certifications",
        "languages", "volunteer", "publications", "awards",
        "references", "courses", "memberships", "leadership"
    ]

    for section in entry_sections:
        if result.get(section):
            for entry in result[section]:
                assert "id" in entry, f"Missing ID in {section}"
                assert entry["id"], f"Empty ID in {section}"
```

### 5.2 Integration Test

Create `backend/tests/integration/test_resume_upload_parse.py`:

```python
"""Integration test for resume upload and parsing flow."""

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_upload_pdf_extracts_all_sections(
    async_client: AsyncClient,
    auth_headers: dict,
    sample_pdf_bytes: bytes,
):
    """Test uploading a PDF extracts all 16 section types."""
    # Upload resume
    response = await async_client.post(
        "/api/resumes/upload",
        files={"file": ("resume.pdf", sample_pdf_bytes, "application/pdf")},
        headers=auth_headers,
    )
    assert response.status_code == 201

    resume_id = response.json()["id"]

    # Wait for parsing to complete
    # ... polling logic for parse status ...

    # Fetch parsed resume
    response = await async_client.get(
        f"/api/resumes/{resume_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200

    parsed = response.json()["parsed"]

    # Verify structure
    assert parsed is not None
    assert "contact" in parsed
    assert "experience" in parsed
    # ... verify all 16 sections present ...
```

### 5.3 Manual Testing Checklist

#### Upload & Parse Tests

- [ ] Upload PDF with all 16 sections → all sections extracted
- [ ] Upload PDF with only 7 original sections → still works (backward compat)
- [ ] Upload DOCX with volunteer/awards → sections extracted
- [ ] Upload PDF with nested bullet points in Projects → bullets captured
- [ ] Upload PDF with education minor → minor field populated
- [ ] Upload PDF with structured certifications → cert entries with issuer/date

#### Tailor Flow Tests

- [ ] Start tailor for resume with all 16 sections → all sections in tailored output
- [ ] Tailor preserves IDs across all section types
- [ ] Sections not in original remain empty in tailored (not invented)
- [ ] Leadership entries have `title` field (not `role`)

#### Verification Step Tests (Step 3 UI)

- [ ] All 16 sections visible in section editor
- [ ] Can edit each section type
- [ ] Changes save correctly to backend
- [ ] Section order persists

#### API Response Tests

Run these with curl or API client:

```bash
# Get parsed resume - verify all 16 sections in response
curl -X GET "http://localhost:8000/api/resumes/{id}" \
  -H "Authorization: Bearer {token}" | jq '.parsed | keys'

# Expected output: 16 section keys
# ["contact", "summary", "experience", "education", "skills",
#  "certifications", "projects", "languages", "volunteer",
#  "publications", "awards", "interests", "references",
#  "courses", "memberships", "leadership"]
```

### 5.4 Run Test Commands

```bash
# Backend tests
cd backend
poetry run pytest tests/services/test_parser_16_sections.py -v
poetry run pytest tests/services/test_tailor_service.py -v

# Type checking
poetry run mypy app/services/resume/parser.py
poetry run mypy app/models/mongo/resume.py

# Full test suite
poetry run pytest --tb=short

# Frontend build (verify no type errors)
cd ../frontend
bun run build
```

---

## Implementation Checklist

### Phase 3 Tasks

- [ ] Fix `LeadershipEntry.role` → `title` in `backend/app/models/mongo/resume.py`
- [ ] Fix `LeadershipEntrySchema.role` → `title` in `backend/app/schemas/tailor.py`
- [ ] Verify `_ensure_ids()` handles all 12 entry sections (already done)
- [ ] Verify `TAILORING_SYSTEM_PROMPT` has all 16 sections (already done)

### Phase 4 Tasks

- [ ] Verify all 16 entry schemas exist (already done)
- [ ] Verify `ParsedContentSchema` has all 16 fields (already done)
- [ ] Verify certification migration validator exists (already done)

### Phase 5 Tasks

- [ ] Create parser unit tests
- [ ] Create integration tests
- [ ] Run manual testing checklist
- [ ] Verify backend tests pass
- [ ] Verify frontend builds without errors

---

## Rollback Plan

If issues arise after deployment:

1. **MongoDB Backward Compatibility:** All new fields have defaults (`Field(default_factory=list)` or `= None`), so existing documents will load without errors.

2. **Certification Migration:** The `@model_validator` handles both old (`list[str]`) and new (`list[CertificationEntry]`) formats automatically.

3. **Leadership Field Rename:** If `role` data exists in MongoDB, add a migration validator:

```python
@model_validator(mode="before")
@classmethod
def migrate_leadership_field(cls, data: Any) -> Any:
    """Migrate 'role' to 'title' for leadership entries."""
    if isinstance(data, dict) and "leadership" in data:
        for entry in data.get("leadership", []):
            if isinstance(entry, dict) and "role" in entry and "title" not in entry:
                entry["title"] = entry.pop("role")
    return data
```

---

## Success Criteria

1. Parser extracts all 16 section types from uploaded resumes
2. Tailor service generates complete tailored content with all sections
3. Frontend displays all sections in verification step
4. No regression in existing 7-section resume functionality
5. All tests pass, frontend builds without errors
