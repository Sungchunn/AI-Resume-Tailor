# Fit-to-One-Page: Engineering Tradeoffs Summary

**Created:** 2026-03-13
**Status:** Analysis

---

## Overview

This document summarizes the key engineering tradeoffs for the fit-to-one-page feature. Each tradeoff has a dedicated analysis document with detailed reasoning.

---

## Tradeoffs Index

| # | Tradeoff | Risk | Document |
| - | -------- | ---- | -------- |
| 1 | Accuracy vs. Performance | Low | [130326_tradeoff-1-accuracy-vs-performance.md](./130326_tradeoff-1-accuracy-vs-performance.md) |
| 2 | Coupling Preview to Auto-Fit | Low | [130326_tradeoff-2-coupling-preview-to-autofit.md](./130326_tradeoff-2-coupling-preview-to-autofit.md) |
| 3 | Eager Persistence | Medium | [130326_tradeoff-3-eager-persistence.md](./130326_tradeoff-3-eager-persistence.md) |
| 4 | Default-On vs. Opt-In | Medium | [130326_tradeoff-4-default-on-vs-optin.md](./130326_tradeoff-4-default-on-vs-optin.md) |
| 5 | Synchronous Measurement | Low-Medium | [130326_tradeoff-5-synchronous-measurement.md](./130326_tradeoff-5-synchronous-measurement.md) |

---

## Decision Summary

| Decision | Risk Level | Recommendation | Mitigation |
| -------- | ---------- | -------------- | ---------- |
| DOM-based measurement | Low | Accept | Binary search limits iterations to 7 max |
| Preview ref coupling | Low | Accept | Clean API contract via `useImperativeHandle` |
| Eager persistence | Medium | Accept with safeguards | Hash comparison + 2s debounce |
| Default-on behavior | Medium | New resumes only | Preserve existing resume settings |
| Double-RAF timing | Low-Medium | Accept with monitoring | Max iterations + stability threshold |

---

## Architecture Verdict

The proposed architecture is sound for the stated requirements.

### Low-Risk Decisions

**DOM-based measurement** and **preview coupling** are straightforward with minimal downsides. The accuracy gains from DOM measurement far outweigh the reflow cost, especially with binary search reducing max iterations.

### Medium-Risk Decisions

**Eager persistence** and **default-on behavior** require careful implementation:

1. **Persistence:** Implement debouncing and hash comparison to prevent API spam and race conditions
2. **Default behavior:** Use "new resumes only" strategy to avoid breaking existing user documents

### Areas to Monitor

1. **Race conditions** between auto-save and manual save operations
2. **React concurrent mode** edge cases with double-RAF timing
3. **User feedback** on auto-fit behavior for edge cases (extremely long content)

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
6. Eager persistence (requires above to be stable)
```

---

## Open Questions

### For Product Decision

1. Should users see a notification when auto-fit adjusts their styles?
2. Should there be an "undo auto-fit" action?
3. What happens when content cannot fit even at minimum sizes?

### For Technical Validation

1. Test double-RAF behavior under React concurrent mode
2. Measure actual reflow cost on low-end devices
3. Validate binary search accuracy across font families
