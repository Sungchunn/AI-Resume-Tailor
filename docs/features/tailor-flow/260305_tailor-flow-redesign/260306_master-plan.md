# Tailor Flow Navigation Redesign - Master Plan

## Problem

Users hit a dead end at `/tailor?job_listing_id={ID}`. The "Ready to Tailor" CTA doesn't communicate that AI generation starts, and the editor (core product) is buried behind non-obvious clicks.

## Solution

Redesign into a clear 3-step wizard: **Select Resume → Analyze Match → Editor**

```text
/jobs/{id}
    ↓ Click "Tailor Resume"
/tailor?job_listing_id={ID}  [Step 1: Select]
    ↓ Click "Generate Tailored Resume"
/tailor/analyze              [Step 2: Analyze - ATS + Keywords]
    ↓ Click "Continue to Editor"
/tailor/editor/{id}          [Step 3: Editor]
```

---

## Decisions Already Made

- ATS analysis is Step 2 (visible progress step, not a gate or sidebar)
- "Ready to Tailor" CTA renamed to communicate AI generation starts
- Version history sidebar belongs on editor/detail page, not selection page
- focus_keywords are set during Step 2 (Analyze), not inside editor
- Two Copies Architecture preserved (original → AI-proposed → user-finalized)
- TailoringContext in sessionStorage (30min TTL) preserved

---

## Implementation Plan

### Phase 1: Create TailorFlowStepper Component

**New file:** `/frontend/src/components/tailoring/TailorFlowStepper.tsx`

Create a horizontal 3-step progress indicator following the existing `WizardProgress.tsx` pattern:

```typescript
type TailorFlowStep = "select" | "analyze" | "editor";

const TAILOR_STEPS = [
  { step: "select", label: "Select Resume", number: 1 },
  { step: "analyze", label: "Analyze Match", number: 2 },
  { step: "editor", label: "Editor", number: 3 },
];
```

- Horizontal layout with circles connected by lines
- States: completed (blue + check), current (blue filled), future (gray)
- Responsive sizing

---

### Phase 2: Simplify Step 1 - Select Page

**File:** `/frontend/src/app/(protected)/tailor/page.tsx`

**Changes:**

1. Add `TailorFlowStepper` at top with `currentStep="select"`

2. **Rename CTAs:**
   - "Ready to Tailor" → "Ready to Generate"
   - "Analyze Match" button → "Generate Tailored Resume →"

3. **Remove "Quick Preview" button** - this functionality moves to analyze page

4. **Remove inline analyze step** - delete the `step === "analyze"` UI branch (lines ~423-507)

5. **Simplify state** - remove `TailorStep` type, `step` state, `handleQuickMatch`

**Result:** Single-purpose page with one clear CTA that navigates to `/tailor/analyze`

---

### Phase 3: Enhance Step 2 - Analyze Page

**File:** `/frontend/src/app/(protected)/tailor/analyze/page.tsx`

**Changes:**

1. Add `TailorFlowStepper` with `currentStep="analyze"` and `completedSteps={["select"]}`

2. **Replace quick match with ATS progressive analysis:**

   ```tsx
   import { useATSProgressStream } from "@/hooks/useATSProgressStream";
   import { ATSProgressStepper } from "@/components/tailoring";

   // Auto-start ATS on page load
   useEffect(() => {
     if (resumeId && jobListingId && !atsStream.isAnalyzing) {
       atsStream.start(resumeId, jobListingId);
     }
   }, [resumeId, jobListingId]);
   ```

3. **Add ATSProgressStepper component** - shows 5-stage SSE streaming progress

4. **Gate KeywordSelectionPanel behind ATS completion:**

   ```tsx
   {atsComplete && (
     <KeywordSelectionPanel ... />
   )}
   ```

5. **Change navigation target** - after generation, go to `/tailor/editor/{id}` instead of `/tailor/{id}`

6. **Update CTA** - "Continue to Editor →"

---

### Phase 4: Update Step 3 - Editor Page

**File:** `/frontend/src/app/(protected)/tailor/editor/[id]/page.tsx`

**Changes:**

1. Add `TailorFlowStepper` with `currentStep="editor"` and `completedSteps={["select", "analyze"]}`

2. Keep version history sidebar (already implemented)

3. Update breadcrumb/back navigation

---

### Phase 5: Update Component Index

**File:** `/frontend/src/components/tailoring/index.ts`

Add export:

```typescript
export { TailorFlowStepper } from "./TailorFlowStepper";
```

---

## Files to Modify

| File | Action | Description |
| ---- | ------ | ----------- |
| `components/tailoring/TailorFlowStepper.tsx` | CREATE | 3-step horizontal progress stepper |
| `components/tailoring/index.ts` | MODIFY | Add TailorFlowStepper export |
| `app/(protected)/tailor/page.tsx` | MODIFY | Add stepper, rename CTAs, remove quick preview |
| `app/(protected)/tailor/analyze/page.tsx` | MODIFY | Add stepper, integrate ATS SSE streaming |
| `app/(protected)/tailor/editor/[id]/page.tsx` | MODIFY | Add stepper to header |

---

## CTA Copy Changes

| Page | Current | New |
| ---- | ------- | --- |
| `/tailor` header | "Ready to Tailor" | "Ready to Generate" |
| `/tailor` primary CTA | "Analyze Match" | "Generate Tailored Resume →" |
| `/tailor` secondary CTA | "Quick Preview" | **Remove** |
| `/tailor/analyze` CTA | "Generate Tailored Resume" | "Continue to Editor →" |

---

## Verification

1. **Navigation flow test:**
   - Go to `/jobs/{id}` → click "Tailor Resume"
   - Verify redirect to `/tailor?job_listing_id={id}`
   - Select a resume → click "Generate Tailored Resume"
   - Verify ATSProgressStepper shows 5-stage SSE streaming
   - After ATS completes, verify KeywordSelectionPanel appears
   - Select keywords → click "Continue to Editor"
   - Verify editor loads with tailored content

2. **Stepper state test:**
   - Step 1: stepper shows "Select Resume" as current
   - Step 2: stepper shows "Analyze Match" as current, "Select" as completed
   - Step 3: stepper shows "Editor" as current, both previous as completed

3. **Back navigation test:**
   - Browser back from editor should return to analyze page
   - Browser back from analyze should return to select page

4. **Error handling test:**
   - If ATS SSE fails, page should gracefully handle and allow retry
