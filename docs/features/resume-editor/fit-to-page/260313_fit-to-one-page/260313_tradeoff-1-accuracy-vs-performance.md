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

## Algorithm Complexity Analysis

### Current Linear Algorithm: O(n)

The existing implementation reduces styles by 5% increments until content fits:

| Case | Iterations | Complexity |
| ---- | ---------- | ---------- |
| Best | 1 (already fits) | O(1) |
| Worst | ~25 (reduce to minimum) | O(n) |
| Average | ~12.5 | O(n) |

Where n = number of discrete style levels (approximately 100 when using 1% increments, or 25 with 5% increments).

### Binary Search Algorithm: O(log n)

Binary search achieves logarithmic complexity by halving the search space each iteration:

| Case | Iterations | Complexity |
| ---- | ---------- | ---------- |
| Best | 1 (already fits) | O(1) |
| Worst | ⌈log₂(100)⌉ = 7 | O(log n) |
| Average | ~3.5 | O(log n) |

**Improvement factor:** n / log₂(n) = 100 / 7 ≈ **14x fewer iterations**

---

## Mathematical Proof: Binary Search Feasibility

### Definitions

Let:

- `c` ∈ [0, 100] = compactness level (0 = original styles, 100 = maximum compactness)
- `h(c)` = content height at compactness level c (in pixels)
- `T` = target page height (fixed constant, e.g., 1056px for US Letter)
- `fits(c)` = predicate function: returns true iff h(c) ≤ T

### Theorem: Monotonicity of fits(c)

**Claim:** If `fits(c₁) = true`, then `fits(c₂) = true` for all `c₂ ≥ c₁`.

**Proof:**

The compactness scale maps to style properties that monotonically reduce content height:

1. **Font sizes decrease:** Smaller fonts → fewer line wraps → shorter text blocks
2. **Spacing decreases:** Less vertical space between sections/entries
3. **Line heights decrease:** Denser text rendering

For any two compactness levels where c₂ > c₁:

```text
h(c₂) ≤ h(c₁)    (height is non-increasing with compactness)
```

Therefore:

```text
fits(c₁) = true
    ⟹ h(c₁) ≤ T           (by definition of fits)
    ⟹ h(c₂) ≤ h(c₁) ≤ T   (by monotonicity of h)
    ⟹ fits(c₂) = true     (by definition of fits)    ∎
```

### Corollary: Search Space Partition

The search space [0, 100] partitions into exactly two contiguous regions:

```text
[0, c* - 1]:  fits(c) = false   (content overflows)
[c*, 100]:    fits(c) = true    (content fits)
```

Where `c*` is the minimum compactness level that achieves fit.

### Binary Search Correctness

Given the monotonic partition, binary search correctly finds `c*`:

```text
function findMinimumCompactness():
    low = 0, high = 100, result = 100

    while low ≤ high:
        mid = ⌊(low + high) / 2⌋

        if fits(mid):
            result = mid       // mid works, try to find smaller
            high = mid - 1     // search left half
        else:
            low = mid + 1      // mid doesn't work, search right half

    return result
```

**Loop invariant:** `c* ∈ [low, high] ∪ {result}`

**Termination:** Search space halves each iteration → terminates in ⌈log₂(n)⌉ iterations.

### Complexity Derivation

For a search space of size n:

```text
Iterations = ⌈log₂(n)⌉

For n = 101 (levels 0-100):
    ⌈log₂(101)⌉ = ⌈6.66⌉ = 7 iterations maximum
```

**Time Complexity:** O(log n)
**Space Complexity:** O(1)

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
