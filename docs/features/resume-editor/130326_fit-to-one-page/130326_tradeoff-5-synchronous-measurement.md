# Tradeoff 5: Synchronous Measurement in Async React

**Created:** 2026-03-13
**Status:** Implemented
**Risk Level:** Low-Medium

---

## Context

The auto-fit algorithm needs to measure DOM height after applying style changes. The proposed pattern uses double `requestAnimationFrame`:

```typescript
const measureWithRAF = (measureFn: () => number): Promise<number> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(measureFn());
      });
    });
  });
};
```

---

## Algorithm Complexity Impact

The choice of search algorithm directly impacts how many synchronous measurements are performed. See [Tradeoff 1: Accuracy vs Performance](./130326_tradeoff-1-accuracy-vs-performance.md) for the full mathematical proof.

| Algorithm | Max Measurements | Complexity |
| --------- | ---------------- | ---------- |
| Linear (5% steps) | 25 | O(n) |
| Binary Search | 7 | O(log n) |

Binary search reduces synchronous measurement overhead by ~14x in worst case, making the double RAF approach practical.

---

## Why Double RAF?

### Browser Rendering Pipeline

```text
1. JavaScript execution
2. Style calculation
3. Layout
4. Paint
5. Composite
```

A single `requestAnimationFrame` schedules a callback **before** the next paint. However, React's state update may not have committed yet.

### The Timing Problem

```text
T=0:   setStyle({ fontSize: 10 })
T=1:   React schedules re-render
T=2:   RAF callback fires ← Style not yet applied to DOM!
T=3:   React commits changes to DOM
T=4:   Browser calculates layout
T=5:   Browser paints
```

Double RAF ensures we wait for:

1. First RAF: Wait for current frame's paint
2. Second RAF: Wait for next frame, after React commit

```text
T=0:   setStyle({ fontSize: 10 })
T=1:   React schedules re-render
T=2:   First RAF callback fires
T=3:   React commits changes to DOM
T=4:   Browser paints
T=5:   Second RAF callback fires ← DOM now reflects new styles
T=6:   measureFn() reads accurate scrollHeight
```

---

## React 18 Concurrent Rendering Risk

React 18 introduced concurrent features that can defer commits:

### Automatic Batching

```typescript
// React 18 batches these into one render
setStyle({ fontSize: 10 });
setBlocks([...]);
```

Double RAF still works because batched updates commit together.

### Transitions

```typescript
// Low-priority update, may be interrupted
startTransition(() => {
  setStyle({ fontSize: 10 });
});
```

**Risk:** Transition updates may not commit before RAF callback.

### Suspense

```typescript
<Suspense fallback={<Loading />}>
  <ResumePreview />
</Suspense>
```

**Risk:** If preview suspends, DOM may not exist when measuring.

---

## Alternative: useLayoutEffect

`useLayoutEffect` runs synchronously after DOM mutations, before paint:

```typescript
function useAutoFitWithLayout(options: Options) {
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!options.enabled) return;

    const pageElement = options.previewRef.current?.getPageElement();
    if (pageElement) {
      setMeasuredHeight(pageElement.scrollHeight);
    }
  }, [options.style, options.blocks, options.enabled]);

  // React to measured height
  useEffect(() => {
    if (measuredHeight !== null && measuredHeight > targetHeight) {
      // Trigger next iteration
    }
  }, [measuredHeight]);
}
```

### Pros

| Benefit | Explanation |
| ------- | ----------- |
| Synchronous timing | Guaranteed to run after DOM update |
| No RAF heuristics | React controls the timing |
| Works with concurrent mode | Respects React's commit phase |

### Cons

| Drawback | Explanation |
| -------- | ----------- |
| Blocks paint | Synchronous work delays visual update |
| Multiple iterations | Each measurement triggers re-render → layout effect → measurement |
| SSR warning | `useLayoutEffect` warns in SSR (not applicable here, but noted) |

---

## Alternative: flushSync

Force synchronous update before measuring:

```typescript
import { flushSync } from 'react-dom';

async function findOptimalCompactness(...) {
  // ...

  flushSync(() => {
    applyStyle(testStyle);
  });

  // DOM is guaranteed to reflect testStyle
  const height = measureFn();
}
```

### Pros1

| Benefit | Explanation |
| ------- | ----------- |
| Explicit control | Forces React to commit immediately |
| No async complexity | Measurement happens synchronously |

### Cons1

| Drawback | Explanation |
| -------- | ----------- |
| Performance | Bypasses React's batching optimizations |
| Concurrent mode issues | Can cause tearing with concurrent features |
| React team discourages | Escape hatch, not recommended pattern |

---

## Recommendation

**Use double RAF with fallback monitoring.**

Rationale:

1. **Works in practice** - Double RAF is a well-established pattern
2. **Non-blocking** - Allows React to batch and optimize
3. **Simple implementation** - No complex state coordination

### Safeguards

| Safeguard | Purpose |
| --------- | ------- |
| Max iterations | Prevents infinite loops if timing fails |
| Stability threshold | Stops if height change < 2px (measurement noise) |
| `isProcessingRef` | Prevents re-entrancy during measurement cycle |

### Monitoring for Edge Cases

Add logging to detect timing issues:

```typescript
const measureWithRAF = async (measureFn: () => number): Promise<number> => {
  return new Promise((resolve) => {
    const startTime = performance.now();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elapsed = performance.now() - startTime;

        // Flag if timing is suspiciously long (concurrent mode interference?)
        if (elapsed > 100) {
          console.warn(`Auto-fit measurement delayed: ${elapsed}ms`);
        }

        resolve(measureFn());
      });
    });
  });
};
```

---

## Future Consideration: React 19+

React's future versions may provide better primitives for this use case. Monitor for:

- `useEffectEvent` - Stable callbacks that don't re-trigger effects
- Improved `useLayoutEffect` guidance for measurement patterns
- Official "measure after commit" API
