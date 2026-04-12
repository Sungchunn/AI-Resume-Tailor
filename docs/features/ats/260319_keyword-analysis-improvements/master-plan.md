# Stage 2: Keyword Analysis Improvement Plan

## Overview

This plan targets 7 changes to the keyword scoring pipeline. Each task is documented in its own file and can be implemented independently. Apply them in the recommended order since later tasks may reference earlier changes.

**Goal:** Improve keyword scoring accuracy by widening factor spreads, adding alias matching, and switching to an additive formula that limits error propagation.

---

## Task Index

| Priority | Task | File | Effort | Impact |
| -------- | ---- | ---- | ------ | ------ |
| 1 | Compress importance tiers | [task-4-importance-tiers.md](./task-4-importance-tiers.md) | 5 min | High |
| 2 | Widen placement weights | [task-1-placement-weights.md](./task-1-placement-weights.md) | 5 min | High |
| 3 | Add alias matching | [task-5-alias-matching.md](./task-5-alias-matching.md) | 1-2 hrs | High |
| 4 | Logarithmic density curve | [task-2-density-curve.md](./task-2-density-curve.md) | 30 min | Medium |
| 5 | Additive formula | [task-7-additive-formula.md](./task-7-additive-formula.md) | 1-2 hrs | High |
| 6 | Cross-section bonus | [task-6-cross-section-bonus.md](./task-6-cross-section-bonus.md) | 30 min | Medium |
| 7 | Date-based recency | [task-3-date-based-recency.md](./task-3-date-based-recency.md) | 1-2 hrs | Medium |

---

## Quick Start

**Zero-risk changes (do first):**

- Task 4: Compress importance tiers → pure constant change
- Task 1: Widen placement weights → pure constant change

**High-impact feature:**

- Task 5: Add alias matching → biggest UX improvement

**Structural change (do after tuning):**

- Task 7: Additive formula → most important for score stability

---

## Files Modified

| File | Tasks |
| ---- | ----- |
| `/backend/app/services/job/ats/constants/weights.py` | 1, 2, 3, 4, 6 |
| `/backend/app/services/job/ats/constants/aliases.py` | 5 (new file) |
| `/backend/app/services/job/ats/analyzers/keyword/scorer.py` | 2, 3, 6, 7 |
| `/backend/app/services/job/ats/analyzers/keyword/matcher.py` | 3, 5 |

---

## Dependency Graph

```text
Task 4 (importance tiers)  ──┐
Task 1 (placement weights) ──┼──▶ Task 7 (additive formula) ──▶ Task 6 (cross-section)
Task 2 (density curve)     ──┘
Task 5 (alias matching)    ──────▶ (independent)
Task 3 (date-based recency) ─────▶ (requires matcher changes)
```

---

## Testing Checklist

After implementing all tasks, validate with these test cases:

- [ ] **Alias test:** Resume says "JS" and "Node.js", JD says "JavaScript" and "Node". Both should match.
- [ ] **Placement test:** Same keyword in skills-only vs experience-only should produce ~2x score difference.
- [ ] **Cross-section test:** Keyword in both skills AND experience should score higher than experience alone.
- [ ] **Stability test:** Changing one keyword from "required" to "preferred" should swing total by <15%.
- [ ] **Edge case:** Resume with 0 matching keywords should return 0, not error.

---

## Architecture Reference

See [/docs/architecture/ats-scoring-architecture.md](/docs/architecture/ats-scoring-architecture.md) for:

- Full Stage 2 pipeline documentation
- Current scoring formula details
- API endpoint specifications
