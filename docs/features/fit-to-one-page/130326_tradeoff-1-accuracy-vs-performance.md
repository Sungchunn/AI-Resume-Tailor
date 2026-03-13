# Tradeoff 1: Accuracy vs. Performance

**Created:** 2026-03-13
**Status:** Analysis
**Risk Level:** Low

---

## Context

The fit-to-one-page feature requires measuring content height to determine when scaling is needed. Two approaches exist:

1. **Estimation-based:** Mathematical calculation using font sizes, line counts, and spacing
2. **DOM-based:** Direct measurement via `scrollHeight` on rendered elements

---

## Comparison

| Aspect | Estimation | DOM Measurement |
| ------ | ---------- | --------------- |
| Height accuracy | ~85-90% | ~100% |
| Measurement cost | O(1) calculation | Forced layout/reflow |
| Iterations needed | More (overshoot common) | Fewer (precise) |
| Text wrapping | Cannot account for exact wrapping | Reflects actual wrapping |
| Font variations | Assumes fixed line heights | Measures actual rendered heights |

---

## DOM Measurement Cost Analysis

Each DOM measurement via `scrollHeight` forces the browser to perform a synchronous layout calculation. The iteration cycle:

```text
1. Style change → React re-render
2. Double RAF → Wait for paint
3. scrollHeight read → Forced reflow
```

### Worst Case Performance

With the binary search algorithm (max 7 iterations):

```text
7 iterations × (re-render + 2 RAF + reflow) = 7 reflows per content change
```

Compare to linear algorithm (max 25 iterations):

```text
25 iterations × (re-render + 2 RAF + reflow) = 25 reflows per content change
```

### Best Case Performance

If content already fits:

```text
1 measurement → 0 style changes → 1 reflow total
```

---

## Why Estimation Fails

The estimation approach in `estimateContentHeight()` makes assumptions that break in practice:

### Text Wrapping

```typescript
// Estimation assumes 80 chars per line
const lines = Math.ceil(summary.length / 80) || 1;
```

Reality: Character width varies by font, actual wrapping depends on container width.

### Line Heights

```typescript
// Estimation uses fixed multiplier
const bodyLineHeight = style.fontSizeBody * style.lineSpacing;
```

Reality: Browser line height calculation considers font metrics, descenders, and rounding.

### Nested Content

Bullet points with long text, nested lists, and varying entry counts create height variations that estimation cannot predict.

---

## The Oscillation Problem

Inaccurate estimation causes a specific bug pattern:

```text
1. Estimate height = 1100px (actual: 1050px)
2. Content "overflows" → reduce styles
3. New estimate = 980px (actual: 1020px)
4. Content "fits" → stop
5. Actual render: still overflows
```

Or the inverse:

```text
1. Estimate height = 1050px (actual: 1100px)
2. Content "fits" → stop
3. Actual render: overflows by 50px
```

DOM measurement eliminates this entirely.

---

## Recommendation

**Accept the DOM measurement approach.**

Rationale:

1. **Accuracy is critical** - A resume that overflows defeats the feature's purpose
2. **Binary search limits cost** - Max 7 reflows is acceptable for a save/edit operation
3. **User-triggered** - Measurements only run on content changes, not continuously
4. **Debouncing reduces frequency** - 500ms debounce on observers prevents rapid reflows

---

## Mitigation Strategies

| Strategy | Implementation |
| -------- | -------------- |
| Binary search | Reduces max iterations from 25 to 7 |
| Early exit | Skip measurement if original style fits |
| Debounced triggers | 500ms debounce on ResizeObserver/MutationObserver |
| RAF batching | Double RAF ensures single reflow per iteration |
