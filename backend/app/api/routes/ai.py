"""AI Chat Routes for Resume Section Improvements."""

import json
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.schemas.ai import (
    ImproveSectionRequest,
    ImproveSectionResponse,
    ChatRequest,
    ChatResponse,
)
from app.services import get_ai_client
from app.services.ai import get_usage_tracker

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
    ai_client = get_ai_client()
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
    ai_client = get_ai_client()
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
