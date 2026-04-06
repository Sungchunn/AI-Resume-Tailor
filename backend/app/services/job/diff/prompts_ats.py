"""
ATS-Aware Prompts for Bullet Analysis.

Prompts optimized for ATS keyword integration and content quality improvements.
"""

from app.schemas.tailor.suggestions import ATSContextInput, BulletInput

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

    by_importance: dict[str, list[str]] = {
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
