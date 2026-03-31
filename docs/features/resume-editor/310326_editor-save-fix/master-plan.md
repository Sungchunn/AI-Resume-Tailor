# Editor Save Fix

## Problem Statement

Both editors need to save content correctly:

1. Library Resume Editor: `/library/resumes/[id]/edit`
2. Tailor Editor: `/tailor/editor/[id]`

## Issues Found

### Issue 1: Leadership Section Completely Missing from Core Transforms

**Location:** `/frontend/src/lib/resume/transforms.ts`

The `leadership` section is missing from BOTH core transform functions:

- `parsedContentToBlocks()` - does NOT handle leadership (cannot load)
- `blocksToParsedContent()` - does NOT handle leadership (cannot save)

**Impact:** Leadership sections cannot be saved or loaded in EITHER editor.

### Issue 2: Missing Section Mappings in Tailor Flow Transformations

**Location:** `/frontend/src/lib/resume/transforms.ts`

The `tailoredContentToParsedContent()` (lines 851-928) and `parsedContentToTailoredContent()` (lines 934-991) functions only handle **7 section types**, but `TailoredContent` supports **14 sections**.

**Currently mapped (7):**

- contact, summary, experience, education, skills, certifications, projects

**Missing (9):**

- languages
- volunteer (has bullets!)
- publications
- awards
- interests
- references
- courses
- memberships
- leadership (has bullets!)

**Impact:** When saving/loading tailored resumes, these sections will be lost.

### Issue 3: Missing Sections in blocksToContent.ts

**Location:** `/frontend/src/lib/tailoring/blocksToContent.ts`

The `blocksToContent()` function only handles 7 block types, missing the same sections above. This affects the preview rendering in the tailor flow.

### Issue 4: Education relevant_courses Data Loss

The `TailoredContent.education` type does NOT have a `relevant_courses` field (see types.ts lines 183-191), but `ParsedResumeContent.education` does. This means education relevant courses will be lost in the tailor flow.

**Note:** This is a known limitation due to API schema - would require backend changes to fix.

### Issue 5: BulletItem Conversion (Verified Correct)

The BulletItem handling is correct for sections that ARE mapped:

- `stringsToBullets()` converts `string[]` to `BulletItem[]` (load)
- `bulletsToStrings()` converts `BulletItem[]` to `string[]` (save)

## Implementation Plan

### Phase 0: Add Leadership to Core Transforms (CRITICAL - Affects Both Editors)

**Add to `parsedContentToBlocks()` (after memberships block, ~line 327):**

```typescript
// Leadership block
if (parsedContent.leadership && parsedContent.leadership.length > 0) {
  const entries: LeadershipEntry[] = parsedContent.leadership.map((lead) => ({
    id: nanoid(),
    title: lead.title || "",
    organization: lead.organization || "",
    location: lead.location,
    startDate: lead.start_date || "",
    endDate: lead.end_date || "",
    description: lead.description,
    bullets: stringsToBullets(lead.bullets),
  }));

  blocks.push({
    id: nanoid(),
    type: "leadership",
    order: order++,
    content: entries,
  } as LeadershipBlock);
}
```

**Add to `blocksToParsedContent()` (after memberships case, ~line 510):**

```typescript
case "leadership": {
  const entries = block.content as LeadershipEntry[];
  result.leadership = entries.map((entry) => ({
    title: entry.title,
    organization: entry.organization,
    location: entry.location,
    start_date: entry.startDate,
    end_date: entry.endDate,
    description: entry.description,
    bullets: bulletsToStrings(entry.bullets),
  }));
  break;
}
```

**Add to `blocksToText()` (after memberships case, ~line 840):**

```typescript
case "leadership": {
  const entries = block.content as LeadershipEntry[];
  for (const entry of entries) {
    if (entry.title) lines.push(entry.title);
    if (entry.organization) lines.push(entry.organization);
    if (entry.description) lines.push(entry.description);
    if (entry.bullets) lines.push(...entry.bullets.map((b) => b.text));
  }
  break;
}
```

### Phase 1: Update transforms.ts - tailoredContentToParsedContent()

Add mappings for missing sections that convert TailoredContent to ParsedResumeContent:

```typescript
// Languages
if (tailored.languages && tailored.languages.length > 0) {
  result.languages = tailored.languages.map((lang) => ({
    language: lang.language,
    proficiency: lang.proficiency,
  }));
}

// Volunteer (has bullets)
if (tailored.volunteer && tailored.volunteer.length > 0) {
  result.volunteer = tailored.volunteer.map((vol) => ({
    role: vol.role,
    organization: vol.organization,
    location: vol.location,
    start_date: vol.start_date,
    end_date: vol.end_date,
    description: vol.description,
    bullets: vol.bullets, // string[] from API
  }));
}

// Publications
if (tailored.publications && tailored.publications.length > 0) {
  result.publications = tailored.publications.map((pub) => ({
    title: pub.title,
    publication_type: pub.publication_type,
    publisher: pub.publisher,
    date: pub.date,
    url: pub.url,
    authors: pub.authors,
    description: pub.description,
  }));
}

// Awards
if (tailored.awards && tailored.awards.length > 0) {
  result.awards = tailored.awards.map((award) => ({
    title: award.title,
    issuer: award.issuer,
    date: award.date,
    description: award.description,
  }));
}

// Interests
if (tailored.interests) {
  result.interests = tailored.interests;
}

// References
if (tailored.references && tailored.references.length > 0) {
  result.references = tailored.references.map((ref) => ({
    name: ref.name,
    title: ref.title,
    company: ref.company,
    email: ref.email,
    phone: ref.phone,
    relationship: ref.relationship,
  }));
}

// Courses
if (tailored.courses && tailored.courses.length > 0) {
  result.courses = tailored.courses.map((course) => ({
    name: course.name,
    provider: course.provider,
    date: course.date,
    credential_url: course.credential_url,
    description: course.description,
  }));
}

// Memberships
if (tailored.memberships && tailored.memberships.length > 0) {
  result.memberships = tailored.memberships.map((mem) => ({
    organization: mem.organization,
    role: mem.role,
    start_date: mem.start_date,
    end_date: mem.end_date,
  }));
}

// Leadership (has bullets)
if (tailored.leadership && tailored.leadership.length > 0) {
  result.leadership = tailored.leadership.map((lead) => ({
    title: lead.title,
    organization: lead.organization,
    location: lead.location,
    start_date: lead.start_date,
    end_date: lead.end_date,
    description: lead.description,
    bullets: lead.bullets, // string[] from API
  }));
}
```

### Phase 2: Update transforms.ts - parsedContentToTailoredContent()

Add reverse mappings for missing sections (ParsedResumeContent to TailoredContent):

```typescript
languages: (parsed.languages || []).map((lang) => ({
  language: lang.language || "",
  proficiency: lang.proficiency || "",
})),
volunteer: (parsed.volunteer || []).map((vol) => ({
  role: vol.role || "",
  organization: vol.organization || "",
  location: vol.location,
  start_date: vol.start_date || "",
  end_date: vol.end_date,
  description: vol.description,
  bullets: vol.bullets,
})),
publications: (parsed.publications || []).map((pub) => ({
  title: pub.title || "",
  publication_type: pub.publication_type,
  publisher: pub.publisher,
  date: pub.date,
  url: pub.url,
  authors: pub.authors,
  description: pub.description,
})),
awards: (parsed.awards || []).map((award) => ({
  title: award.title || "",
  issuer: award.issuer || "",
  date: award.date,
  description: award.description,
})),
interests: parsed.interests || "",
references: (parsed.references || []).map((ref) => ({
  name: ref.name || "",
  title: ref.title || "",
  company: ref.company || "",
  email: ref.email,
  phone: ref.phone,
  relationship: ref.relationship,
})),
courses: (parsed.courses || []).map((course) => ({
  name: course.name || "",
  provider: course.provider || "",
  date: course.date,
  credential_url: course.credential_url,
  description: course.description,
})),
memberships: (parsed.memberships || []).map((mem) => ({
  organization: mem.organization || "",
  role: mem.role,
  start_date: mem.start_date,
  end_date: mem.end_date,
})),
leadership: (parsed.leadership || []).map((lead) => ({
  title: lead.title || "",
  organization: lead.organization || "",
  location: lead.location,
  start_date: lead.start_date,
  end_date: lead.end_date,
  description: lead.description,
  bullets: lead.bullets,
})),
```

### Phase 3: Update blocksToContent.ts

Add handling for additional block types in the preview renderer:

```typescript
case "volunteer":
  content.volunteer = ((block as VolunteerBlock).content || []).map(
    (vol) => ({
      role: vol.role || "",
      organization: vol.organization || "",
      location: vol.location,
      start_date: vol.startDate || "",
      end_date: vol.endDate,
      description: vol.description,
      bullets: bulletsToStrings(vol.bullets),
    })
  );
  break;

case "languages":
  content.languages = ((block as LanguagesBlock).content || []).map(
    (lang) => ({
      language: lang.language || "",
      proficiency: lang.proficiency || "",
    })
  );
  break;

// Similar for: publications, awards, interests, references, courses, memberships, leadership
```

## Files to Modify

| File | Changes |
| ---- | ------- |
| `frontend/src/lib/resume/transforms.ts` | Add leadership to core transforms + add 9 missing sections to tailor transforms |
| `frontend/src/lib/tailoring/blocksToContent.ts` | Add 9 missing block type handlers |

**Note:** `LeadershipBlock` and `LeadershipEntry` types already exist in types.ts - no type changes needed.

## Section Coverage Summary

After this fix, the following sections will be fully supported in both editors:

| Section | Library Editor | Tailor Editor | Has Bullets |
| ------- | -------------- | ------------- | ----------- |
| contact | Yes | Yes | No |
| summary | Yes | Yes | No |
| experience | Yes | Yes | Yes |
| education | Yes | Yes (no relevant_courses) | No |
| skills | Yes | Yes | No |
| certifications | Yes | Yes | No |
| projects | Yes | Yes | Yes |
| languages | Yes | **Fix needed** | No |
| volunteer | Yes | **Fix needed** | Yes |
| publications | Yes | **Fix needed** | No |
| awards | Yes | **Fix needed** | No |
| interests | Yes | **Fix needed** | No |
| references | Yes | **Fix needed** | No |
| courses | Yes | **Fix needed** | No |
| memberships | Yes | **Fix needed** | No |
| leadership | **Fix needed (Phase 0)** | **Fix needed** | Yes |

## Verification

1. **Manual Testing:**
   - Open tailor editor with a resume containing volunteer/leadership sections
   - Make edits to these sections
   - Save and verify data persists on page refresh
   - Check browser DevTools Network tab to verify correct data is sent to API

2. **Round-Trip Test:**
   - Load a tailored resume with all section types
   - Edit each section
   - Save
   - Refresh page
   - Verify all sections retain their edits

3. **Library Editor:**
   - Verify library editor still saves correctly (no changes needed there, but verify no regression)

## Known Limitations

- **Education relevant_courses:** Will be lost in tailor flow due to TailoredContent schema not supporting this field. Requires backend API changes to fix.
