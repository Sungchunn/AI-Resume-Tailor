import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.tailored_resume import TailoredResume
from app.models.resume import Resume


class TailoredResumeCRUD:
    """CRUD operations for tailored resumes."""

    async def create(
        self,
        db: AsyncSession,
        resume_id: int,
        job_id: int,
        tailored_content: dict,
        suggestions: list[dict],
        match_score: float,
    ) -> TailoredResume:
        """Create a new tailored resume."""
        db_obj = TailoredResume(
            resume_id=resume_id,
            job_id=job_id,
            tailored_content=json.dumps(tailored_content),
            suggestions=suggestions,
            match_score=match_score,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, id: int) -> TailoredResume | None:
        """Get a tailored resume by ID."""
        result = await db.execute(
            select(TailoredResume).where(TailoredResume.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_resume_and_job(
        self, db: AsyncSession, resume_id: int, job_id: int
    ) -> TailoredResume | None:
        """Get a tailored resume by resume and job IDs."""
        result = await db.execute(
            select(TailoredResume).where(
                TailoredResume.resume_id == resume_id,
                TailoredResume.job_id == job_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_resume(
        self, db: AsyncSession, resume_id: int, skip: int = 0, limit: int = 100
    ) -> list[TailoredResume]:
        """Get all tailored resumes for a specific resume."""
        result = await db.execute(
            select(TailoredResume)
            .where(TailoredResume.resume_id == resume_id)
            .offset(skip)
            .limit(limit)
            .order_by(TailoredResume.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_job(
        self, db: AsyncSession, job_id: int, skip: int = 0, limit: int = 100
    ) -> list[TailoredResume]:
        """Get all tailored resumes for a specific job."""
        result = await db.execute(
            select(TailoredResume)
            .where(TailoredResume.job_id == job_id)
            .offset(skip)
            .limit(limit)
            .order_by(TailoredResume.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_user(
        self, db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
    ) -> list[TailoredResume]:
        """Get all tailored resumes for a specific user (via resume ownership)."""
        result = await db.execute(
            select(TailoredResume)
            .join(Resume, TailoredResume.resume_id == Resume.id)
            .where(Resume.owner_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(TailoredResume.created_at.desc())
        )
        return list(result.scalars().all())

    async def delete(self, db: AsyncSession, id: int) -> None:
        """Delete a tailored resume."""
        result = await db.execute(
            select(TailoredResume).where(TailoredResume.id == id)
        )
        db_obj = result.scalar_one_or_none()
        if db_obj:
            await db.delete(db_obj)
            await db.commit()

    async def update(
        self,
        db: AsyncSession,
        id: int,
        tailored_content: dict | None = None,
        style_settings: dict | None = None,
        section_order: list[str] | None = None,
    ) -> TailoredResume | None:
        """Update a tailored resume's content, style, or section order."""
        result = await db.execute(
            select(TailoredResume).where(TailoredResume.id == id)
        )
        db_obj = result.scalar_one_or_none()
        if not db_obj:
            return None

        if tailored_content is not None:
            db_obj.tailored_content = json.dumps(tailored_content)
        if style_settings is not None:
            db_obj.style_settings = style_settings
        if section_order is not None:
            db_obj.section_order = section_order

        await db.commit()
        await db.refresh(db_obj)
        return db_obj


tailored_resume_crud = TailoredResumeCRUD()
