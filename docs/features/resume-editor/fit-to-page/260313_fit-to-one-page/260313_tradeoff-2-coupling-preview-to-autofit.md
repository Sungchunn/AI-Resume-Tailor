# Tradeoff 2: Coupling ResumePreview to Auto-Fit Logic

**Created:** 2026-03-13
**Status:** Analysis
**Risk Level:** Low

---

## Context

DOM-based measurement requires access to the rendered page element. The `ResumePreview` component owns this element, creating a dependency between the auto-fit hook and the preview component.

---

## Current Architecture

```text
EditorLayout
├── BlockEditorProvider (state management)
├── Sidebar (editing controls)
└── ResumePreview (renders the page)
```

Auto-fit logic lives in `useAutoFitBlocks` hook, separate from preview rendering.

---

## Proposed Coupling

```text
EditorLayout
├── previewRef = useRef()
├── useFitToPageWithDOM({ previewRef, ... })
│   └── calls previewRef.current.getPageElement()
└── ResumePreview ref={previewRef}
    └── exposes getPageElement() via useImperativeHandle
```

### API Contract

```typescript
// ResumePreview exposes:
interface ResumePreviewHandle {
  getPageElement: () => HTMLElement | null;
}

// Used by auto-fit hook:
const measureFn = useCallback(() => {
  const pageElement = previewRef.current?.getPageElement();
  return pageElement?.scrollHeight ?? 0;
}, [previewRef]);
```

---

## Pros

| Benefit | Explanation |
| ------- | ----------- |
| Single source of truth | Preview owns the page element; no duplicate references |
| Encapsulation preserved | Preview internals remain hidden behind method |
| Natural ownership | Preview already manages page rendering and sizing |
| Type safety | `useImperativeHandle` provides typed ref interface |

---

## Cons

| Drawback | Impact |
| -------- | ------ |
| API contract expansion | `ResumePreview` now serves two purposes: rendering + measurement |
| Testing complexity | Unit tests must mock the ref and `getPageElement()` |
| Implicit dependency | Auto-fit silently fails if preview ref is not connected |
| Lifecycle coupling | Auto-fit must wait for preview mount before measuring |

---

## Alternative Considered: Context-Based Dimensions

Instead of ref coupling, pass dimensions through React context:

```typescript
// PreviewDimensionsContext
interface PreviewDimensions {
  contentHeight: number;
  pageHeight: number;
}

// ResumePreview publishes:
useEffect(() => {
  setDimensions({ contentHeight: pageRef.current.scrollHeight, ... });
}, [/* content changes */]);

// Auto-fit consumes:
const { contentHeight } = usePreviewDimensions();
```

### Why Rejected

| Issue | Problem |
| ----- | ------- |
| State synchronization | Dimensions update async, auto-fit may read stale values |
| Re-render cascade | Dimension changes trigger context consumers to re-render |
| Measurement timing | Context updates after render; auto-fit needs to control timing |
| Circular dependency | Auto-fit changes styles → dimensions change → auto-fit re-runs |

The ref approach allows auto-fit to **pull** measurements when needed, rather than **reacting** to pushed updates.

---

## Alternative Considered: Extracting Page Element

Move page element ownership outside preview:

```typescript
// EditorLayout owns the page element
const pageRef = useRef<HTMLDivElement>(null);

return (
  <div ref={pageRef} className="page">
    <ResumePreview pageRef={pageRef} />
  </div>
);
```

### Why Rejected?

| Issue | Problem |
| ----- | ------- |
| Breaks encapsulation | Preview's internal structure leaks to parent |
| Styling complexity | Page styles must coordinate between components |
| Existing code impact | Significant refactor of preview component |

---

## Recommendation

**Accept the ref coupling.**

The coupling is:

1. **Narrow** - Only one method exposed (`getPageElement`)
2. **Typed** - TypeScript enforces the contract
3. **Explicit** - Ref connection is visible in JSX
4. **Testable** - Integration tests validate actual DOM behavior

---

## Why This Breaks React Conventions (And Why It's Acceptable)

### The "Necessary Evil" Pattern

Using `forwardRef` + `useImperativeHandle` to expose DOM access is an **anti-pattern** in standard React development. React's philosophy emphasizes:

- **Declarative over imperative** - Describe what you want, not how to get it
- **Unidirectional data flow** - Parent passes props down, children emit events up
- **Encapsulation** - Components hide their internal DOM structure

This pattern violates all three principles by creating an **imperative escape hatch** that lets external code reach into a component's internals.

### Why We Accept It Here

DOM measurement is fundamentally **imperative** - there is no declarative way to ask "how tall is this element?" The browser's layout engine computes dimensions as a side effect of rendering, and we must **pull** that information synchronously.

| Requirement | Why Declarative Fails |
| ----------- | --------------------- |
| Synchronous measurement | CSS/layout computed after render commit; no prop can capture it |
| Multiple measurements per adjustment | Binary search requires N reads; context would cause N re-renders |
| Timing control | Auto-fit must decide when to measure, not react to updates |

### Message to Future Engineers

> **This ref coupling is intentional and load-bearing.**
>
> If you're considering refactoring this to use context, state, or CSS-only solutions, please read this document first. The alternatives were evaluated and rejected for the reasons documented above.
>
> The coupling is designed to be minimal:
>
> - `ResumePreview` exposes exactly one method: `getPageElement()`
> - The method returns a raw DOM element, not preview internals
> - The auto-fit hook treats the element as read-only (measurement, not mutation)
>
> If you must modify this pattern, ensure the new approach can:
>
> 1. Measure content height synchronously
> 2. Support multiple measurements without re-rendering
> 3. Allow the caller to control measurement timing

---

## Implementation Notes

### ResumePreview Changes

```typescript
const ResumePreview = forwardRef<ResumePreviewHandle, Props>((props, ref) => {
  const pageRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getPageElement: () => pageRef.current,
  }), []);

  return <div ref={pageRef} className="page">...</div>;
});
```

### Testing Strategy

#### Why Traditional Unit Tests Cannot Work

The auto-fit feature depends on **real browser layout computation**. Unit tests with JSDOM or mocked refs cannot verify this functionality because:

| Limitation | Explanation |
| ---------- | ----------- |
| No CSS layout engine | JSDOM does not compute `scrollHeight`, `offsetHeight`, or any layout properties |
| Mocked values are circular | Mocking `scrollHeight: 1200` just tests that we read the mock, not that CSS produces overflow |
| Font rendering absent | Actual line breaks depend on font metrics, unavailable in Node.js |
| Binary search untestable | Cannot verify convergence without real measurements changing between iterations |

```typescript
// This mock proves nothing useful:
const mockPreviewRef = {
  current: {
    getPageElement: () => ({
      scrollHeight: 1200, // Fake value - doesn't respond to CSS changes
    } as HTMLElement),
  },
};

// The test would pass even if our CSS was completely broken
```

#### Playwright Integration Tests (Required)

Auto-fit **must** be tested with Playwright to validate real browser behavior.

> **TODO:** Full Playwright testing plan to be documented separately.
>
> This section provides scaffolding for the testing approach.

##### Test Scenarios

| Scenario | What It Validates |
| -------- | ----------------- |
| Content fits on one page | No scaling applied, content height ≤ page height |
| Slight overflow (1-10%) | Binary search finds minimal scale reduction |
| Moderate overflow (10-50%) | Scaling converges without excessive iterations |
| Severe overflow (>50%) | Falls back to minimum threshold |
| Dynamic content changes | Re-triggers auto-fit when blocks added/removed |

##### Example Test Structure (Scaffolding)

```typescript
// e2e/fit-to-page.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Fit to One Page", () => {
  test("scales content to fit within page bounds", async ({ page }) => {
    // Navigate to editor with overflow content
    await page.goto("/workshop/resume-id");

    // Add content that causes overflow
    // ... (add blocks via UI or API)

    // Trigger auto-fit
    await page.click('[data-testid="fit-to-page-button"]');

    // Measure actual DOM
    const pageElement = page.locator('[data-testid="resume-page"]');
    const contentHeight = await pageElement.evaluate(
      (el) => el.scrollHeight
    );
    const pageHeight = await pageElement.evaluate(
      (el) => el.clientHeight
    );

    // Assert content now fits
    expect(contentHeight).toBeLessThanOrEqual(pageHeight);
  });

  test("preserves readability above minimum threshold", async ({ page }) => {
    // ... test that font size doesn't go below minimum
  });

  test("binary search converges in reasonable iterations", async ({ page }) => {
    // ... test iteration count via instrumentation
  });
});
```

##### Integration Points

- **Test suite location:** `frontend/e2e/` (to be created)
- **CI integration:** Run on PR merge to `main`
- **Visual regression:** Capture PDF snapshots for manual review
