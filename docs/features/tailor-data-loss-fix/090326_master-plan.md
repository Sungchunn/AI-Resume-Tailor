# Fix Data Loss in Tailor Flow

## Problem Summary

Data is being dropped during the tailor flow because:

1. Frontend `TailoredContent` type only has 4 fields: `summary`, `experience`, `skills`, `highlights`
2. Backend generates full `ParsedContent` with 7 fields: `contact`, `summary`, `experience`, `education`, `skills`, `certifications`, `projects`
3. The verify page extracts only 4 fields and saves back, **overwriting** the complete data

**Lost data:** `contact`, `education`, `certifications`, `projects`

---

## Root Cause Analysis

### Type Mismatch

**Backend `ParsedContent`** (from `backend/app/models/mongo/resume.py:83-92`):

```python
class ParsedContent(BaseModel):
    contact: ContactInfo | None = None
    summary: str | None = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
```

**Frontend `TailoredContent`** (from `frontend/src/lib/api/types.ts:127-139`):

```typescript
export interface TailoredContent {
  summary: string;
  experience: Array<{...}>;
  skills: string[];
  highlights: string[];  // NOT in backend!
}
```

### Data Flow Where Loss Occurs

| Step | Location | Issue |
| ---- | -------- | ----- |
| 1 | `analyze/page.tsx:167` | Backend returns full `tailored_content` |
| 2 | `verify/[id]/page.tsx:43-56` | **Extracts only 4 fields** |
| 3 | `verify/[id]/page.tsx:79-84` | Saves truncated content back to DB |
| 4 | `editor/[id]/page.tsx:44-46` | Works with already-truncated data |

---

## Solution: Expand TailoredContent to Match Backend ParsedContent

### Phase 1: Update Type Definition

**File:** `frontend/src/lib/api/types.ts`

Update `TailoredContent` (lines 127-139) to match backend's `ParsedContent`:

```typescript
export interface TailoredContent {
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  experience?: Array<{
    id?: string;
    title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  education?: Array<{
    id?: string;
    degree: string;
    institution: string;
    location?: string;
    graduation_date?: string;
    gpa?: string;
    honors?: string[];
  }>;
  skills?: string[];
  certifications?: string[];
  projects?: Array<{
    id?: string;
    name: string;
    description?: string;
    technologies?: string[];
    url?: string;
  }>;
}
```

**Remove:** `highlights` field (doesn't exist in backend)

---

### Phase 2: Update Verify Page Initialization

**File:** `frontend/src/app/(protected)/tailor/verify/[id]/page.tsx`

**Change lines 43-56:** Preserve all fields instead of extracting subset

```typescript
// FROM:
const initialContent: TailoredContent = {
  summary: rawContent?.summary ?? "",
  experience: rawContent?.experience ?? [],
  skills: rawContent?.skills ?? [],
  highlights: rawContent?.highlights ?? [],
};

// TO:
const initialContent: TailoredContent = {
  contact: rawContent?.contact,
  summary: rawContent?.summary ?? "",
  experience: rawContent?.experience ?? [],
  education: rawContent?.education ?? [],
  skills: rawContent?.skills ?? [],
  certifications: rawContent?.certifications ?? [],
  projects: rawContent?.projects ?? [],
};
```

**Update DEFAULT_SECTION_ORDER** (line 23-28):

```typescript
const DEFAULT_SECTION_ORDER = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
];
```

---

### Phase 3: Update ContentEditor Component

**File:** `frontend/src/components/editor/ContentEditor.tsx`

1. **Update local variable extraction (lines 36-40):**

```typescript
const summary = content.summary ?? "";
const experience = content.experience ?? [];
const education = content.education ?? [];
const skills = content.skills ?? [];
const certifications = content.certifications ?? [];
const projects = content.projects ?? [];
```

2. **Update SECTION_LABELS (lines 14-21):**

```typescript
const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
};
```

3. **Add handlers and render cases for education, certifications, projects:**
   - `handleEducationChange` - similar pattern to experience
   - `handleCertificationsChange` - similar pattern to skills (string array)
   - `handleProjectsChange` - similar pattern to experience

4. **Remove highlights handling entirely**

---

### Phase 4: Update Transform Functions

**File:** `frontend/src/lib/resume/transforms.ts`

Update `tailoredContentToParsedContent()` (lines 837-875) to handle all fields:

```typescript
export function tailoredContentToParsedContent(
  tailored: TailoredContent | null | undefined
): ParsedResumeContent {
  if (!tailored) return {};

  return {
    contact: tailored.contact ? {
      name: tailored.contact.name,
      email: tailored.contact.email,
      phone: tailored.contact.phone,
      location: tailored.contact.location,
      linkedin: tailored.contact.linkedin,
      github: tailored.contact.github,
      website: tailored.contact.website,
    } : undefined,
    summary: tailored.summary,
    experience: tailored.experience?.map(exp => ({
      title: exp.title,
      company: exp.company,
      location: exp.location,
      start_date: exp.start_date,
      end_date: exp.end_date,
      bullets: exp.bullets,
    })),
    education: tailored.education?.map(edu => ({
      degree: edu.degree,
      institution: edu.institution,
      location: edu.location,
      graduation_date: edu.graduation_date,
      gpa: edu.gpa,
      honors: edu.honors,
    })),
    skills: tailored.skills,
    certifications: tailored.certifications?.map(c => ({ name: c, issuer: "" })),
    projects: tailored.projects?.map(p => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies,
      url: p.url,
    })),
  };
}
```

Update `parsedContentToTailoredContent()` (lines 881-909) similarly.

---

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/lib/api/types.ts` | Expand TailoredContent type |
| `frontend/src/app/(protected)/tailor/verify/[id]/page.tsx` | Preserve all fields |
| `frontend/src/components/editor/ContentEditor.tsx` | Add education, certifications, projects handlers |
| `frontend/src/lib/resume/transforms.ts` | Update both transform functions |

---

## Verification

1. **Test new tailoring flow:**
   - Go to `/tailor?job_listing_id=3255`
   - Select a resume with education/projects
   - Complete the flow through verify and editor
   - Verify education and projects appear in editor

2. **Test data persistence:**
   - Make an edit in verify page
   - Navigate to editor
   - Verify all sections still have data

3. **Test existing tailored resumes:**
   - Load an existing tailored resume
   - Verify it still works (backward compatible - missing fields will be undefined)

---

## Backward Compatibility

- Existing `tailored_data` documents in MongoDB will continue to work
- Missing fields (education, projects, etc.) will be `undefined` and display as empty sections
- No database migration required
