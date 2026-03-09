# Dynamic Resume Sections Implementation Plan

## Summary

Enable flexible resume sections in the Workshop/Tailor interface by:

1. Expanding `TailoredContent` to include all 16 predefined section types (adding "leadership")
2. Creating a section registry for centralized configuration
3. Reusing Library block editors via an adapter pattern
4. Adding support for custom section naming AND fully custom user-created sections
5. Ensuring the parser extracts all section types from uploaded resumes

## Current State

**Already implemented (types exist, full editors in Library):**

- 15 section types defined in `/frontend/src/lib/resume/types.ts`
- All entry interfaces defined (ProjectEntry, VolunteerEntry, AwardEntry, etc.)
- Library editors exist for all types in `/frontend/src/components/library/editor/blocks/`
- Backend parser prompt can extract these sections

**Gap (Workshop only supports ~5 sections):**

- `TailoredContent` in `types.ts` only has 7 fields (contact, summary, experience, education, skills, certifications, projects)
- `SectionList.tsx` only renders 4 working editors (summary, experience, skills, highlights)
- `PreviewSection.tsx` only renders summary, experience, skills
- Other sections show "coming soon" stub

## Implementation Phases

### Phase 1: Expand TailoredContent Type

**File:** `/frontend/src/lib/api/types.ts`

Add missing section types to `TailoredContent` (lines 127-171):

```typescript
export interface TailoredContent {
  // Existing...
  contact?: {...};
  summary?: string;
  experience?: Array<{...}>;
  education?: Array<{...}>;
  skills?: string[];
  certifications?: Array<{...}>;
  projects?: Array<{...}>;

  // ADD these:
  languages?: Array<{
    id?: string;
    language: string;
    proficiency: string;
  }>;
  volunteer?: Array<{
    id?: string;
    role: string;
    organization: string;
    location?: string;
    start_date: string;
    end_date?: string;
    description?: string;
    bullets?: string[];
  }>;
  publications?: Array<{
    id?: string;
    title: string;
    publication_type?: string;
    publisher?: string;
    date?: string;
    url?: string;
    authors?: string;
  }>;
  awards?: Array<{
    id?: string;
    title: string;
    issuer: string;
    date?: string;
    description?: string;
  }>;
  interests?: string;
  references?: Array<{...}>;
  courses?: Array<{...}>;
  memberships?: Array<{...}>;

  // NEW: Leadership/Extracurriculars (separate from memberships)
  leadership?: Array<{
    id?: string;
    title: string;
    organization: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    bullets?: string[];
  }>;

  // Custom section support
  section_labels?: Record<string, string>;  // User-defined section names

  // Full custom sections (user-created)
  custom_sections?: Record<string, CustomSection>;
}

// Custom section can be free-text or entry-based
export interface CustomSection {
  label: string;
  type: 'text' | 'entries';
  content: string | CustomEntry[];
}

export interface CustomEntry {
  id: string;
  title?: string;
  subtitle?: string;
  date?: string;
  description?: string;
  bullets?: string[];
}
```

### Phase 2: Create Section Registry

**New file:** `/frontend/src/lib/sections/sectionRegistry.ts`

Centralize section configuration to eliminate hardcoded mappings:

```typescript
export interface SectionDefinition {
  key: string;
  defaultLabel: string;
  category: 'core' | 'professional' | 'additional';
  icon: string;
  getCount: (content: TailoredContent) => number | null;
  isEmpty: (content: TailoredContent) => boolean;
}

export const SECTION_REGISTRY: Record<string, SectionDefinition> = {
  summary: { key: 'summary', defaultLabel: 'Professional Summary', category: 'core', ... },
  experience: { key: 'experience', defaultLabel: 'Work Experience', category: 'core', ... },
  education: { key: 'education', defaultLabel: 'Education', category: 'core', ... },
  skills: { key: 'skills', defaultLabel: 'Skills', category: 'core', ... },
  projects: { key: 'projects', defaultLabel: 'Projects', category: 'professional', ... },
  certifications: { key: 'certifications', defaultLabel: 'Certifications', category: 'professional', ... },
  volunteer: { key: 'volunteer', defaultLabel: 'Volunteer Experience', category: 'professional', ... },
  publications: { key: 'publications', defaultLabel: 'Publications', category: 'professional', ... },
  awards: { key: 'awards', defaultLabel: 'Awards & Honors', category: 'professional', ... },
  languages: { key: 'languages', defaultLabel: 'Languages', category: 'additional', ... },
  interests: { key: 'interests', defaultLabel: 'Interests', category: 'additional', ... },
  memberships: { key: 'memberships', defaultLabel: 'Memberships', category: 'additional', ... },
  leadership: { key: 'leadership', defaultLabel: 'Leadership & Extracurriculars', category: 'professional', ... },
  references: { key: 'references', defaultLabel: 'References', category: 'additional', ... },
  courses: { key: 'courses', defaultLabel: 'Courses', category: 'additional', ... },
};

// Custom sections are stored in content.custom_sections and rendered dynamically

export function getSectionLabel(key: string, customLabels?: Record<string, string>): string;
export function getSectionsByCategory(category: string): SectionDefinition[];
```

### Phase 3: Update SectionList.tsx

**File:** `/frontend/src/components/workshop/panels/SectionList.tsx`

1. Replace hardcoded `SECTION_LABELS` with registry lookup
2. Update `getSectionCount()` to use registry
3. Replace `renderSectionEditor()` switch with adapter pattern

```typescript
// Before (hardcoded)
const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  // ...only 8 entries
};

// After (registry-based)
import { SECTION_REGISTRY, getSectionLabel } from "@/lib/sections/sectionRegistry";

const label = getSectionLabel(section, content.section_labels);
```

### Phase 4: Create Section Editor Adapter

**New file:** `/frontend/src/components/workshop/panels/sections/SectionEditorAdapter.tsx`

Bridge Library editors to Workshop's `TailoredContent` data model (snake_case <-> camelCase):

```typescript
export function SectionEditorAdapter({ section, content, onChange }) {
  // Keep Workshop's ExperienceEditor for AI suggestion features
  if (section === 'experience') {
    return <ExperienceEditor entries={content.experience ?? []} onChange={...} />;
  }

  // Reuse Library editors for other sections
  switch (section) {
    case 'projects':
      return <ProjectsEditor content={transformToProjectEntries(content.projects)} onChange={...} />;
    case 'volunteer':
      return <VolunteerEditor content={transformToVolunteerEntries(content.volunteer)} onChange={...} />;
    case 'awards':
      return <AwardsEditor content={transformToAwardEntries(content.awards)} onChange={...} />;
    case 'publications':
      return <PublicationsEditor content={...} onChange={...} />;
    case 'languages':
      return <LanguagesEditor content={...} onChange={...} />;
    case 'education':
      return <EducationEditor content={...} onChange={...} />;
    case 'certifications':
      return <CertificationsEditor content={...} onChange={...} />;
    case 'interests':
      return <InterestsEditor content={content.interests ?? ''} onChange={...} />;
    case 'memberships':
      return <MembershipsEditor content={...} onChange={...} />;
    // ... etc
  }
}

// Transform functions for snake_case <-> camelCase
function transformToProjectEntries(data: TailoredContent['projects']): ProjectEntry[] {...}
function transformFromProjectEntries(entries: ProjectEntry[]): TailoredContent['projects'] {...}
```

### Phase 5: Update AddSectionMenu.tsx

**File:** `/frontend/src/components/workshop/panels/AddSectionMenu.tsx`

Replace hardcoded `AVAILABLE_SECTIONS` with registry-driven categories:

```typescript
// Group by category for better UX
const SECTION_GROUPS = [
  { label: 'Core', sections: ['summary', 'experience', 'education', 'skills'] },
  { label: 'Professional', sections: ['projects', 'certifications', 'volunteer', 'publications', 'awards', 'leadership'] },
  { label: 'Additional', sections: ['languages', 'interests', 'memberships', 'courses', 'references'] },
];
```

### Phase 6: Update PreviewSection.tsx

**File:** `/frontend/src/components/workshop/ResumePreview/PreviewSection.tsx`

Add render cases for all section types:

```typescript
// Replace hardcoded SECTION_TITLES with registry lookup
const title = getSectionLabel(section, content.section_labels);

// Add render functions for new sections
function VolunteerSection({ items }) {...}
function ProjectsSection({ items }) {...}
function AwardsSection({ items }) {...}
function PublicationsSection({ items }) {...}
function LanguagesSection({ items }) {...}
function InterestsSection({ content }) {...}
function MembershipsSection({ items }) {...}
function LeadershipSection({ items }) {...}
```

### Phase 7: Update Page Break Estimation

**File:** `/frontend/src/components/workshop/ResumePreview/usePageBreaks.ts`

Add height estimations for all section types:

```typescript
const estimatedHeights: Record<string, number> = {
  // ... existing
  volunteer: sectionHeaderHeight + (content.volunteer?.length ?? 0) * 70,
  awards: sectionHeaderHeight + (content.awards?.length ?? 0) * 40,
  publications: sectionHeaderHeight + (content.publications?.length ?? 0) * 50,
  languages: sectionHeaderHeight + Math.ceil((content.languages?.length ?? 0) / 3) * 30,
  interests: sectionHeaderHeight + 50,
  memberships: sectionHeaderHeight + (content.memberships?.length ?? 0) * 35,
  leadership: sectionHeaderHeight + (content.leadership?.length ?? 0) * 70,
};
```

### Phase 8: Section Rename Feature

**New file:** `/frontend/src/components/workshop/panels/RenameSectionModal.tsx`

Allow users to customize section labels:

```typescript
// Store in content.section_labels
onContentChange({
  ...content,
  section_labels: {
    ...content.section_labels,
    [sectionKey]: newLabel,
  },
});
```

Add rename button to `SectionItem.tsx` context menu.

### Phase 9: Custom Section Editor & Creation

**New file:** `/frontend/src/components/workshop/panels/sections/CustomSectionEditor.tsx`

Allow users to create and edit fully custom sections:

```typescript
interface CustomSectionEditorProps {
  sectionKey: string;
  section: CustomSection;
  onChange: (section: CustomSection) => void;
}

export function CustomSectionEditor({ sectionKey, section, onChange }) {
  const isEntryMode = section.type === 'entries';

  return (
    <div className="space-y-4">
      {/* Toggle between text and entry mode */}
      <div className="flex gap-2">
        <button onClick={() => onChange({ ...section, type: 'text', content: '' })}>
          Free Text
        </button>
        <button onClick={() => onChange({ ...section, type: 'entries', content: [] })}>
          Entries
        </button>
      </div>

      {isEntryMode ? (
        <GenericEntryList
          entries={section.content as CustomEntry[]}
          onChange={(entries) => onChange({ ...section, content: entries })}
        />
      ) : (
        <FormTextarea
          value={section.content as string}
          onChange={(e) => onChange({ ...section, content: e.target.value })}
        />
      )}
    </div>
  );
}
```

**New file:** `/frontend/src/components/workshop/panels/CreateSectionModal.tsx`

Modal for creating new custom sections:

```typescript
export function CreateSectionModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'entries'>('entries');

  const handleCreate = () => {
    const key = `custom_${nanoid(8)}`;
    onCreate(key, { label: name, type, content: type === 'text' ? '' : [] });
    onClose();
  };

  return (
    <Dialog>
      <input placeholder="Section name..." value={name} onChange={...} />
      <select value={type} onChange={...}>
        <option value="entries">Entries (with title, date, bullets)</option>
        <option value="text">Free-form text</option>
      </select>
      <button onClick={handleCreate}>Create Section</button>
    </Dialog>
  );
}
```

Update `AddSectionMenu.tsx` to include "Create Custom Section" option at the bottom.

### Phase 10: Backend Parser Enhancement (Optional)

**File:** `/backend/app/services/resume/parser.py`

The parser already extracts most sections. Verify prompt includes all 16 types (including leadership) and update `ParsedResume` TypedDict if needed.

## Files to Modify

| File | Changes |
| ---- | ------- |
| `/frontend/src/lib/api/types.ts` | Expand TailoredContent with all section types + custom sections |
| `/frontend/src/lib/resume/types.ts` | Add LeadershipEntry interface, add "leadership" to ResumeBlockType |
| `/frontend/src/lib/sections/sectionRegistry.ts` (NEW) | Centralized section definitions |
| `/frontend/src/components/workshop/panels/SectionList.tsx` | Use registry, dispatch to adapter |
| `/frontend/src/components/workshop/panels/sections/SectionEditorAdapter.tsx` (NEW) | Bridge to Library editors |
| `/frontend/src/components/workshop/panels/sections/CustomSectionEditor.tsx` (NEW) | Generic custom section editor |
| `/frontend/src/components/workshop/panels/AddSectionMenu.tsx` | Use registry categories, add "Create Custom" |
| `/frontend/src/components/workshop/panels/CreateSectionModal.tsx` (NEW) | Custom section creation UI |
| `/frontend/src/components/workshop/ResumePreview/PreviewSection.tsx` | Add all section renderers |
| `/frontend/src/components/workshop/ResumePreview/usePageBreaks.ts` | Add height estimations |
| `/frontend/src/components/workshop/panels/SectionItem.tsx` | Add rename option to menu |
| `/frontend/src/components/workshop/panels/RenameSectionModal.tsx` (NEW) | Section rename UI |
| `/frontend/src/components/library/editor/blocks/LeadershipEditor.tsx` (NEW) | Leadership section editor |

## Verification Plan

1. **Unit tests:** Section registry functions, transform functions
2. **Manual testing:**
   - Add each predefined section type via AddSectionMenu
   - Edit content in each section editor
   - Verify preview renders correctly for all section types
   - Test section renaming (e.g., rename "Awards" to "Honors")
   - Create a custom section with entries, add content, verify preview
   - Create a custom section with free-text, verify preview
   - Parse a resume with all sections (including leadership/extracurriculars) and verify extraction
3. **Integration test:**
   - Full tailor flow with multi-section resume
   - Export to PDF with predefined + custom sections
   - Verify custom sections persist on page reload
