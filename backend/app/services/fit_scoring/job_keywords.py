"""
Job-description keyword extraction for fit pre-scoring.

One AI call per JobListing at import time; the result is cached on the
``job_listings.extracted_keywords`` JSONB column and reused across every
user-job scoring pair.
"""

import json
import logging
from datetime import datetime, timezone

from app.services.ai.client import get_ai_client
from app.services.ai.response import AIResponse

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are extracting keywords from a job description for a
lightweight ATS fit-scoring feature.

Return a flat JSON object with a single key "keywords" whose value is an array
of lowercase strings. Include:
- Technical skills (languages, frameworks, tools, libraries)
- Methodologies (agile, scrum, ci/cd, tdd)
- Role-relevant domain terms (rest apis, microservices, data pipelines)
- Notable qualifications or certifications

Exclude:
- Generic words (experience, ability, skills, work, team)
- Soft qualifiers (strong, excellent, proven)
- Company or location names

Keep the list focused: 15-25 of the most important keywords, lowercase,
de-duplicated.

Respond with ONLY the JSON object — no prose, no markdown."""


async def extract_job_keywords(
    description: str,
) -> tuple[list[str], AIResponse | None]:
    """Extract lowercase keywords from a job description.

    Returns:
        ``(keywords, ai_response)`` — ``ai_response`` is ``None`` if the
        call or parse failed and the caller should treat the extraction as
        unsuccessful (do NOT persist empty keywords).
    """
    client = get_ai_client()

    try:
        response = await client.generate_json_with_metrics(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=f"Job description:\n\n{description}",
            max_tokens=600,
        )
    except Exception:
        logger.exception("fit-scoring: AI extraction failed")
        return [], None

    try:
        parsed = json.loads(response.content)
    except json.JSONDecodeError:
        logger.warning("fit-scoring: AI returned non-JSON content: %s", response.content[:200])
        return [], None

    raw = parsed.get("keywords") if isinstance(parsed, dict) else None
    if not isinstance(raw, list):
        return [], None

    seen: set[str] = set()
    keywords: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        normalized = item.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        keywords.append(normalized)

    return keywords, response


def build_keywords_payload(keywords: list[str]) -> dict:
    """Wrap a keyword list with an ``extracted_at`` timestamp for storage."""
    return {
        "keywords": keywords,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }
