# Backend Parser Expansion Plan

**Date:** 2026-03-09
**Status:** Planned
**Scope:** Backend only (MongoDB)

---

## Overview

Expand the backend resume parser to extract all 16 section types from uploaded PDF/DOCX files. The frontend already supports all sections - the backend parser is the bottleneck.

**Database Impact:** MongoDB only (no PostgreSQL changes needed)

---

## Current vs Target State

| Section | Current Parser | Target |
| ------- | -------------- | ------ |
| contact | ✅ | ✅ |
| summary | ✅ | ✅ |
| experience | ✅ | ✅ |
| education | ✅ (missing minor) | ✅ + minor field |
| skills | ✅ | ✅ |
| certifications | ✅ (as strings) | ✅ as structured entries |
| projects | ✅ (missing bullets) | ✅ + bullets field |
| languages | ❌ | ✅ |
| volunteer | ❌ | ✅ |
| publications | ❌ | ✅ |
| awards | ❌ | ✅ |
| interests | ❌ | ✅ |
| references | ❌ | ✅ |
| courses | ❌ | ✅ |
| memberships | ❌ | ✅ |
| leadership | ❌ | ✅ |

---

## Files to Modify

### 1. MongoDB Models

**File:** `backend/app/models/mongo/resume.py`

**Changes:**

- Add 9 new Pydantic entry models: `LanguageEntry`, `VolunteerEntry`, `PublicationEntry`, `AwardEntry`, `ReferenceEntry`, `CourseEntry`, `MembershipEntry`, `LeadershipEntry`, `CertificationEntry`
- Update `EducationEntry`: add `minor: str | None`, `relevant_courses: list[str]`
- Update `ProjectEntry`: add `bullets: list[str]`, `start_date`, `end_date`
- Update `ParsedContent`: add all 9 new section fields

### 2. Parser Service

**File:** `backend/app/services/resume/parser.py`

**Changes:**

- Add 9 new TypedDicts matching the Pydantic models
- Update `Education` TypedDict: add `minor`, `relevant_courses`
- Update `Project` TypedDict: add `bullets`, `start_date`, `end_date`
- Update `ParsedResume` TypedDict with all 16 sections
- Rewrite `RESUME_PARSER_SYSTEM_PROMPT` with complete JSON schema

### 3. Tailor Service

**File:** `backend/app/services/resume/tailor.py`

**Changes:**

- Update `TAILORING_SYSTEM_PROMPT` with all 16 sections
- Update `_ensure_ids()` to handle all entry-based sections
- Update `_validate_ids_preserved()` for all sections

### 4. API Schemas

**File:** `backend/app/schemas/tailor.py`

**Changes:**

- Add 9 new entry schema classes
- Update `EducationEntrySchema`, `ProjectEntrySchema`
- Update `ParsedContentSchema` with all fields

### 5. Default Section Order

**File:** `backend/app/models/mongo/tailored_resume.py`

**Changes:**

- Update `DEFAULT_SECTION_ORDER` to include all 16 sections

---

## Implementation Steps

### Step 1: MongoDB Models (~30 lines per model)

Add to `backend/app/models/mongo/resume.py`:

```python
# New entry models (9 total)
class LanguageEntry(BaseModel):
    id: str | None = None
    language: str | None = None
    proficiency: str | None = None

class VolunteerEntry(BaseModel):
    id: str | None = None
    role: str | None = None
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)

class PublicationEntry(BaseModel):
    id: str | None = None
    title: str | None = None
    publication_type: str | None = None
    publisher: str | None = None
    date: str | None = None
    url: str | None = None
    authors: str | None = None
    description: str | None = None

class AwardEntry(BaseModel):
    id: str | None = None
    title: str | None = None
    issuer: str | None = None
    date: str | None = None
    description: str | None = None

class ReferenceEntry(BaseModel):
    id: str | None = None
    name: str | None = None
    title: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None

class CourseEntry(BaseModel):
    id: str | None = None
    name: str | None = None
    provider: str | None = None
    date: str | None = None
    credential_url: str | None = None
    description: str | None = None

class MembershipEntry(BaseModel):
    id: str | None = None
    organization: str | None = None
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None

class LeadershipEntry(BaseModel):
    id: str | None = None
    title: str | None = None
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)

class CertificationEntry(BaseModel):
    id: str | None = None
    name: str | None = None
    issuer: str | None = None
    date: str | None = None
    expiration_date: str | None = None
    credential_id: str | None = None
    url: str | None = None
```

### Step 2: Update Existing Models

**EducationEntry additions:**

```python
class EducationEntry(BaseModel):
    # ... existing fields ...
    minor: str | None = None  # ADD
    relevant_courses: list[str] = Field(default_factory=list)  # ADD
```

**ProjectEntry additions:**

```python
class ProjectEntry(BaseModel):
    # ... existing fields ...
    start_date: str | None = None  # ADD
    end_date: str | None = None    # ADD
    bullets: list[str] = Field(default_factory=list)  # ADD
```

### Step 3: Update ParsedContent

```python
class ParsedContent(BaseModel):
    # existing 7 fields...
    contact: ContactInfo | None = None
    summary: str | None = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)  # CHANGED
    projects: list[ProjectEntry] = Field(default_factory=list)

    # NEW: 9 additional sections
    languages: list[LanguageEntry] = Field(default_factory=list)
    volunteer: list[VolunteerEntry] = Field(default_factory=list)
    publications: list[PublicationEntry] = Field(default_factory=list)
    awards: list[AwardEntry] = Field(default_factory=list)
    interests: str | None = None
    references: list[ReferenceEntry] = Field(default_factory=list)
    courses: list[CourseEntry] = Field(default_factory=list)
    memberships: list[MembershipEntry] = Field(default_factory=list)
    leadership: list[LeadershipEntry] = Field(default_factory=list)
```

### Step 4: Parser TypedDicts

Add to `backend/app/services/resume/parser.py`:

```python
# 9 new TypedDicts matching Pydantic models
class Language(TypedDict, total=False):
    id: str
    language: str
    proficiency: str

class Volunteer(TypedDict, total=False):
    id: str
    role: str
    organization: str
    location: str
    start_date: str
    end_date: str
    description: str
    bullets: list[str]

class Publication(TypedDict, total=False):
    id: str
    title: str
    publication_type: str
    publisher: str
    date: str
    url: str
    authors: str
    description: str

class Award(TypedDict, total=False):
    id: str
    title: str
    issuer: str
    date: str
    description: str

class Reference(TypedDict, total=False):
    id: str
    name: str
    title: str
    company: str
    email: str
    phone: str
    relationship: str

class Course(TypedDict, total=False):
    id: str
    name: str
    provider: str
    date: str
    credential_url: str
    description: str

class Membership(TypedDict, total=False):
    id: str
    organization: str
    role: str
    start_date: str
    end_date: str

class Leadership(TypedDict, total=False):
    id: str
    title: str
    organization: str
    location: str
    start_date: str
    end_date: str
    description: str
    bullets: list[str]

class Certification(TypedDict, total=False):
    id: str
    name: str
    issuer: str
    date: str
    expiration_date: str
    credential_id: str
    url: str

# Update ParsedResume
class ParsedResume(TypedDict, total=False):
    contact: ContactInfo
    summary: str
    experience: list[Experience]
    education: list[Education]
    skills: list[str]
    certifications: list[Certification]  # CHANGED from list[str]
    projects: list[Project]
    # New sections
    languages: list[Language]
    volunteer: list[Volunteer]
    publications: list[Publication]
    awards: list[Award]
    interests: str
    references: list[Reference]
    courses: list[Course]
    memberships: list[Membership]
    leadership: list[Leadership]
```

### Step 5: Update AI Parser Prompt

Replace `RESUME_PARSER_SYSTEM_PROMPT` with expanded version showing all 16 sections:

```python
RESUME_PARSER_SYSTEM_PROMPT = """You are an expert resume parser. Extract structured information from resumes.

Parse the resume into the following JSON structure:
{
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "555-555-5555",
    "location": "City, State",
    "linkedin": "linkedin.com/in/profile",
    "github": "github.com/username",
    "website": "personal-website.com"
  },
  "summary": "Professional summary or objective statement",
  "experience": [
    {
      "id": "exp-0",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "id": "edu-0",
      "degree": "Degree Name",
      "institution": "University Name",
      "location": "City, State",
      "graduation_date": "Month Year",
      "gpa": "3.8/4.0",
      "minor": "Minor field if applicable",
      "honors": ["Honor 1", "Honor 2"],
      "relevant_courses": ["Course 1", "Course 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": [
    {
      "id": "cert-0",
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Month Year",
      "expiration_date": "Month Year or null",
      "credential_id": "ID if present",
      "url": "verification-url.com"
    }
  ],
  "projects": [
    {
      "id": "proj-0",
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "project-url.com",
      "start_date": "Month Year",
      "end_date": "Month Year",
      "bullets": ["Detail 1", "Detail 2"]
    }
  ],
  "languages": [
    {
      "id": "lang-0",
      "language": "Language Name",
      "proficiency": "native|fluent|advanced|intermediate|basic"
    }
  ],
  "volunteer": [
    {
      "id": "vol-0",
      "role": "Volunteer Role",
      "organization": "Organization Name",
      "location": "City, State",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "description": "Brief description",
      "bullets": ["Accomplishment 1", "Accomplishment 2"]
    }
  ],
  "publications": [
    {
      "id": "pub-0",
      "title": "Publication Title",
      "publication_type": "paper|article|book|thesis|patent|other",
      "publisher": "Publisher or Journal Name",
      "date": "Month Year",
      "url": "publication-url.com",
      "authors": "Author names (comma-separated)",
      "description": "Brief description or abstract"
    }
  ],
  "awards": [
    {
      "id": "award-0",
      "title": "Award Name",
      "issuer": "Issuing Organization",
      "date": "Month Year",
      "description": "Brief description"
    }
  ],
  "interests": "Freeform text describing hobbies and interests",
  "references": [
    {
      "id": "ref-0",
      "name": "Reference Name",
      "title": "Job Title",
      "company": "Company Name",
      "email": "email@example.com",
      "phone": "555-555-5555",
      "relationship": "Manager, Colleague, etc."
    }
  ],
  "courses": [
    {
      "id": "course-0",
      "name": "Course Name",
      "provider": "Provider (Coursera, Udemy, etc.)",
      "date": "Month Year",
      "credential_url": "certificate-url.com",
      "description": "Brief description"
    }
  ],
  "memberships": [
    {
      "id": "mem-0",
      "organization": "Organization Name",
      "role": "Member role if any",
      "start_date": "Month Year",
      "end_date": "Month Year or Present"
    }
  ],
  "leadership": [
    {
      "id": "lead-0",
      "title": "Leadership Role",
      "organization": "Organization or Club Name",
      "location": "City, State",
      "start_date": "Month Year",
      "end_date": "Month Year or Present",
      "description": "Brief description",
      "bullets": ["Accomplishment 1", "Accomplishment 2"]
    }
  ]
}

Rules:
- Extract ALL information present in the resume
- Use empty strings for missing text fields
- Use empty arrays for missing list fields
- Use null for optional fields not present in the resume
- Preserve the original wording of bullet points
- Parse dates in a consistent format (Month Year)
- If a section doesn't exist in the resume, include it with empty values
- Generate sequential IDs for each entry (e.g., "exp-0", "exp-1", etc.)
- For proficiency levels, normalize to: native, fluent, advanced, intermediate, basic
- For publication types, normalize to: paper, article, book, thesis, patent, other"""
```

### Step 6: Update Tailor Service

Update `_ensure_ids()` in `backend/app/services/resume/tailor.py`:

```python
def _ensure_ids(self, parsed: dict[str, Any]) -> dict[str, Any]:
    """Ensure all list items have IDs for diffing."""
    result = dict(parsed)

    entry_sections = {
        "experience": "exp",
        "education": "edu",
        "projects": "proj",
        "certifications": "cert",
        "languages": "lang",
        "volunteer": "vol",
        "publications": "pub",
        "awards": "award",
        "references": "ref",
        "courses": "course",
        "memberships": "mem",
        "leadership": "lead",
    }

    for section, prefix in entry_sections.items():
        if section in result and result[section]:
            for i, entry in enumerate(result[section]):
                if isinstance(entry, dict) and not entry.get("id"):
                    entry["id"] = f"{prefix}-{i}-{uuid.uuid4().hex[:8]}"

    return result
```

### Step 7: Update Default Section Order

In `backend/app/models/mongo/tailored_resume.py`:

```python
DEFAULT_SECTION_ORDER = [
    "summary",
    "experience",
    "skills",
    "education",
    "projects",
    "certifications",
    "volunteer",
    "publications",
    "awards",
    "languages",
    "leadership",
    "memberships",
    "courses",
    "interests",
    "references",
]
```

---

## Backward Compatibility

- All new fields use `Field(default_factory=list)` or `= None`
- Existing resumes with 7 sections will continue to work
- No database migration needed (MongoDB is schemaless)
- **Certifications migration:** Convert `list[str]` to `list[CertificationEntry]` at read time:

```python
def migrate_certifications(certs: list[str] | list[dict]) -> list[dict]:
    if not certs:
        return []
    result = []
    for i, cert in enumerate(certs):
        if isinstance(cert, str):
            result.append({"id": f"cert-{i}", "name": cert})
        else:
            result.append(cert)
    return result
```

---

## Verification Plan

### Unit Tests

```bash
cd backend && poetry run pytest tests/services/test_resume_parser.py -v
```

Create tests for:

1. Parse resume with all 16 sections
2. Parse resume with subset (backward compat)
3. ID generation for all entry types
4. Certification migration (string to entry)

### Integration Test

1. Upload PDF with volunteer/awards/languages sections
2. Call `/resumes/{id}/parse` endpoint
3. Verify all sections extracted in response
4. Start tailor flow → Verify all sections in editor

### Manual Test Checklist

- [ ] Upload PDF with volunteer experience → appears in parsed content
- [ ] Upload PDF with awards section → appears in parsed content
- [ ] Upload PDF with languages → appears in parsed content
- [ ] Upload PDF with projects having sub-bullets → bullets extracted
- [ ] Upload PDF with education minor → minor field populated
- [ ] Existing resume (7 sections) → still loads correctly
- [ ] Tailor flow with new sections → sections appear in editor
