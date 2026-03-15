# Phase 3: Verify Step Section Editors

**Date:** 2026-03-10
**Status:** Ready for Implementation
**Source:** `/docs/planning/100326_phases-3-5-editor-improvements.md`

---

## Objective

Enable editing of all 16 section types in the Verify step's ContentEditor component. Currently only 6 sections are editable; this phase adds the remaining 10 and fixes field gaps in existing sections.

---

## Gap Analysis

### Current Section Support

| Section | Status | Missing Fields |
| ------- | ------ | -------------- |
| summary | Working | - |
| experience | Working | - |
| education | Partial | minor, relevant_courses |
| skills | Working | - |
| certifications | Working | - |
| projects | Partial | start_date, end_date |
| languages | Not implemented | - |
| volunteer | Not implemented | - |
| publications | Not implemented | - |
| awards | Not implemented | - |
| interests | Not implemented | - |
| references | Not implemented | - |
| courses | Not implemented | - |
| memberships | Not implemented | - |
| leadership | Not implemented | - |

### Critical Issue: Leadership Field Mismatch

| Location | Field Name |
| -------- | ---------- |
| Backend `resume.py` | `role` |
| Backend `tailor.py` | `role` |
| Frontend `types.ts` | `title` |

**Resolution:** Change backend to use `title` with backward-compatible migration validator.

---

## Implementation Steps

### Step 1: Backend - Fix Leadership Field (Phase 3.0)

**Files:**

- `/backend/app/models/mongo/resume.py` (lines 163-173)
- `/backend/app/schemas/tailor.py` (lines 167-178)

**Changes:**

1. Rename `role` to `title` in LeadershipEntry and LeadershipEntrySchema
2. Add Pydantic model_validator for backward compatibility:

```python
class LeadershipEntry(BaseModel):
    id: str | None = None
    title: str | None = None  # Changed from role
    organization: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def migrate_role_to_title(cls, data: Any) -> Any:
        if isinstance(data, dict) and "role" in data and "title" not in data:
            data["title"] = data.pop("role")
        return data
```

---

### Step 2: Frontend - Add Missing Fields to Existing Sections (Phase 3.1)

**File:** `/frontend/src/components/editor/ContentEditor.tsx`

#### Education Section (after line 420)

Add `minor` and `relevant_courses` fields:

```tsx
<input
  type="text"
  value={edu.minor ?? ""}
  onChange={(e) => handleEducationChange(eduIndex, "minor", e.target.value)}
  placeholder="Minor (optional)"
  className="px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
/>
<input
  type="text"
  value={(edu.relevant_courses ?? []).join(", ")}
  onChange={(e) =>
    handleEducationChange(
      eduIndex,
      "relevant_courses",
      e.target.value.split(",").map((c) => c.trim()).filter(Boolean)
    )
  }
  placeholder="Relevant Courses (comma-separated)"
  className="col-span-2 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
/>
```

#### Projects Section (after line 538)

Add `start_date` and `end_date` fields:

```tsx
<div className="flex gap-3">
  <input
    type="text"
    value={proj.start_date ?? ""}
    onChange={(e) => handleProjectsChange(projIndex, "start_date", e.target.value)}
    placeholder="Start Date"
    className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
  />
  <input
    type="text"
    value={proj.end_date ?? ""}
    onChange={(e) => handleProjectsChange(projIndex, "end_date", e.target.value)}
    placeholder="End Date"
    className="flex-1 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
  />
</div>
```

---

### Step 3: Frontend - Add 10 New Section Editors (Phase 3.2-3.11)

**File:** `/frontend/src/components/editor/ContentEditor.tsx`

#### Section Labels (add to SECTION_LABELS object ~line 14)

```tsx
const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  // Add these:
  languages: "Languages",
  volunteer: "Volunteer Experience",
  publications: "Publications",
  awards: "Awards & Honors",
  interests: "Interests",
  references: "References",
  courses: "Courses & Training",
  memberships: "Professional Memberships",
  leadership: "Leadership Experience",
};
```

#### Implementation Priority

| Priority | Section | Pattern | Key Fields |
| -------- | ------- | ------- | ---------- |
| 1 | languages | Entry + select | language, proficiency (native/fluent/advanced/intermediate/basic) |
| 2 | volunteer | Entry + bullets | role, organization, location, start_date, end_date, bullets |
| 3 | awards | Entry | title, issuer, date, description |
| 4 | publications | Entry + select | title, publicationType, publisher, date, url, authors |
| 5 | leadership | Entry + bullets | title, organization, location, start_date, end_date, bullets |
| 6 | courses | Entry | name, provider, date, credentialUrl, description |
| 7 | memberships | Entry | organization, role, start_date, end_date, current |
| 8 | references | Entry | name, title, company, email, phone, relationship |
| 9 | interests | Text | Single textarea (like summary) |

---

### Step 4: Update Supporting Files

**1. Verify page default section order:**

File: `/frontend/src/app/(protected)/tailor/verify/[id]/page.tsx`

```tsx
const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
  "certifications",
  "volunteer",
  "leadership",
  "publications",
  "awards",
  "languages",
  "memberships",
  "courses",
  "interests",
  "references",
];
```

**2. Section reorder panel:**

File: `/frontend/src/components/editor/SectionReorderPanel.tsx`

Add labels and icons for all new sections.

---

## Critical Files

| File | Changes |
| ---- | ------- |
| `/frontend/src/components/editor/ContentEditor.tsx` | Add 10 section editors, add missing fields |
| `/backend/app/models/mongo/resume.py` | Fix LeadershipEntry.role -> title |
| `/backend/app/schemas/tailor.py` | Fix LeadershipEntrySchema.role -> title |
| `/frontend/src/app/(protected)/tailor/verify/[id]/page.tsx` | Update DEFAULT_SECTION_ORDER |
| `/frontend/src/components/editor/SectionReorderPanel.tsx` | Add section labels |

---

## Type References

**Frontend entry types** (from `/frontend/src/lib/resume/types.ts`):

| Type | Fields |
| ---- | ------ |
| LanguageEntry | id, language, proficiency |
| VolunteerEntry | id, role, organization, location?, startDate, endDate?, current?, description?, bullets[]? |
| PublicationEntry | id, title, publicationType, publisher?, date?, url?, authors?, description? |
| AwardEntry | id, title, issuer, date?, description? |
| ReferenceEntry | id, name, title, company, email?, phone?, relationship? |
| CourseEntry | id, name, provider, date?, credentialUrl?, description? |
| MembershipEntry | id, organization, role?, startDate?, endDate?, current? |
| LeadershipEntry | id, title, organization, location?, startDate?, endDate?, current?, description?, bullets[]? |

---

## Verification

### Manual Testing Checklist

- [ ] Leadership field uses `title` consistently (backend + frontend)
- [ ] Education shows minor and relevant_courses fields
- [ ] Projects shows start_date and end_date fields
- [ ] Languages editor with proficiency dropdown works
- [ ] Volunteer editor with bullets works
- [ ] Awards editor works
- [ ] Publications editor with type dropdown works
- [ ] Leadership editor with bullets works
- [ ] Courses editor works
- [ ] Memberships editor works
- [ ] References editor works
- [ ] Interests as text field works
- [ ] Section reorder panel shows all sections
- [ ] Save button appears when changes are made
- [ ] Changes persist after save and page reload

### End-to-End Test

1. Create/upload a resume with all 16 section types populated
2. Navigate to `/tailor/verify/[id]`
3. Edit at least one field in each section
4. Save changes
5. Refresh page and verify all changes persisted
6. Check that leadership entries display with `title` field

---

## Scope Estimate

| Area | Files | Lines |
| ---- | ----- | ----- |
| Backend | 2 | ~30 |
| Frontend (ContentEditor) | 1 | ~400 |
| Frontend (supporting) | 3 | ~50 each |

---

## Design Decision: Monolithic vs Component Extraction

**Decision:** Keep monolithic ContentEditor pattern.

**Rationale:**

- Consistent with existing 6 sections already implemented
- Faster to implement (no refactor overhead)
- Single file to maintain for verify step editing
- Future refactor can extract to `/components/editor/sections/*.tsx` if needed
