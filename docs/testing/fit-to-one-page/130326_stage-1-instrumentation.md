# Stage 1: Instrument Components with Test IDs

**Goal:** Add `data-testid` attributes to all components that tests will interact with.

**Dependencies:** None (can start immediately)

**Back to:** `130326_master-plan.md`

---

## Tasks

| # | Task | File | Line Reference |
| - | ---- | ---- | -------------- |
| 1.1 | Add `data-testid="fit-to-page-toggle"` to toggle button | `frontend/src/components/library/editor/style/AutoFitToggle.tsx` | ~L45 |
| 1.2 | Add `data-testid="fit-status-badge"` to StatusBadge wrapper | `frontend/src/components/library/editor/style/AutoFitToggle.tsx` | ~L89 |
| 1.3 | Add `data-testid="fit-adjustments-list"` to `<ul>` | `frontend/src/components/library/editor/style/AutoFitToggle.tsx` | ~L66 |
| 1.4 | Add `data-testid="fit-minimum-warning"` to warning div | `frontend/src/components/library/editor/style/AutoFitToggle.tsx` | ~L78 |
| 1.5 | Add `data-testid="resume-page"` to page container | `frontend/src/components/library/preview/ResumePreview.tsx` | Search for `ref={pageRef}` |

---

## Implementation Details

### 1.1 Toggle Button

**File:** `frontend/src/components/library/editor/style/AutoFitToggle.tsx`

```tsx
// Around line 45
<button
  role="switch"
  aria-checked={enabled}
  data-testid="fit-to-page-toggle"
  onClick={() => onToggle(!enabled)}
  // ...existing props
>
```

### 1.2 Status Badge

**File:** `frontend/src/components/library/editor/style/AutoFitToggle.tsx`

```tsx
// Around line 89 - StatusBadge component
function StatusBadge({ status }: { status: AutoFitStatus }) {
  return (
    <span data-testid="fit-status-badge" className="...">
      {/* existing content */}
    </span>
  );
}
```

### 1.3 Adjustments List

**File:** `frontend/src/components/library/editor/style/AutoFitToggle.tsx`

```tsx
// Around line 66
<ul
  className="mt-1 space-y-0.5 text-green-600"
  data-testid="fit-adjustments-list"
>
```

### 1.4 Minimum Warning

**File:** `frontend/src/components/library/editor/style/AutoFitToggle.tsx`

```tsx
// Around line 78
<div
  data-testid="fit-minimum-warning"
  className="text-xs text-amber-700 ..."
>
```

### 1.5 Resume Page Container

**File:** `frontend/src/components/library/preview/ResumePreview.tsx`

```tsx
// Search for ref={pageRef}
<div
  ref={pageRef}
  data-testid="resume-page"
  className="..."
>
```

---

## Verification

```bash
# Search for all added test IDs
cd frontend
grep -r "data-testid=\"fit-" src/
grep -r "data-testid=\"resume-page\"" src/
```

**Expected output:** 5 test IDs found across 2 files.

### Additional Checks

```bash
# Verify no TypeScript errors
bun run typecheck

# Verify dev server renders correctly
bun dev
# Manual check: Navigate to /library/resumes/[id]/edit and confirm UI renders
```

---

## Definition of Done

- [ ] 1.1 `fit-to-page-toggle` test ID added
- [ ] 1.2 `fit-status-badge` test ID added
- [ ] 1.3 `fit-adjustments-list` test ID added
- [ ] 1.4 `fit-minimum-warning` test ID added
- [ ] 1.5 `resume-page` test ID added
- [ ] No TypeScript errors
- [ ] Dev server renders correctly
- [ ] Commit created: `frontend: add data-testid attributes for fit-to-page E2E tests`

---

## Next Stage

Proceed to `130326_stage-2-playwright-config.md`
