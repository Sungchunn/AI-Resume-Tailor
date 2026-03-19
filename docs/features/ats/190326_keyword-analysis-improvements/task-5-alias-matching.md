# Task 5: Add Synonym / Alias Matching

**Status:** Pending
**Priority:** 3
**Effort:** 1-2 hrs
**Impact:** High
**Dependencies:** New file + matcher change

---

## Overview

The system currently does exact matching. "JavaScript" in the JD won't match "JS" in the resume. Add an alias dictionary and resolve before matching.

---

## Files to Modify

| File | Action |
| ---- | ------ |
| `/backend/app/services/job/ats/constants/aliases.py` | **Create new file** |
| `/backend/app/services/job/ats/analyzers/keyword/matcher.py` | Integrate alias lookup |

---

## New File: aliases.py

```python
"""
Keyword alias mappings for ATS keyword matching.

Maps canonical forms to their common aliases/abbreviations.
Both the canonical form and all aliases are checked during matching.
"""

# Canonical form -> list of aliases
# Matching should check all forms (canonical + aliases)
KEYWORD_ALIASES: dict[str, list[str]] = {
    # Programming Languages
    "javascript": ["js", "es6", "es2015", "ecmascript"],
    "typescript": ["ts"],
    "python": ["py", "python3"],
    "golang": ["go"],
    "c++": ["cpp", "cplusplus"],
    "c#": ["csharp", "c sharp"],

    # Frameworks & Libraries
    "react": ["reactjs", "react.js"],
    "node": ["nodejs", "node.js"],
    "vue": ["vuejs", "vue.js"],
    "next.js": ["nextjs", "next"],
    "angular": ["angularjs", "angular.js"],
    "express": ["expressjs", "express.js"],
    "fastapi": ["fast api"],
    "spring boot": ["springboot"],

    # Databases
    "postgresql": ["postgres", "psql", "pg"],
    "mongodb": ["mongo"],
    "mysql": ["my sql"],
    "elasticsearch": ["elastic", "es"],
    "redis": ["redis cache"],

    # Cloud & Infrastructure
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "microsoft azure": ["azure"],
    "kubernetes": ["k8s"],
    "docker": ["containerization", "containers"],
    "terraform": ["tf"],

    # DevOps & CI/CD
    "continuous integration": ["ci"],
    "continuous deployment": ["cd"],
    "ci/cd": ["ci cd", "cicd", "continuous integration/continuous deployment"],
    "github actions": ["gha"],
    "gitlab ci": ["gitlab-ci"],
    "jenkins": ["jenkins ci"],

    # APIs & Protocols
    "rest api": ["restful", "rest apis", "restful api", "rest"],
    "graphql": ["gql", "graph ql"],
    "grpc": ["g rpc"],

    # AI/ML
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
    "natural language processing": ["nlp"],
    "large language model": ["llm", "llms"],
    "deep learning": ["dl"],

    # Methodologies
    "agile": ["agile methodology", "scrum", "kanban"],
    "test driven development": ["tdd"],
    "behavior driven development": ["bdd"],

    # Tools
    "visual studio code": ["vscode", "vs code"],
    "intellij": ["intellij idea"],
    "postman": ["postman api"],

    # Add more as needed - aim for 50-100 entries
}

# Build reverse lookup: alias -> canonical
# This allows looking up any form and getting the canonical version
ALIAS_TO_CANONICAL: dict[str, str] = {}
for canonical, aliases in KEYWORD_ALIASES.items():
    ALIAS_TO_CANONICAL[canonical.lower()] = canonical
    for alias in aliases:
        ALIAS_TO_CANONICAL[alias.lower()] = canonical
```

---

## Matcher Integration

**In matcher.py:**

```python
from dataclasses import dataclass
from ..constants.aliases import ALIAS_TO_CANONICAL, KEYWORD_ALIASES


@dataclass
class MatchResult:
    """Result of searching for a keyword in resume text."""
    matched: bool
    canonical_keyword: str
    matched_as: str | None = None  # Which form was actually found
    section: str | None = None
    location: str | None = None


def find_keyword_in_resume(keyword: str, resume_text: str) -> MatchResult:
    """
    Check for keyword OR any of its aliases in the resume.
    Returns which form was matched for display purposes.

    Args:
        keyword: The keyword to search for (from job description)
        resume_text: The resume text to search in

    Returns:
        MatchResult with matched=True if found, including which form matched
    """
    # Normalize to canonical form
    canonical = ALIAS_TO_CANONICAL.get(keyword.lower(), keyword.lower())

    # Build list of all forms to check (canonical + aliases)
    forms_to_check = [canonical] + KEYWORD_ALIASES.get(canonical, [])

    for form in forms_to_check:
        if found := search_in_text(form, resume_text):
            return MatchResult(
                matched=True,
                canonical_keyword=canonical,
                matched_as=form,
                location=found.location,
            )

    return MatchResult(
        matched=False,
        canonical_keyword=canonical,
    )


def search_in_text(term: str, text: str) -> dict | None:
    """
    Search for a term in text with word boundary awareness.
    Returns location info if found, None otherwise.
    """
    import re

    # Escape special regex characters but allow word boundaries
    escaped = re.escape(term)
    pattern = rf'\b{escaped}\b'

    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return {"location": match.start()}
    return None
```

---

## UI Display Guidelines

When showing results to the user, indicate when an alias was matched:

```text
# If matched_as == canonical_keyword:
✓ Python — found in experience section

# If matched_as != canonical_keyword:
✓ Kubernetes — matched as "K8s" in experience section
✓ JavaScript — matched as "JS" in skills section
```

---

## Testing

### Test Case 1: Direct Match

```python
result = find_keyword_in_resume("python", "Experience with Python and Django")
assert result.matched == True
assert result.canonical_keyword == "python"
assert result.matched_as == "python"
```

### Test Case 2: Alias Match

```python
result = find_keyword_in_resume("javascript", "Built apps using JS and React")
assert result.matched == True
assert result.canonical_keyword == "javascript"
assert result.matched_as == "js"
```

### Test Case 3: Canonical from Alias

```python
result = find_keyword_in_resume("k8s", "Deployed services to Kubernetes cluster")
assert result.matched == True
assert result.canonical_keyword == "kubernetes"
assert result.matched_as == "kubernetes"
```

### Test Case 4: No Match

```python
result = find_keyword_in_resume("rust", "Experience with Python and Go")
assert result.matched == False
assert result.canonical_keyword == "rust"
```

---

## Maintenance Notes

1. **Adding new aliases:** Add to `KEYWORD_ALIASES` dict, reverse lookup is auto-generated
2. **Case sensitivity:** All lookups are case-insensitive
3. **Word boundaries:** Matching uses `\b` to avoid partial matches ("JS" won't match "JSON")
4. **Bidirectional:** If JD says "K8s" and resume says "Kubernetes", it will match
