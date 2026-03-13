# Fit-to-One-Page: Engineering Tradeoffs Summary

**Created:** 2026-03-13
**Status:** Analysis

---

## Overview

This document summarizes the key engineering tradeoffs for the fit-to-one-page feature. Each tradeoff has a dedicated analysis document with detailed reasoning.

---

## Tradeoffs Index

| # | Tradeoff | Risk | Key Content |
| - | -------- | ---- | ----------- |
| 1 | [Accuracy vs. Performance](./130326_tradeoff-1-accuracy-vs-performance.md) | Low | Binary search O(log n) proof, DOM measurement cost analysis |
| 2 | [Coupling Preview to Auto-Fit](./130326_tradeoff-2-coupling-preview-to-autofit.md) | Low | Ref pattern justification, Playwright testing scaffolding |
| 3 | [Eager Persistence](./130326_tradeoff-3-eager-persistence.md) | Medium | Race condition mitigation, save operation lock, LLM state machine |
| 4 | [Default-On vs. Opt-In](./130326_tradeoff-4-default-on-vs-optin.md) | Medium | Migration strategies, user personas, Option B recommendation |
| 5 | [Synchronous Measurement](./130326_tradeoff-5-synchronous-measurement.md) | Low-Medium | Double-RAF timing, React 18 concurrent mode risks |

---

## Decision Summary

| Decision | Risk Level | Recommendation | Mitigation |
| -------- | ---------- | -------------- | ---------- |
| DOM-based measurement | Low | Accept | Binary search O(log n) limits to 7 iterations max; proof: monotonic height function |
| Preview ref coupling | Low | Accept | Clean API via `useImperativeHandle`; intentional React anti-pattern (documented) |
| Eager persistence | Medium | Accept with safeguards | Save operation lock + hash comparison + 2s debounce; handles race conditions |
| Default-on behavior | Medium | New resumes only | Preserve existing resume settings via null coalescing |
| Double-RAF timing | Low-Medium | Accept with monitoring | Max iterations + stability threshold + timing diagnostics |

---

## Architecture Verdict

The proposed architecture is sound for the stated requirements.

### Low-Risk Decisions

**DOM-based measurement** is justified by the mathematical proof that content height is monotonically decreasing with compactness level. Binary search achieves O(log n) complexity (max 7 iterations), making reflow cost acceptable.

**Preview ref coupling** is an intentional deviation from React's declarative patterns. DOM measurement is fundamentally imperative—there is no declarative way to ask "how tall is this element?" The ref pattern provides:

- Synchronous measurement on demand
- Multiple measurements without re-rendering
- Caller-controlled timing

This is documented in Tradeoff 2 with guidance for future engineers.

### Medium-Risk Decisions

**Eager persistence** requires the save operation lock pattern:

1. Manual save cancels pending auto-save and acquires lock
2. Auto-save checks lock and aborts if manual save is in progress
3. Hash comparison prevents duplicate saves

This pattern also prepares for future LLM streaming integration (see state machine in Tradeoff 3).

**Default-on behavior** uses Option B (new resumes only):

- Existing resumes: `fitToOnePage ?? false` (preserve current behavior)
- New resumes: `fitToOnePage: true` (improved default)

### Areas to Monitor

1. **Race conditions** - Save operation lock handles known scenarios; monitor for edge cases
2. **React concurrent mode** - Double-RAF timing includes performance diagnostics (warn if >100ms)
3. **User feedback** - Edge cases with extremely long content (minimum-reached warning)

---

## Implementation Priority

Based on risk and dependencies:

```text
1. Binary search algorithm (foundation)
   ↓
2. DOM measurement bridge (enables accuracy)
   ↓
3. Preview ref coupling (enables DOM measurement)
   ↓
4. Double-RAF timing (enables reliable measurement)
   ↓
5. Default-on for new resumes (user-facing change)
   ↓
6. Eager persistence with save operation lock (requires above to be stable)
   ↓
7. Playwright integration tests (validates entire flow)
```

---

## Open Questions

### For Product Decision

1. Should users see a notification when auto-fit adjusts their styles?
2. Should there be an "undo auto-fit" action? (See Tradeoff 3: StyleHistory consideration)
3. ~~What happens when content cannot fit even at minimum sizes?~~ **Resolved:** Show "minimum-reached" warning

### For Technical Validation

1. ~~Test double-RAF behavior under React concurrent mode~~ **Resolved:** Timing diagnostics added (Tradeoff 5)
2. Measure actual reflow cost on low-end devices
3. Validate binary search accuracy across font families
4. **NEW:** Implement Playwright integration tests (see Tradeoff 2)

---

## Testing Requirements

Unit tests with JSDOM cannot validate this feature. Playwright integration tests are **required**.

| Scenario | Validation |
| -------- | ---------- |
| Content fits | No scaling applied |
| Slight overflow | Binary search finds minimal reduction |
| Severe overflow | Falls back to minimum threshold |
| Dynamic changes | Re-triggers auto-fit |

See [Tradeoff 2](./130326_tradeoff-2-coupling-preview-to-autofit.md) for test scaffolding.
