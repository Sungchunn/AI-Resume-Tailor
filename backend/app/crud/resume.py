from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import Resume
from app.schemas.resume import ResumeCreate, ResumeUpdate


class ResumeCRUD:
    async def create(self, db: AsyncSession, *, obj_in: ResumeCreate, owner_id: int) -> Resume:
        db_obj = Resume(
            title=obj_in.title,
            raw_content=obj_in.raw_content,
            owner_id=owner_id,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, *, id: int) -> Resume | None:
        result = await db.execute(select(Resume).where(Resume.id == id))
        return result.scalar_one_or_none()

    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> list[Resume]:
        result = await db.execute(
            select(Resume)
            .where(Resume.owner_id == owner_id)
            .offset(skip)
            .limit(limit)
            .order_by(Resume.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(
        self, db: AsyncSession, *, db_obj: Resume, obj_in: ResumeUpdate
    ) -> Resume:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: int) -> bool:
        result = await db.execute(select(Resume).where(Resume.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            await db.delete(obj)
            await db.flush()
            return True
        return False


resume_crud = ResumeCRUD()
