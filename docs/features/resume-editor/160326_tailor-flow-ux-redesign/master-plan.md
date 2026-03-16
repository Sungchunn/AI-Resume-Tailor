# Tailor Flow UX Redesign: Show Original Resume with AI Assistance

## Problem Statement

Current flow after ATS analysis:

1. User clicks "Generate Tailored Resume"
2. Backend AI regenerates entire resume content
3. Editor shows AI-generated content (disconnected from what user uploaded)

Desired flow:

1. User clicks "Edit Resume"
2. Editor shows the **original resume** they selected
3. ATS keyword analysis highlights what needs improvement
4. User edits with on-demand AI assistance per section

## Implementation Approach

### Strategy: Navigate to Library Editor with Job Context

Instead of creating a tailored resume document and regenerating content, navigate the user to their **original resume's editor** with the job context passed via URL params.

**Why this approach:**

- Minimal backend changes (no new endpoints)
- Reuses existing library editor which already has ATS panel
- Original resume is already parsed and verified
- Job context enables ATS tab to show keyword analysis
- No data duplication or new document types

## Changes Required

### Phase 1: Change Navigation After Analysis

**File:** `frontend/src/app/(protected)/tailor/analyze/page.tsx`

Current behavior (lines 147-173):

```tsx
const handleGenerateTailored = async () => {
  const result = await tailorResume.mutateAsync(request);
  router.push(`/tailor/editor/${result.id}`);
};
```

New behavior:

```tsx
const handleEditResume = () => {
  // Navigate to library editor with job context
  const jobParam = jobListingIdNum
    ? `jobListingId=${jobListingIdNum}`
    : `jobId=${jobIdNum}`;
  router.push(`/library/resumes/${resumeId}/edit?${jobParam}`);
};
```

**Changes:**

1. Rename `handleGenerateTailored` → `handleEditResume`
2. Remove the `useTailorResume()` mutation call
3. Navigate directly to library editor with job context in URL
4. Rename CTA button from "Generate Tailored Resume" to "Edit Resume"

### Phase 2: Enable AI Chat Tab in Editor

**File:** `frontend/src/components/library/editor/ControlPanel.tsx`

Current (line 40-41):

```tsx
<TabButton
  disabled={true}
  disabledReason="Coming soon"
```

Change to:

```tsx
<TabButton
  disabled={false}
```

This enables the AI Chat tab which already has:

- Section-targeted suggestions
- Quick actions ("Make concise", "Add metrics", etc.)
- Accept/reject for suggestions

### Phase 3: Pass Job Context to AI Chat

**File:** `frontend/src/components/library/editor/tabs/AIChatTab.tsx`

The AI chat should use job context when making suggestions. Modify to:

1. Accept `jobId` or `jobListingId` props
2. Fetch job description when available
3. Include job context in AI prompts for more targeted suggestions

## Files to Modify

| File | Change |
| ---- | ------ |
| `frontend/src/app/(protected)/tailor/analyze/page.tsx` | Change CTA to navigate to library editor |
| `frontend/src/components/library/editor/ControlPanel.tsx` | Enable AI tab |
| `frontend/src/components/library/editor/tabs/AIChatTab.tsx` | Add job context support |

## Verification

1. **Test flow:** `/tailor` → select resume → select job → analyze → click "Edit Resume"
2. **Verify:** Opens library editor at `/library/resumes/{id}/edit?jobListingId={id}`
3. **Verify:** ATS tab shows keyword analysis for the job
4. **Verify:** AI tab is enabled and functional
5. **Verify:** Edits save to the original resume

## User Decisions

- **CTA Label:** "Edit Resume"
- **AI Generation:** Remove entirely - clean UX with only the new flow
