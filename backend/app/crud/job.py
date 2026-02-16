from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import JobDescription
from app.schemas.job import JobCreate, JobUpdate


class JobCRUD:
    async def create(self, db: AsyncSession, *, obj_in: JobCreate, owner_id: int) -> JobDescription:
        db_obj = JobDescription(
            title=obj_in.title,
            company=obj_in.company,
            raw_content=obj_in.raw_content,
            url=obj_in.url,
            owner_id=owner_id,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, *, id: int) -> JobDescription | None:
        result = await db.execute(select(JobDescription).where(JobDescription.id == id))
        return result.scalar_one_or_none()

    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> list[JobDescription]:
        result = await db.execute(
            select(JobDescription)
            .where(JobDescription.owner_id == owner_id)
            .offset(skip)
            .limit(limit)
            .order_by(JobDescription.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(
        self, db: AsyncSession, *, db_obj: JobDescription, obj_in: JobUpdate
    ) -> JobDescription:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: int) -> bool:
        result = await db.execute(select(JobDescription).where(JobDescription.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            await db.delete(obj)
            await db.flush()
            return True
        return False


job_crud = JobCRUD()
