"""AI Chat Routes for Resume Section Improvements."""

import asyncio
import json
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, resolve_ai_model
from app.schemas.ai import (
    BulletRewriteItem,
    BulletRewriteResult,
    ChatRequest,
    ChatResponse,
    ImproveSectionRequest,
    ImproveSectionResponse,
    RewriteResumeRequest,
    RewriteResumeResponse,
    RewriteStats,
    SummaryRewriteResult,
)
from app.services.ai import get_usage_tracker
from app.services.ai.client import get_ai_client_for_model

router = APIRouter()


SECTION_IMPROVEMENT_SYSTEM_PROMPT = """You are an expert resume writing assistant. Your job is to improve resume sections based on user instructions.

Rules:
1. PRESERVE truthfulness - never invent experience or skills that aren't present
2. Use strong action verbs and quantifiable achievements where possible
3. Keep the same general structure unless asked to change it
4. Be concise and impactful - every word should add value
5. Match professional tone appropriate for resumes
6. If the content is JSON, return improved JSON in the same structure
7. Focus on the specific improvement requested

Output format:
Return ONLY a JSON object with this structure:
{
  "improved_content": "The improved section content (string or JSON string)",
  "changes_summary": "Brief explanation of what was changed and why",
  "suggestions": ["Additional suggestion 1", "Additional suggestion 2"]
}"""


CHAT_SYSTEM_PROMPT = """You are an expert resume writing assistant having a conversation with a user about improving their resume.

Your role:
1. Provide helpful advice about resume writing
2. When asked to improve content, provide specific improvements
3. Ask clarifying questions when needed
4. Be concise but thorough
5. Focus on actionable, practical advice

When the user asks you to improve specific content, you should:
- Return the improved content in your response
- Explain why you made the changes
- Offer additional suggestions if relevant

Output format:
Return ONLY a JSON object with this structure:
{
  "message": "Your response message to the user",
  "improved_content": "Improved content if applicable, null otherwise",
  "action_type": "advice" | "improvement" | "question"
}

If you're providing improved content, set action_type to "improvement" and include the improved text in improved_content.
If you're asking a clarifying question, set action_type to "question".
Otherwise, set action_type to "advice"."""


def parse_ai_json_response(response: str) -> dict:
    """Parse AI response, handling potential markdown code blocks."""
    # Try direct JSON parse first
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError("Failed to parse AI response as JSON")


@router.post("/improve-section", response_model=ImproveSectionResponse)
async def improve_section(
    request: ImproveSectionRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ImproveSectionResponse:
    """Improve a resume section using AI based on user instructions.

    This endpoint takes a section's current content and an instruction,
    then returns an AI-improved version of that section.
    """
    model = await resolve_ai_model(current_user_id, db, "general")
    ai_client = get_ai_client_for_model(model)
    usage_tracker = get_usage_tracker()

    # Build the user prompt
    job_context_text = ""
    if request.job_context:
        job_context_text = f"\n\nJob Context (tailor improvements towards this role):\n{request.job_context[:2000]}"

    user_prompt = f"""Please improve this {request.section_type} section of a resume.

Current Content:
{request.section_content}

User Instruction: {request.instruction}{job_context_text}

Improve the content according to the user's instruction while maintaining accuracy."""

    try:
        ai_response = await ai_client.generate_json_with_metrics(
            system_prompt=SECTION_IMPROVEMENT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
        )

        # Log AI usage
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint="/ai/improve-section",
            response=ai_response,
        )
        await db.commit()

        result = parse_ai_json_response(ai_response.content)

        return ImproveSectionResponse(
            improved_content=result.get("improved_content", request.section_content),
            changes_summary=result.get("changes_summary", "Content improved as requested."),
            suggestions=result.get("suggestions", []),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse AI response: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Conversational AI chat for resume improvement.

    Supports multi-turn conversations about resume improvements,
    with optional section context for targeted advice.
    """
    model = await resolve_ai_model(current_user_id, db, "general")
    ai_client = get_ai_client_for_model(model)
    usage_tracker = get_usage_tracker()

    # Build conversation context
    context_parts = []

    if request.section_type:
        context_parts.append(f"Current section being discussed: {request.section_type}")

    if request.section_content:
        context_parts.append(f"Section content:\n{request.section_content[:3000]}")

    if request.job_context:
        context_parts.append(f"Target job description:\n{request.job_context[:2000]}")

    context_text = "\n\n".join(context_parts) if context_parts else "No specific section context provided."

    # Build chat history
    history_text = ""
    if request.chat_history:
        history_messages = []
        for msg in request.chat_history[-10:]:  # Keep last 10 messages
            role_label = "User" if msg.role == "user" else "Assistant"
            history_messages.append(f"{role_label}: {msg.content}")
        history_text = "\n\nConversation history:\n" + "\n".join(history_messages)

    user_prompt = f"""Context:
{context_text}{history_text}

User's current message: {request.message}

Respond helpfully to the user's message."""

    try:
        ai_response = await ai_client.generate_json_with_metrics(
            system_prompt=CHAT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
        )

        # Log AI usage
        await usage_tracker.log_generation(
            db=db,
            user_id=current_user_id,
            endpoint="/ai/chat",
            response=ai_response,
        )
        await db.commit()

        result = parse_ai_json_response(ai_response.content)

        return ChatResponse(
            message=result.get("message", "I can help you improve your resume. What would you like to work on?"),
            improved_content=result.get("improved_content"),
            action_type=result.get("action_type", "advice"),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse AI response: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


# ─── Rewrite Resume ───────────────────────────────────────────────────────────

BULLET_REWRITE_SYSTEM_PROMPT = """You are an expert resume writer optimizing bullets for ATS and recruiter impact.

Rules:
1. Start with a strong, specific action verb
2. Add quantified outcomes (metrics, percentages, scale) where plausible from context
3. Naturally incorporate provided keywords — never stuff them awkwardly
4. Keep to a single line (under 120 characters when possible)
5. Preserve factual accuracy — never invent numbers or companies
6. If the bullet is already optimal, return it unchanged

Return ONLY valid JSON, no markdown:
{
  "proposed": "The rewritten bullet text",
  "reason": "One sentence explaining the improvement",
  "impact": "high" | "medium" | "low",
  "keywords_added": ["keyword1", "keyword2"]
}

Impact levels:
- high: Adds quantification or directly targets a key job requirement
- medium: Improves verb strength, clarity, or keyword coverage
- low: Minor wording polish with little measurable effect"""


SUMMARY_REWRITE_SYSTEM_PROMPT = """You are an expert resume writer optimizing professional summaries.

Rules:
1. Keep to 2-3 sentences maximum
2. Mirror the language register of the job description
3. Lead with the candidate's strongest match to the role
4. Weave in top keywords naturally — no keyword stuffing
5. Remove filler phrases ("results-driven", "passionate about", "team player")
6. Preserve factual accuracy

Return ONLY valid JSON, no markdown:
{
  "proposed": "The rewritten summary text",
  "reason": "One sentence explaining the improvement"
}"""


async def _rewrite_bullet(
    bullet: BulletRewriteItem,
    job_description: str,
    missing_keywords: list[str],
    ai_client,
) -> tuple[BulletRewriteResult, object]:
    """Rewrite a single bullet and return (result, ai_response) for usage logging."""
    keyword_hint = ""
    if missing_keywords:
        top_keywords = ", ".join(missing_keywords[:8])
        keyword_hint = f"\nKeywords to incorporate (if natural): {top_keywords}"

    user_prompt = f"""Bullet to rewrite:
{bullet.text}

Role context: {bullet.entry_context.title} at {bullet.entry_context.company}{keyword_hint}

Job description (excerpt):
{job_description[:2000]}"""

    ai_response = await ai_client.generate_json_with_metrics(
        system_prompt=BULLET_REWRITE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        max_tokens=512,
    )

    try:
        result = parse_ai_json_response(ai_response.content)
        proposed = result.get("proposed", bullet.text).strip()
        reason = result.get("reason", "Improved for job alignment")
        impact = result.get("impact", "medium").lower()
        if impact not in ("high", "medium", "low"):
            impact = "medium"
        keywords_added = result.get("keywords_added", [])
        if not isinstance(keywords_added, list):
            keywords_added = []
    except (ValueError, AttributeError):
        proposed = bullet.text
        reason = "No improvement generated"
        impact = "low"
        keywords_added = []

    return (
        BulletRewriteResult(
            element_id=bullet.element_id,
            original=bullet.text,
            proposed=proposed,
            reason=reason,
            impact=impact,
            keywords_added=keywords_added,
        ),
        ai_response,
    )


async def _rewrite_summary(
    summary_text: str,
    job_description: str,
    missing_keywords: list[str],
    ai_client,
) -> tuple[SummaryRewriteResult, object]:
    """Rewrite the summary and return (result, ai_response) for usage logging."""
    keyword_hint = ""
    if missing_keywords:
        top_keywords = ", ".join(missing_keywords[:6])
        keyword_hint = f"\nTop keywords to incorporate: {top_keywords}"

    user_prompt = f"""Current summary:
{summary_text}{keyword_hint}

Job description (excerpt):
{job_description[:2000]}"""

    ai_response = await ai_client.generate_json_with_metrics(
        system_prompt=SUMMARY_REWRITE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        max_tokens=512,
    )

    try:
        result = parse_ai_json_response(ai_response.content)
        proposed = result.get("proposed", summary_text).strip()
        reason = result.get("reason", "Aligned summary with job description")
    except (ValueError, AttributeError):
        proposed = summary_text
        reason = "No improvement generated"

    return (
        SummaryRewriteResult(original=summary_text, proposed=proposed, reason=reason),
        ai_response,
    )


@router.post("/rewrite-resume", response_model=RewriteResumeResponse)
async def rewrite_resume(
    request: RewriteResumeRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RewriteResumeResponse:
    """Rewrite an entire resume targeted at a specific job description.

    Rewrites all bullets and optionally the summary in parallel, then returns
    proposed changes for the user to review inline on the preview.
    """
    model = await resolve_ai_model(current_user_id, db, "general")
    ai_client = get_ai_client_for_model(model)
    usage_tracker = get_usage_tracker()

    bullet_tasks = []
    if request.options.rewrite_bullets and request.bullets:
        for bullet in request.bullets:
            bullet_tasks.append(
                _rewrite_bullet(bullet, request.job_description, request.missing_keywords, ai_client)
            )

    summary_task = None
    if request.options.rewrite_summary and request.summary:
        summary_task = _rewrite_summary(
            request.summary, request.job_description, request.missing_keywords, ai_client
        )

    try:
        all_tasks = bullet_tasks + ([summary_task] if summary_task else [])
        results = await asyncio.gather(*all_tasks)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI rewrite failed: {str(e)}",
        )

    # Split results back into bullets and optional summary
    bullet_results: list[BulletRewriteResult] = []
    ai_responses = []
    for i, (result, ai_resp) in enumerate(results):
        if i < len(bullet_tasks):
            bullet_results.append(result)
        ai_responses.append(ai_resp)

    summary_result: SummaryRewriteResult | None = None
    if summary_task and results:
        summary_result, _ = results[-1]

    # Log aggregated usage
    for ai_resp in ai_responses:
        if ai_resp:
            await usage_tracker.log_generation(
                db=db,
                user_id=current_user_id,
                endpoint="/ai/rewrite-resume",
                response=ai_resp,
            )
    if ai_responses:
        await db.commit()

    changed = sum(1 for b in bullet_results if b.proposed != b.original)
    total_keywords = sum(len(b.keywords_added) for b in bullet_results)

    return RewriteResumeResponse(
        bullets=bullet_results,
        summary=summary_result,
        stats=RewriteStats(
            bullets_changed=changed,
            bullets_unchanged=len(bullet_results) - changed,
            keywords_added=total_keywords,
        ),
    )
