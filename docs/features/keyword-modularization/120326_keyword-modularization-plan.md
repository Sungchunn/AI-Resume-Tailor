# Modularize KeywordAnalyzer Plan

## Overview

Split the 1,116-line `keyword.py` into a focused `keyword/` subdirectory following the established pattern used by `/constants/` and `/models/`.

## Target Structure

```text
app/services/job/ats/analyzers/
├── __init__.py              # Updated: imports from keyword/
├── keyword/
│   ├── __init__.py          # Public API: exports KeywordAnalyzer
│   ├── analyzer.py          # Main orchestrator class (~350 lines)
│   ├── extractor.py         # AI keyword extraction (~180 lines)
│   ├── scorer.py            # Stage 2 weighted scoring (~100 lines)
│   ├── matcher.py           # Resume matching logic (~170 lines)
│   └── suggestions.py       # Suggestion generation (~150 lines)
```

## Method Distribution

| Module | Methods | Design |
| ------ | ------- | ------ |
| `extractor.py` | `extract_keywords()`, `extract_keywords_with_importance()`, `extract_keywords_with_importance_enhanced()` | Class (holds AI client) |
| `scorer.py` | `get_placement_weight()`, `get_density_multiplier()`, `get_recency_weight()`, `get_importance_weight()`, `calculate_keyword_weighted_score()` | Pure functions |
| `matcher.py` | `detect_section_type()`, `order_experiences_by_date()`, `find_keyword_matches()` | Pure functions |
| `suggestions.py` | `generate_keyword_suggestions()`, `generate_detailed_suggestions()`, `generate_enhanced_suggestions()` | Pure functions |
| `analyzer.py` | `analyze_keywords()`, `analyze_keywords_detailed()`, `analyze_keywords_enhanced()` | Class (orchestrates modules) |

## Implementation Steps

### Step 1: Create keyword/ directory structure

Create the new directory and empty `__init__.py`:

```text
backend/app/services/job/ats/analyzers/keyword/__init__.py
```

### Step 2: Create scorer.py (no dependencies on new modules)

Move scoring functions as standalone pure functions:

- `get_placement_weight(section: str) -> float`
- `get_density_multiplier(occurrence_count: int) -> float`
- `get_recency_weight(role_index: int | None) -> float`
- `get_importance_weight(importance: KeywordImportance) -> float`
- `calculate_keyword_weighted_score(matches, importance) -> tuple[float, float, float, float]`

Imports from `...constants` for weight constants.

### Step 3: Create matcher.py

Move matching functions:

- `detect_section_type(key: str) -> str`
- `order_experiences_by_date(experiences: list) -> list[tuple]`
- `find_keyword_matches(keyword: str, parsed_resume: dict) -> list[KeywordMatch]`

Imports `parse_date` from `..base`.

### Step 4: Create suggestions.py

Move suggestion functions:

- `generate_keyword_suggestions(missing_keywords, vault_blocks) -> list[str]`
- `generate_detailed_suggestions(required_missing, preferred_missing, available_in_vault, vault_blocks) -> list[str]`
- `generate_enhanced_suggestions(required_missing, strongly_preferred_missing, preferred_missing, available_in_vault, vault_blocks) -> list[str]`

### Step 5: Create extractor.py

Create `KeywordExtractor` class with AI client:

```python
class KeywordExtractor:
    def __init__(self):
        self._ai_client = get_ai_client()

    async def extract_keywords(self, job_description: str) -> list[str]
    async def extract_keywords_with_importance(self, job_description: str) -> list[dict]
    async def extract_keywords_with_importance_enhanced(self, job_description: str) -> list[dict]
```

### Step 6: Create analyzer.py (main orchestrator)

```python
class KeywordAnalyzer:
    def __init__(self):
        self._extractor = KeywordExtractor()

    @property
    def _ai_client(self):
        """Backward compatibility for test mocking."""
        return self._extractor._ai_client

    async def analyze_keywords(...) -> ATSReportData
    async def analyze_keywords_detailed(...) -> DetailedKeywordAnalysis
    async def analyze_keywords_enhanced(...) -> EnhancedKeywordAnalysis
```

The `_ai_client` property ensures tests using `patch.object(keyword_analyzer._ai_client, ...)` continue to work.

### Step 7: Update keyword/__init__.py

```python
from .analyzer import KeywordAnalyzer

__all__ = ["KeywordAnalyzer"]
```

### Step 8: Update analyzers/__init__.py

Change:

```python
from .keyword import KeywordAnalyzer
```

This import now resolves to `keyword/__init__.py` which exports from `keyword/analyzer.py`.

### Step 9: Delete old keyword.py

Remove the original flat file after tests pass.

## Files to Modify

| File | Action |
| ---- | ------ |
| `backend/app/services/job/ats/analyzers/keyword.py` | Delete (after migration) |
| `backend/app/services/job/ats/analyzers/__init__.py` | Update import path |
| `backend/app/services/job/ats/analyzers/keyword/__init__.py` | Create |
| `backend/app/services/job/ats/analyzers/keyword/analyzer.py` | Create |
| `backend/app/services/job/ats/analyzers/keyword/extractor.py` | Create |
| `backend/app/services/job/ats/analyzers/keyword/scorer.py` | Create |
| `backend/app/services/job/ats/analyzers/keyword/matcher.py` | Create |
| `backend/app/services/job/ats/analyzers/keyword/suggestions.py` | Create |

## Test Compatibility

Tests in `test_keywords.py` use:

- `from app.services.job.ats.analyzers import KeywordAnalyzer` - unchanged
- `patch.object(keyword_analyzer._ai_client, ...)` - works via `_ai_client` property

No test changes required.

## Verification

```bash
# Run keyword tests
poetry run pytest tests/services/ats/test_keywords.py -v

# Run all ATS tests to check integration
poetry run pytest tests/services/ats/ -v

# Verify imports work
poetry run python -c "from app.services.job.ats.analyzers import KeywordAnalyzer; print('OK')"
```
