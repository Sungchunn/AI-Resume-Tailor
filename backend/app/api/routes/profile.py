"""Profile Routes for user profile operations."""

import json
import re
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db_session, get_mongo_db
from app.crud.mongo.resume import resume_crud
from app.models import User
from app.schemas.profile import GenerateAboutMeRequest, AboutMeResponse
from app.services import get_ai_client

router = APIRouter()


ABOUT_ME_SYSTEM_PROMPT = """You are a creative writer crafting personal biography blurbs.

Based on the resume content, write a warm, engaging 2-3 sentence "About Me" paragraph that:
1. Captures the person's professional identity and expertise
2. Highlights their career trajectory or achievements
3. Uses conversational, first-person tone
4. Feels authentic and personable

Keep it 50-100 words.

Output format:
Return ONLY a JSON object with this structure:
{
  "about_me": "The about me paragraph text"
}"""


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


@router.post("/generate-about-me", response_model=AboutMeResponse)
async def generate_about_me(
    request: GenerateAboutMeRequest,
    current_user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    mongo: Annotated[AsyncIOMotorDatabase, Depends(get_mongo_db)],
) -> AboutMeResponse:
    """Generate an AI-powered "About Me" blurb from the user's resume.

    Uses the master resume (or most recent if no master) to generate
    a personalized biography blurb for the library page.
    """
    # Get the user
    user = await db.get(User, current_user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if we already have a cached about_me and force_refresh is False
    if user.about_me and user.about_me_generated_at and not request.force_refresh:
        return AboutMeResponse(
            about_me=user.about_me,
            generated_at=user.about_me_generated_at,
        )

    # Get the master or latest resume
    # Include user_id in projection as it's required by ResumeDocument model
    resume = await resume_crud.get_master_or_latest(
        mongo,
        current_user_id,
        projection={
            "user_id": 1,
            "title": 1,
            "raw_content": 1,
            "parsed": 1,
        },
    )

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first.",
        )

    # Build the content for AI
    resume_content = ""
    if resume.parsed:
        # Use parsed data if available (more structured)
        # Convert Pydantic model to dict before JSON serialization
        resume_content = json.dumps(resume.parsed.model_dump(), indent=2)[:8000]
    elif resume.raw_content:
        # Fall back to raw content
        resume_content = resume.raw_content[:8000]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no content. Please upload a resume with content.",
        )

    # Generate the about me blurb
    ai_client = get_ai_client()

    user_prompt = f"""Please write a personal "About Me" paragraph based on this resume:

{resume_content}

Remember: Write in first person, be warm and engaging, and keep it 50-100 words."""

    try:
        response = await ai_client.generate_json(
            system_prompt=ABOUT_ME_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=500,
        )

        result = parse_ai_json_response(response)
        about_me_text = result.get("about_me", "")

        if not about_me_text:
            raise ValueError("AI did not return an about_me field")

        # Update the user record
        now = datetime.now(timezone.utc)
        user.about_me = about_me_text
        user.about_me_generated_at = now
        await db.commit()

        return AboutMeResponse(
            about_me=about_me_text,
            generated_at=now,
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
