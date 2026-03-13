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

### Why Rejected

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
4. **Testable** - Mock implementation is straightforward

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

```typescript
// Mock for unit tests
const mockPreviewRef = {
  current: {
    getPageElement: () => ({
      scrollHeight: 1200, // Simulated overflow
    } as HTMLElement),
  },
};
```
