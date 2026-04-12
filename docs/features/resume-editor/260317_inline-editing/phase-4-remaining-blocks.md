# Phase 4: Remaining Blocks

## Overview

Convert the remaining 12 block types to support inline editing. Most follow similar patterns established in Phases 2-3.

---

## Prerequisites

- Phases 1-3 completed

---

## Block Categories

### Category A: Entry-Based Blocks (Similar to Experience)

These blocks have arrays of entries with text fields and optional bullet/note arrays:

| Block | Fields | Array Field |
| ----- | ------ | ----------- |
| Projects | title, description, url, technologies | bullets |
| Volunteer | organization, role, location, dateRange | bullets |
| Awards | title, issuer, date | description |
| Certifications | name, issuer, date, credentialId | - |
| Publications | title, publisher, date, url | - |
| Courses | name, institution, completionDate | - |
| Leadership | title, organization, dateRange | bullets |

### Category B: Simple List Blocks

These blocks have simple arrays without nested structure:

| Block | Array Field | Item Type |
| ----- | ----------- | --------- |
| Skills | categories[].skills | String array per category |
| Languages | languages | Array with name + proficiency |
| Interests | interests | String array |
| References | references | Array with name, title, company, contact |
| Memberships | memberships | Array with organization, role, dateRange |

---

## Category A Implementation

### ProjectsPreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/ProjectsPreview.tsx`

```typescript
export function ProjectsPreview({ content, style, blockId, onContentChange, ... }) {
  return (
    <div className="space-y-4">
      {content.map((entry, entryIndex) => {
        const entryId = `entry-${entryIndex}`;
        return (
          <div key={entryIndex}>
            <div className="flex justify-between">
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'title')}
                value={entry.title}
                className="font-semibold"
                onCommit={(v) => updateEntry(entryIndex, 'title', v)}
              />
              <EditableText
                elementId={createFieldElementId(blockId, entryId, 'url')}
                value={entry.url || ''}
                className="text-sm text-blue-600"
                placeholder="project-url.com"
                onCommit={(v) => updateEntry(entryIndex, 'url', v)}
              />
            </div>

            <EditableRichText
              elementId={createFieldElementId(blockId, entryId, 'description')}
              value={entry.description || ''}
              placeholder="Project description..."
              onCommit={(v) => updateEntry(entryIndex, 'description', v)}
            />

            {/* Technologies as inline tags */}
            <div className="flex flex-wrap gap-1 mt-1">
              {entry.technologies?.map((tech, techIndex) => (
                <EditableText
                  key={techIndex}
                  elementId={createIndexedElementId(blockId, entryId, 'technologies', techIndex)}
                  value={tech}
                  className="px-2 py-0.5 bg-zinc-100 rounded text-xs"
                  onCommit={(v) => updateTechnology(entryIndex, techIndex, v)}
                />
              ))}
            </div>

            {/* Bullets */}
            {entry.bullets && entry.bullets.length > 0 && (
              <ul className="list-disc ml-4 mt-2">
                {entry.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex}>
                    <EditableBullet
                      elementId={createIndexedElementId(blockId, entryId, 'bullets', bulletIndex)}
                      value={bullet}
                      onCommit={(v) => updateBullet(entryIndex, bulletIndex, v)}
                      onEnter={() => addBullet(entryIndex, bulletIndex)}
                      onBackspaceEmpty={() => removeBullet(entryIndex, bulletIndex)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### VolunteerPreview.tsx, LeadershipPreview.tsx

Same pattern as ExperiencePreview with slight field variations.

### AwardsPreview.tsx, CertificationsPreview.tsx, PublicationsPreview.tsx, CoursesPreview.tsx

Simpler entries without bullet arrays. Use EditableText for all fields.

---

## Category B Implementation

### SkillsPreview.tsx

**Path:** `frontend/src/components/library/preview/blocks/SkillsPreview.tsx`

Skills have a unique structure: categories with skill arrays.

```typescript
interface SkillsContent {
  categories: Array<{
    name: string;
    skills: string[];
  }>;
}

export function SkillsPreview({ content, style, blockId, onContentChange, ... }) {
  const updateCategoryName = (catIndex: number, value: string) => {
    const newCategories = content.categories.map((cat, i) =>
      i === catIndex ? { ...cat, name: value } : cat
    );
    onContentChange({ categories: newCategories });
  };

  const updateSkill = (catIndex: number, skillIndex: number, value: string) => {
    const newCategories = content.categories.map((cat, i) => {
      if (i !== catIndex) return cat;
      const newSkills = cat.skills.map((s, j) =>
        j === skillIndex ? value : s
      );
      return { ...cat, skills: newSkills };
    });
    onContentChange({ categories: newCategories });
  };

  return (
    <div className="space-y-2">
      {content.categories.map((category, catIndex) => (
        <div key={catIndex} className="flex items-start gap-2">
          <EditableText
            elementId={createFieldElementId(blockId, `cat-${catIndex}`, 'name')}
            value={category.name}
            className="font-semibold min-w-20"
            onCommit={(v) => updateCategoryName(catIndex, v)}
          />
          <span>:</span>
          <div className="flex flex-wrap gap-1">
            {category.skills.map((skill, skillIndex) => (
              <EditableSkill
                key={skillIndex}
                elementId={createIndexedElementId(blockId, `cat-${catIndex}`, 'skills', skillIndex)}
                value={skill}
                onCommit={(v) => updateSkill(catIndex, skillIndex, v)}
                onCommaOrEnter={() => addSkill(catIndex, skillIndex)}
                onBackspaceEmpty={() => removeSkill(catIndex, skillIndex)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### EditableSkill Component

**Path:** `frontend/src/components/library/editor/inline/EditableSkill.tsx`

Special handling for skills: comma or Enter adds new skill.

```typescript
interface EditableSkillProps {
  elementId: string;
  value: string;
  onCommit: (value: string) => void;
  onCommaOrEnter: () => void;
  onBackspaceEmpty: () => void;
}

export function EditableSkill({
  elementId,
  value,
  onCommit,
  onCommaOrEnter,
  onBackspaceEmpty,
}: EditableSkillProps) {
  const { editingElementId, editor } = useInlineEdit();
  const isCurrentlyEditing = editingElementId === elementId;

  useEffect(() => {
    if (!isCurrentlyEditing || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ',' || event.key === 'Enter') {
        event.preventDefault();
        const text = editor.getText().replace(/,\s*$/, '').trim();
        if (text) {
          onCommit(text);
          onCommaOrEnter();
        }
      }

      if (event.key === 'Backspace' && editor.getText() === '') {
        event.preventDefault();
        onBackspaceEmpty();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentlyEditing, editor, onCommit, onCommaOrEnter, onBackspaceEmpty]);

  return (
    <EditableText
      elementId={elementId}
      value={value}
      className="px-2 py-0.5 bg-zinc-100 rounded text-sm"
      placeholder="Skill"
      onCommit={onCommit}
    />
  );
}
```

### LanguagesPreview.tsx

```typescript
interface LanguageEntry {
  name: string;
  proficiency: string; // e.g., "Native", "Fluent", "Intermediate"
}

export function LanguagesPreview({ content, style, blockId, onContentChange, ... }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {content.map((lang, index) => (
        <div key={index} className="flex items-center gap-1">
          <EditableText
            elementId={createIndexedElementId(blockId, undefined, 'name', index)}
            value={lang.name}
            className="font-medium"
            onCommit={(v) => updateLanguage(index, 'name', v)}
          />
          <span className="text-muted-foreground">(</span>
          <EditableText
            elementId={createIndexedElementId(blockId, undefined, 'proficiency', index)}
            value={lang.proficiency}
            className="text-muted-foreground"
            onCommit={(v) => updateLanguage(index, 'proficiency', v)}
          />
          <span className="text-muted-foreground">)</span>
        </div>
      ))}
    </div>
  );
}
```

### InterestsPreview.tsx

Simple comma-separated list.

```typescript
export function InterestsPreview({ content, style, blockId, onContentChange, ... }) {
  // content is string[]
  return (
    <div className="flex flex-wrap gap-2">
      {content.map((interest, index) => (
        <EditableText
          key={index}
          elementId={createIndexedElementId(blockId, undefined, 'interests', index)}
          value={interest}
          className="text-sm"
          onCommit={(v) => updateInterest(index, v)}
        />
      ))}
    </div>
  );
}
```

### ReferencesPreview.tsx

```typescript
interface ReferenceEntry {
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
}

export function ReferencesPreview({ content, style, blockId, onContentChange, ... }) {
  return (
    <div className="space-y-3">
      {content.map((ref, index) => (
        <div key={index}>
          <EditableText
            elementId={createFieldElementId(blockId, `ref-${index}`, 'name')}
            value={ref.name}
            className="font-semibold"
            onCommit={(v) => updateRef(index, 'name', v)}
          />
          <div className="text-sm">
            <EditableText
              elementId={createFieldElementId(blockId, `ref-${index}`, 'title')}
              value={ref.title}
              onCommit={(v) => updateRef(index, 'title', v)}
            />
            {' at '}
            <EditableText
              elementId={createFieldElementId(blockId, `ref-${index}`, 'company')}
              value={ref.company}
              onCommit={(v) => updateRef(index, 'company', v)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {ref.email && (
              <EditableText
                elementId={createFieldElementId(blockId, `ref-${index}`, 'email')}
                value={ref.email}
                onCommit={(v) => updateRef(index, 'email', v)}
              />
            )}
            {ref.phone && (
              <EditableText
                elementId={createFieldElementId(blockId, `ref-${index}`, 'phone')}
                value={ref.phone}
                onCommit={(v) => updateRef(index, 'phone', v)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### MembershipsPreview.tsx

Simple entry-based, similar to simpler Category A blocks.

---

## Implementation Order

1. **Projects** - Has bullets, technologies array, description
2. **Skills** - Unique category structure, needs EditableSkill
3. **Languages** - Simple but unique structure
4. **Volunteer** - Same as Experience
5. **Awards** - Simple entries
6. **Certifications** - Simple entries
7. **Publications** - Simple entries
8. **Courses** - Simple entries
9. **Leadership** - Same as Experience
10. **Interests** - Simple array
11. **References** - Contact-like entries
12. **Memberships** - Simple entries

---

## Verification

### Quick Smoke Test Per Block

For each block, verify:

- [ ] All text fields clickable and editable
- [ ] Changes persist on blur
- [ ] Escape cancels
- [ ] Tab navigates in order
- [ ] Array fields have Enter/Backspace behavior where applicable

### E2E Test File

**Path:** `frontend/e2e/inline-editing/remaining-blocks.spec.ts`

```typescript
const BLOCKS_TO_TEST = [
  'projects', 'skills', 'languages', 'volunteer',
  'awards', 'certifications', 'publications', 'courses',
  'leadership', 'interests', 'references', 'memberships'
];

for (const blockType of BLOCKS_TO_TEST) {
  test.describe(`${blockType} Block Inline Editing`, () => {
    test(`can edit ${blockType} fields`, async ({ page }) => {
      // Add block via UI
      // Edit first field
      // Verify save
    });
  });
}
```
