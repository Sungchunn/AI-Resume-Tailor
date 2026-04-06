# Phase 2: Backend Endpoint + Service

**Goal:** Create the API endpoint and service for batch bullet analysis with ATS-aware suggestions.

---

## 2.1 Create API Route

**File:** `backend/app/api/routes/tailor/suggestions.py`

### Endpoint Definition

**Endpoint:** `POST /v1/tailor/{tailored_resume_id}/analyze-bullets`

**Authentication:** Required (JWT)

**Rate Limit:** 10 requests per minute per user (AI-intensive operation)

### Request/Response Schemas

```python
from pydantic import BaseModel, Field
from typing import Literal


class EntryContext(BaseModel):
    """Context about the experience/project entry containing the bullet."""
    title: str = Field(..., description="Job title or project name")
    company: str = Field(..., description="Company or organization name")
    date_range: str = Field(..., description="Date range string (e.g., 'Jan 2020 - Present')")


class BulletInput(BaseModel):
    """A single bullet point to analyze."""
    id: str = Field(..., description="Unique bullet ID (e.g., 'exp-0:entry-0:bullet-0')")
    text: str = Field(..., description="Current bullet text")
    entry_context: EntryContext


class KeywordGapInput(BaseModel):
    """A missing keyword from ATS analysis."""
    keyword: str
    importance: Literal["required", "strongly_preferred", "preferred", "nice_to_have"]


class ATSContextInput(BaseModel):
    """ATS analysis context to inform suggestions."""
    keyword_gaps: list[KeywordGapInput] = Field(default_factory=list)
    importance_map: dict[str, str] = Field(
        default_factory=dict,
        description="Keyword -> importance level mapping"
    )
    bullets_needing_metrics: list[str] = Field(
        default_factory=list,
        description="Bullet IDs flagged as lacking quantification"
    )
    bullets_with_weak_verbs: list[str] = Field(
        default_factory=list,
        description="Bullet IDs flagged for weak/passive language"
    )


class BulletAnalysisRequest(BaseModel):
    """Request body for bullet analysis."""
    bullets: list[BulletInput] = Field(..., min_length=1, max_length=50)
    ats_context: ATSContextInput


class BulletSuggestionResponse(BaseModel):
    """A single bullet improvement suggestion."""
    bullet_id: str
    original: str
    suggested: str
    reason: str = Field(..., description="Explanation of what was improved")
    impact: Literal["high", "medium", "low"]
    keywords_added: list[str] = Field(default_factory=list)
    metrics_added: bool = False


class AnalyzeBulletsResponse(BaseModel):
    """Response containing all suggestions."""
    suggestions: list[BulletSuggestionResponse]
    total_analyzed: int
    suggestions_count: int
    skipped_count: int = Field(
        description="Number of bullets that didn't need improvement"
    )
```

### Route Implementation

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user_id
from app.services.ai import get_ai_client, get_usage_tracker
from app.services.job.diff.bullet_analyzer import BulletAnalyzer
from app.models import TailoredResume
from app.schemas.tailor.suggestions import (
    BulletAnalysisRequest,
    AnalyzeBulletsResponse,
)

router = APIRouter(prefix="/tailor", tags=["tailor-suggestions"])


@router.post(
    "/{tailored_resume_id}/analyze-bullets",
    response_model=AnalyzeBulletsResponse,
)
async def analyze_bullets(
    tailored_resume_id: int,
    request: BulletAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """
    Analyze bullet points and suggest ATS-optimized improvements.

    Requires ATS analysis to be completed first for keyword-aware suggestions.
    """
    # 1. Validate user owns the tailored resume
    tailored = await db.get(TailoredResume, tailored_resume_id)
    if not tailored:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    if tailored.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Fetch job description
    job_description = await _fetch_job_description(
        db,
        job_id=tailored.job_id,
        job_listing_id=tailored.job_listing_id
    )
    if not job_description:
        raise HTTPException(
            status_code=400,
            detail="No job description available for this tailored resume"
        )

    # 3. Validate ATS context is provided (required prerequisite)
    if not request.ats_context.keyword_gaps:
        raise HTTPException(
            status_code=400,
            detail="ATS analysis required. Run ATS analysis before bullet suggestions."
        )

    # 4. Run bullet analysis
    ai_client = get_ai_client()
    usage_tracker = get_usage_tracker()
    analyzer = BulletAnalyzer(ai_client)

    suggestions, ai_response = await analyzer.analyze_batch(
        bullets=request.bullets,
        job_description=job_description,
        ats_context=request.ats_context,
        return_metrics=True,
    )

    # 5. Log AI usage (required per CLAUDE.md)
    await usage_tracker.log_generation(
        db=db,
        user_id=current_user_id,
        endpoint=f"/tailor/{tailored_resume_id}/analyze-bullets",
        response=ai_response,
    )
    await db.commit()

    # 6. Return response
    return AnalyzeBulletsResponse(
        suggestions=suggestions,
        total_analyzed=len(request.bullets),
        suggestions_count=len(suggestions),
        skipped_count=len(request.bullets) - len(suggestions),
    )


async def _fetch_job_description(
    db: AsyncSession,
    job_id: int | None,
    job_listing_id: int | None,
) -> str | None:
    """Fetch job description from user job or scraped listing."""
    if job_id:
        from app.models import Job
        job = await db.get(Job, job_id)
        return job.raw_content if job else None

    if job_listing_id:
        from app.models import JobListing
        listing = await db.get(JobListing, job_listing_id)
        return listing.job_description if listing else None

    return None
```

---

## 2.2 Create Bullet Analyzer Service

**File:** `backend/app/services/job/diff/bullet_analyzer.py`

### Service Class

```python
from __future__ import annotations

import json
from typing import TYPE_CHECKING

from app.services.ai.response import AIResponse, AccumulatedMetrics
from app.services.job.diff.prompts_ats import (
    BULLET_ANALYSIS_SYSTEM_PROMPT,
    build_bullet_analysis_user_prompt,
)
from app.schemas.tailor.suggestions import (
    BulletInput,
    ATSContextInput,
    BulletSuggestionResponse,
)

if TYPE_CHECKING:
    from app.services.ai.client import BaseAIClient


class BulletAnalyzer:
    """
    Analyzes resume bullet points and suggests ATS-optimized improvements.

    Uses ATS context (keyword gaps, content quality hints) to prioritize
    suggestions that address specific weaknesses.
    """

    BATCH_SIZE = 10  # Max bullets per LLM call
    MAX_JOB_DESC_CHARS = 3000  # Truncate long job descriptions

    def __init__(self, ai_client: "BaseAIClient"):
        self._ai_client = ai_client

    async def analyze_batch(
        self,
        bullets: list[BulletInput],
        job_description: str,
        ats_context: ATSContextInput,
        return_metrics: bool = False,
    ) -> (
        list[BulletSuggestionResponse]
        | tuple[list[BulletSuggestionResponse], AIResponse]
    ):
        """
        Analyze all bullets and return improvement suggestions.

        Batching strategy:
        - 1-10 bullets: Single LLM call
        - 11+ bullets: Chunk into groups of 10, process sequentially

        Args:
            bullets: List of bullets to analyze
            job_description: Full job description text
            ats_context: ATS analysis context with keyword gaps and hints
            return_metrics: If True, return (suggestions, AIResponse) tuple

        Returns:
            List of suggestions (only for bullets needing improvement)
            If return_metrics=True: (suggestions, aggregated AIResponse)
        """
        if not bullets:
            return ([], None) if return_metrics else []

        # Truncate job description if needed
        job_desc_truncated = job_description[: self.MAX_JOB_DESC_CHARS]

        # Process in batches
        all_suggestions: list[BulletSuggestionResponse] = []
        accumulated_metrics = AccumulatedMetrics()

        for i in range(0, len(bullets), self.BATCH_SIZE):
            batch = bullets[i : i + self.BATCH_SIZE]
            suggestions, response = await self._analyze_batch_internal(
                bullets=batch,
                job_description=job_desc_truncated,
                ats_context=ats_context,
            )
            all_suggestions.extend(suggestions)
            accumulated_metrics.add(response)

        if return_metrics:
            return all_suggestions, accumulated_metrics.to_ai_response()
        return all_suggestions

    async def _analyze_batch_internal(
        self,
        bullets: list[BulletInput],
        job_description: str,
        ats_context: ATSContextInput,
    ) -> tuple[list[BulletSuggestionResponse], AIResponse]:
        """Process a single batch of bullets."""
        user_prompt = build_bullet_analysis_user_prompt(
            bullets=bullets,
            job_description=job_description,
            ats_context=ats_context,
        )

        response = await self._ai_client.generate_json_with_metrics(
            system_prompt=BULLET_ANALYSIS_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4000,
        )

        suggestions = self._parse_response(response.content, bullets)
        return suggestions, response

    def _parse_response(
        self,
        content: str,
        original_bullets: list[BulletInput],
    ) -> list[BulletSuggestionResponse]:
        """Parse AI response into validated suggestions."""
        try:
            # Try direct JSON parse
            data = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: extract JSON from markdown code block
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
            if match:
                try:
                    data = json.loads(match.group(1))
                except json.JSONDecodeError:
                    return []
            else:
                return []

        if not isinstance(data, list):
            return []

        # Build lookup for validation
        bullet_lookup = {b.id: b.text for b in original_bullets}
        suggestions = []

        for item in data:
            if not isinstance(item, dict):
                continue

            bullet_id = item.get("bullet_id")
            if bullet_id not in bullet_lookup:
                continue

            # Validate suggestion is actually different
            suggested = item.get("suggested", "").strip()
            original = bullet_lookup[bullet_id]
            if suggested.lower() == original.lower():
                continue

            suggestions.append(
                BulletSuggestionResponse(
                    bullet_id=bullet_id,
                    original=original,
                    suggested=suggested,
                    reason=item.get("reason", "Improved for ATS optimization"),
                    impact=item.get("impact", "medium"),
                    keywords_added=item.get("keywords_added", []),
                    metrics_added=item.get("metrics_added", False),
                )
            )

        return suggestions
```

---

## 2.3 Create ATS-Aware Prompts

**File:** `backend/app/services/job/diff/prompts_ats.py`

### System Prompt

```python
BULLET_ANALYSIS_SYSTEM_PROMPT = """You are an expert resume writer optimizing bullet points for ATS (Applicant Tracking Systems) and hiring managers.

## Your Task

Analyze each bullet point and suggest improvements that:

1. **Add MEASURABLE METRICS**
   - Numbers, percentages, dollar amounts, timeframes
   - Examples: "increased by 25%", "$2M revenue", "3-month timeline"

2. **Use STRONG ACTION VERBS**
   - Start with powerful verbs: Led, Architected, Optimized, Delivered, Increased, Spearheaded
   - Avoid weak phrases: "Responsible for", "Helped with", "Worked on", "Assisted"

3. **Follow WHAT + HOW + IMPACT Structure**
   - "Did X using Y, resulting in Z"
   - Example: "Reduced deployment time by 60% by implementing CI/CD pipelines, enabling 3x faster release cycles"

4. **Naturally Integrate MISSING KEYWORDS**
   - Weave in keywords from the job description
   - Don't stuff - distribute across multiple bullets
   - Prioritize "required" and "strongly_preferred" keywords

## Rules

- **ONLY suggest changes for bullets that genuinely need improvement**
- If a bullet is already well-written, do NOT include it in output
- **Preserve the core meaning** - don't invent achievements or exaggerate
- **Distribute keywords** across multiple bullets (avoid keyword stuffing)
- Keep bullets concise: ideally under 150 characters (2 lines max)
- Maintain professional tone matching the resume's voice

## Impact Levels

- **HIGH**: Addresses a required/strongly_preferred keyword gap OR adds significant metrics
- **MEDIUM**: Improves quantification, action verbs, or structure
- **LOW**: Minor wording or clarity improvements only

## Output Format

Return a JSON array. Only include bullets that need improvement:

```json
[
  {
    "bullet_id": "exp-0:entry-0:bullet-0",
    "original": "Original text...",
    "suggested": "Improved text with metrics and keywords...",
    "reason": "Added metrics (25%), action verb (Led), keyword (Agile)",
    "impact": "high",
    "keywords_added": ["Agile", "stakeholder management"],
    "metrics_added": true
  }
]
```

If ALL bullets are already well-written, return an empty array: `[]`"""
```

### User Prompt Builder

```python
from app.schemas.tailor.suggestions import BulletInput, ATSContextInput


def build_bullet_analysis_user_prompt(
    bullets: list[BulletInput],
    job_description: str,
    ats_context: ATSContextInput,
) -> str:
    """Build the user prompt for bullet analysis."""

    # Format keyword gaps by importance
    keyword_gaps_formatted = _format_keyword_gaps(ats_context.keyword_gaps)

    # Format bullets needing attention
    flagged_metrics = ", ".join(ats_context.bullets_needing_metrics[:10]) or "None"
    flagged_verbs = ", ".join(ats_context.bullets_with_weak_verbs[:10]) or "None"

    # Format bullets for analysis
    bullets_formatted = _format_bullets(bullets)

    return f"""## Job Description

{job_description}

---

## Missing Keywords to Integrate (prioritized)

{keyword_gaps_formatted}

---

## Bullets Flagged for Improvement

- **Needing metrics:** {flagged_metrics}
- **Weak action verbs:** {flagged_verbs}

---

## Bullets to Analyze

{bullets_formatted}

---

Analyze each bullet and return suggestions in the specified JSON format. Only include bullets that genuinely need improvement."""


def _format_keyword_gaps(gaps: list) -> str:
    """Format keyword gaps grouped by importance."""
    if not gaps:
        return "No keyword gaps identified."

    by_importance = {
        "required": [],
        "strongly_preferred": [],
        "preferred": [],
        "nice_to_have": [],
    }

    for gap in gaps:
        level = gap.importance if hasattr(gap, "importance") else gap.get("importance", "preferred")
        keyword = gap.keyword if hasattr(gap, "keyword") else gap.get("keyword", "")
        if level in by_importance and keyword:
            by_importance[level].append(keyword)

    lines = []
    if by_importance["required"]:
        lines.append(f"**REQUIRED (highest priority):** {', '.join(by_importance['required'])}")
    if by_importance["strongly_preferred"]:
        lines.append(f"**Strongly Preferred:** {', '.join(by_importance['strongly_preferred'])}")
    if by_importance["preferred"]:
        lines.append(f"**Preferred:** {', '.join(by_importance['preferred'])}")
    if by_importance["nice_to_have"]:
        lines.append(f"**Nice-to-have:** {', '.join(by_importance['nice_to_have'])}")

    return "\n".join(lines) if lines else "No keyword gaps identified."


def _format_bullets(bullets: list[BulletInput]) -> str:
    """Format bullets for the prompt."""
    lines = []
    for bullet in bullets:
        ctx = bullet.entry_context
        lines.append(
            f"**[{bullet.id}]** ({ctx.title} @ {ctx.company}, {ctx.date_range})\n"
            f"> {bullet.text}\n"
        )
    return "\n".join(lines)
```

---

## 2.4 Register Route

**File:** `backend/app/api/routes/tailor/__init__.py`

### Changes Required

```python
from fastapi import APIRouter

from app.api.routes.tailor import suggestions  # Add this import

router = APIRouter()

# ... existing route includes ...

# Add suggestions router
router.include_router(suggestions.router)
```

---

## API Documentation Update

**File:** `docs/api/tailor.md` (create if doesn't exist)

```markdown
# Tailor API

## POST /v1/tailor/{id}/analyze-bullets

Analyze bullet points and suggest ATS-optimized improvements.

**Prerequisites:**
- User must own the tailored resume
- ATS analysis must be completed first (keyword_gaps required)

**Request:**

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| bullets | array | Yes | Bullets to analyze (max 50) |
| bullets[].id | string | Yes | Unique bullet ID |
| bullets[].text | string | Yes | Current bullet text |
| bullets[].entry_context.title | string | Yes | Job title |
| bullets[].entry_context.company | string | Yes | Company name |
| bullets[].entry_context.date_range | string | Yes | Date range |
| ats_context.keyword_gaps | array | Yes | Missing keywords from ATS |
| ats_context.bullets_needing_metrics | array | No | Bullet IDs lacking metrics |
| ats_context.bullets_with_weak_verbs | array | No | Bullet IDs with weak verbs |

**Response:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| suggestions | array | Improvement suggestions |
| suggestions[].bullet_id | string | Target bullet ID |
| suggestions[].original | string | Original text |
| suggestions[].suggested | string | Improved text |
| suggestions[].reason | string | Explanation |
| suggestions[].impact | string | high/medium/low |
| suggestions[].keywords_added | array | Keywords integrated |
| suggestions[].metrics_added | boolean | Whether metrics added |
| total_analyzed | int | Total bullets analyzed |
| suggestions_count | int | Number of suggestions |
| skipped_count | int | Bullets not needing changes |

**Error Responses:**

| Status | Detail |
| ------ | ------ |
| 400 | "ATS analysis required. Run ATS analysis before bullet suggestions." |
| 400 | "No job description available for this tailored resume" |
| 403 | "Not authorized" |
| 404 | "Tailored resume not found" |
```

---

## Verification

### Phase 2 Verification Checklist

- [ ] Endpoint accessible at `POST /v1/tailor/{id}/analyze-bullets`
- [ ] Authentication required (returns 401 without token)
- [ ] Authorization check (returns 403 for other user's resume)
- [ ] Validates ATS context required (returns 400 without keyword_gaps)
- [ ] Returns suggestions in correct format
- [ ] AI usage logged to database
- [ ] Batching works for >10 bullets
- [ ] Empty array returned when all bullets are good

### Test Commands

```bash
# Run backend tests
cd backend && poetry run pytest tests/api/routes/tailor/test_suggestions.py -v

# Manual API test
curl -X POST "http://localhost:8000/v1/tailor/1/analyze-bullets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bullets": [
      {
        "id": "exp-0:entry-0:bullet-0",
        "text": "Managed team projects",
        "entry_context": {
          "title": "Product Manager",
          "company": "Acme Corp",
          "date_range": "2020 - 2023"
        }
      }
    ],
    "ats_context": {
      "keyword_gaps": [
        {"keyword": "Agile", "importance": "required"}
      ],
      "bullets_needing_metrics": ["exp-0:entry-0:bullet-0"],
      "bullets_with_weak_verbs": []
    }
  }'
```
