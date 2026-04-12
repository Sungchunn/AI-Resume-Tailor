# Phase 4: Skills Suggestions UI

**Goal:** Create the skills suggestions panel that shows missing skills from ATS keyword gaps and allows one-click addition.

---

## 4.1 Create SkillSuggestionsPanel

**File:** `frontend/src/components/tailor/editor/SkillSuggestionsPanel.tsx`

### Interface

```typescript
interface SkillSuggestionsPanelProps {
  // No props needed - gets data from context
}
```

### Implementation

```typescript
import { useMemo } from "react";
import { Plus, Check, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTailorEditorContext, useATSReadiness } from "./TailorEditorContext";
import { useBlockEditor } from "@/components/library/editor/BlockEditorContext";
import { toast } from "sonner";

const importanceStyles = {
  required: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  strongly_preferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  preferred: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  nice_to_have: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const importanceLabels = {
  required: "Required",
  strongly_preferred: "Strongly Preferred",
  preferred: "Preferred",
  nice_to_have: "Nice to Have",
};

export function SkillSuggestionsPanel() {
  const { atsContext } = useTailorEditorContext();
  const { isReady } = useATSReadiness();
  const { blocks, updateBlock, save } = useBlockEditor();

  // Get current skills from resume
  const currentSkills = useMemo(() => {
    const skillsBlock = blocks.find((b) => b.type === "skills");
    if (!skillsBlock?.content?.groups) return new Set<string>();

    const allSkills = new Set<string>();
    for (const group of skillsBlock.content.groups) {
      for (const skill of group.skills || []) {
        allSkills.add(skill.toLowerCase());
      }
    }
    return allSkills;
  }, [blocks]);

  // Filter gaps to only skills not already in resume
  const missingSkills = useMemo(() => {
    if (!atsContext?.keywordGaps) return [];

    return atsContext.keywordGaps.filter(
      (gap) => !currentSkills.has(gap.keyword.toLowerCase())
    );
  }, [atsContext, currentSkills]);

  // Group by importance
  const groupedSkills = useMemo(() => {
    const groups: Record<string, typeof missingSkills> = {
      required: [],
      strongly_preferred: [],
      preferred: [],
      nice_to_have: [],
    };

    for (const skill of missingSkills) {
      if (groups[skill.importance]) {
        groups[skill.importance].push(skill);
      }
    }

    return groups;
  }, [missingSkills]);

  // Add skill to resume
  const addSkill = async (skill: string) => {
    const skillsBlock = blocks.find((b) => b.type === "skills");

    if (!skillsBlock) {
      toast.error("No skills section found in resume");
      return;
    }

    // Add to first group (or create "Other" group)
    const updatedContent = { ...skillsBlock.content };
    const groups = [...(updatedContent.groups || [])];

    if (groups.length === 0) {
      groups.push({ name: "Skills", skills: [skill] });
    } else {
      // Add to first group
      groups[0] = {
        ...groups[0],
        skills: [...(groups[0].skills || []), skill],
      };
    }

    updatedContent.groups = groups;
    updateBlock(skillsBlock.id, updatedContent);

    await save();
    toast.success(`Added "${skill}" to skills`);
  };

  // Don't show if ATS not ready
  if (!isReady) {
    return null;
  }

  // Don't show if no missing skills
  if (missingSkills.length === 0) {
    return (
      <Card className="border-green-500/50 bg-green-500/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">
              All important skills covered!
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Missing Skills
          <Badge variant="secondary">{missingSkills.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Render each importance group */}
        {(["required", "strongly_preferred", "preferred", "nice_to_have"] as const).map(
          (importance) => {
            const skills = groupedSkills[importance];
            if (skills.length === 0) return null;

            return (
              <div key={importance} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {importanceLabels[importance]}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <SkillChip
                      key={skill.keyword}
                      skill={skill}
                      onAdd={() => addSkill(skill.keyword)}
                    />
                  ))}
                </div>
              </div>
            );
          }
        )}

        <p className="text-xs text-muted-foreground">
          Click a skill to add it to your resume
        </p>
      </CardContent>
    </Card>
  );
}

interface SkillChipProps {
  skill: {
    keyword: string;
    importance: "required" | "strongly_preferred" | "preferred" | "nice_to_have";
    inVault: boolean;
  };
  onAdd: () => void;
}

function SkillChip({ skill, onAdd }: SkillChipProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        "transition-all hover:scale-105 hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        importanceStyles[skill.importance]
      )}
    >
      <Plus className="h-3 w-3" />
      {skill.keyword}
      {skill.inVault && (
        <Archive className="h-3 w-3 opacity-50" title="Available in your vault" />
      )}
    </button>
  );
}
```

---

## 4.2 Modify SkillsEditor

**File:** `frontend/src/components/library/editor/blocks/SkillsEditor.tsx`

### Changes Required

Accept an optional callback for programmatically adding skills with animation.

```typescript
// Add to props interface
interface SkillsEditorProps {
  // ... existing props
  onAddSkill?: (skill: string, groupIndex?: number) => void;
}

// Add state for highlighting newly added skills
const [highlightedSkill, setHighlightedSkill] = useState<string | null>(null);

// Effect to clear highlight after animation
useEffect(() => {
  if (highlightedSkill) {
    const timer = setTimeout(() => setHighlightedSkill(null), 2000);
    return () => clearTimeout(timer);
  }
}, [highlightedSkill]);

// Expose add function via ref or context if needed
const addSkillExternally = useCallback((skill: string, groupIndex = 0) => {
  // Add skill to group
  const groups = [...content.groups];
  if (groups[groupIndex]) {
    groups[groupIndex] = {
      ...groups[groupIndex],
      skills: [...(groups[groupIndex].skills || []), skill],
    };
    onChange({ ...content, groups });

    // Highlight the new skill
    setHighlightedSkill(skill);

    // Scroll into view
    setTimeout(() => {
      const skillElement = document.querySelector(`[data-skill="${skill}"]`);
      skillElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }
}, [content, onChange]);

// In skill rendering, add highlight class:
<span
  data-skill={skill}
  className={cn(
    "skill-tag",
    highlightedSkill === skill && "animate-pulse bg-green-200 dark:bg-green-800"
  )}
>
  {skill}
</span>
```

---

## 4.3 Integrate Skills Panel into AIChatTab

**File:** `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

### Changes

Add `SkillSuggestionsPanel` below `BulletSuggestionsPanel`.

```typescript
import { SkillSuggestionsPanel } from "@/components/tailor/editor/SkillSuggestionsPanel";

// In render:
{isTailorMode && tailorContext && (
  <>
    <BulletSuggestionsPanel tailoredResumeId={resumeId} />
    <SkillSuggestionsPanel />
    <div className="border-t my-4" />
  </>
)}
```

---

## Verification

### Phase 4 Verification Checklist

- [ ] `SkillSuggestionsPanel` created and renders correctly
- [ ] Panel shows missing skills grouped by importance
- [ ] Skills already in resume are filtered out
- [ ] Clicking skill adds it to Skills section
- [ ] Added skill shows highlight animation
- [ ] Auto-save triggers after adding skill
- [ ] "In Vault" indicator shows for skills available in vault
- [ ] Panel hidden when ATS not complete
- [ ] "All skills covered" state shows when no gaps

### Test Commands

```bash
# TypeScript check
cd frontend && bun run typecheck

# Run component tests
cd frontend && bun test SkillSuggestionsPanel
```
