"""
CRUD operations for JobListing and UserJobInteraction models.

Provides repository-style operations with advanced filtering,
full-text search, and user interaction tracking.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import Integer, and_, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job_listing import JobListing
from app.models.user_job_interaction import UserJobInteraction
from app.schemas.job_listing import (
    ApifyJobListing,
    JobListingCreate,
    JobListingFilters,
    JobListingUpdate,
    SortBy,
    SortOrder,
    WebhookJobListing,
)

logger = logging.getLogger(__name__)


class JobListingRepository:
    """Repository for JobListing operations."""

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: JobListingCreate,
    ) -> JobListing:
        """Create a new job listing."""
        db_obj = JobListing(
            external_job_id=obj_in.external_job_id,
            job_title=obj_in.job_title,
            company_name=obj_in.company_name,
            company_url=obj_in.company_url,
            company_logo=obj_in.company_logo,
            location=obj_in.location,
            city=obj_in.city,
            state=obj_in.state,
            country=obj_in.country,
            is_remote=obj_in.is_remote,
            seniority=obj_in.seniority,
            job_function=obj_in.job_function,
            industry=obj_in.industry,
            job_description=obj_in.job_description,
            job_url=obj_in.job_url,
            job_url_direct=obj_in.job_url_direct,
            job_type=obj_in.job_type,
            emails=obj_in.emails,
            easy_apply=obj_in.easy_apply,
            applicants_count=obj_in.applicants_count,
            salary_min=obj_in.salary_min,
            salary_max=obj_in.salary_max,
            salary_currency=obj_in.salary_currency,
            salary_period=obj_in.salary_period,
            date_posted=obj_in.date_posted,
            scraped_at=obj_in.scraped_at,
            source_platform=obj_in.source_platform,
            region=obj_in.region,
            last_synced_at=obj_in.last_synced_at,
            is_active=obj_in.is_active,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get(self, db: AsyncSession, *, id: int) -> JobListing | None:
        """Get a job listing by ID."""
        result = await db.execute(
            select(JobListing).where(JobListing.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_external_id(
        self, db: AsyncSession, *, external_job_id: str
    ) -> JobListing | None:
        """Get a job listing by external ID."""
        result = await db.execute(
            select(JobListing).where(JobListing.external_job_id == external_job_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        filters: JobListingFilters,
        user_id: int | None = None,
    ) -> tuple[list[JobListing], int]:
        """
        List job listings with filtering and pagination.

        Returns tuple of (listings, total_count).
        """
        query = select(JobListing)
        count_query = select(func.count(JobListing.id))

        # Build filter conditions
        conditions = []

        # Active only filter
        if filters.active_only:
            conditions.append(JobListing.is_active == True)

        # Location filter
        if filters.location:
            locations = [loc.strip() for loc in filters.location.split(",")]
            location_conditions = [
                JobListing.location.ilike(f"%{loc}%") for loc in locations
            ]
            conditions.append(or_(*location_conditions))
        elif filters.locations:
            location_conditions = [
                JobListing.location.ilike(f"%{loc}%") for loc in filters.locations
            ]
            conditions.append(or_(*location_conditions))

        # Seniority filter
        if filters.seniority:
            seniorities = [s.strip().lower() for s in filters.seniority.split(",")]
            seniority_conditions = [
                func.lower(JobListing.seniority) == s for s in seniorities
            ]
            conditions.append(or_(*seniority_conditions))
        elif filters.seniorities:
            seniority_conditions = [
                func.lower(JobListing.seniority) == s.lower() for s in filters.seniorities
            ]
            conditions.append(or_(*seniority_conditions))

        # Region filter (multi-select)
        if filters.region:
            regions = [r.strip() for r in filters.region.split(",")]
            region_conditions = [
                JobListing.region.ilike(f"%{r}%") for r in regions
            ]
            conditions.append(or_(*region_conditions))

        # Remote filter
        if filters.is_remote is not None:
            conditions.append(JobListing.is_remote == filters.is_remote)

        # Easy Apply filter
        if filters.easy_apply is not None:
            conditions.append(JobListing.easy_apply == filters.easy_apply)

        # Applicant count filter
        if filters.applicants_max is not None:
            if filters.applicants_include_na:
                # Include jobs with unknown count OR count <= max
                conditions.append(
                    or_(
                        JobListing.applicants_count.is_(None),
                        JobListing.applicants_count == "",
                        cast(JobListing.applicants_count, Integer) <= filters.applicants_max,
                    )
                )
            else:
                # Only jobs with known count <= max
                conditions.append(
                    cast(JobListing.applicants_count, Integer) <= filters.applicants_max
                )

        # Job function filter
        if filters.job_function:
            conditions.append(
                JobListing.job_function.ilike(f"%{filters.job_function}%")
            )

        # Industry filter
        if filters.industry:
            conditions.append(JobListing.industry.ilike(f"%{filters.industry}%"))

        # Salary filters
        if filters.salary_min is not None:
            conditions.append(
                or_(
                    JobListing.salary_max >= filters.salary_min,
                    JobListing.salary_max.is_(None),
                )
            )
        if filters.salary_max is not None:
            conditions.append(
                or_(
                    JobListing.salary_min <= filters.salary_max,
                    JobListing.salary_min.is_(None),
                )
            )

        # Date posted filter
        if filters.date_posted_after:
            conditions.append(JobListing.date_posted >= filters.date_posted_after)

        # Full-text search using pg_trgm
        if filters.search:
            search_term = filters.search.strip()
            conditions.append(
                or_(
                    JobListing.job_title.ilike(f"%{search_term}%"),
                    JobListing.job_description.ilike(f"%{search_term}%"),
                    JobListing.company_name.ilike(f"%{search_term}%"),
                )
            )

        # User interaction filters (requires user_id)
        if user_id is not None:
            # Join with user interactions
            query = query.outerjoin(
                UserJobInteraction,
                and_(
                    UserJobInteraction.job_listing_id == JobListing.id,
                    UserJobInteraction.user_id == user_id,
                ),
            )
            count_query = count_query.outerjoin(
                UserJobInteraction,
                and_(
                    UserJobInteraction.job_listing_id == JobListing.id,
                    UserJobInteraction.user_id == user_id,
                ),
            )

            # Filter by saved status
            if filters.is_saved is not None:
                if filters.is_saved:
                    conditions.append(UserJobInteraction.is_saved == True)
                else:
                    conditions.append(
                        or_(
                            UserJobInteraction.is_saved == False,
                            UserJobInteraction.is_saved.is_(None),
                        )
                    )

            # Filter by hidden status
            if filters.is_hidden is not None:
                if filters.is_hidden:
                    conditions.append(UserJobInteraction.is_hidden == True)
                else:
                    conditions.append(
                        or_(
                            UserJobInteraction.is_hidden == False,
                            UserJobInteraction.is_hidden.is_(None),
                        )
                    )

            # Filter by applied status
            if filters.applied is not None:
                if filters.applied:
                    conditions.append(UserJobInteraction.applied_at.isnot(None))
                else:
                    conditions.append(UserJobInteraction.applied_at.is_(None))

        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply sorting
        sort_column = self._get_sort_column(filters.sort_by)
        if filters.sort_order == SortOrder.DESC:
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Apply pagination
        query = query.offset(filters.offset).limit(filters.limit)

        # Execute query
        result = await db.execute(query)
        listings = list(result.scalars().all())

        return listings, total

    def _get_sort_column(self, sort_by: SortBy):
        """Get the SQLAlchemy column for sorting."""
        mapping = {
            SortBy.DATE_POSTED: JobListing.date_posted,
            SortBy.SALARY_MIN: JobListing.salary_min,
            SortBy.SALARY_MAX: JobListing.salary_max,
            SortBy.COMPANY_NAME: JobListing.company_name,
            SortBy.JOB_TITLE: JobListing.job_title,
            SortBy.CREATED_AT: JobListing.created_at,
        }
        return mapping.get(sort_by, JobListing.date_posted)

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: JobListing,
        obj_in: JobListingUpdate,
    ) -> JobListing:
        """Update a job listing."""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def upsert_from_webhook(
        self,
        db: AsyncSession,
        *,
        job_data: WebhookJobListing,
    ) -> tuple[JobListing, bool]:
        """
        Insert or update a job listing from webhook data (legacy snake_case format).

        Returns tuple of (listing, is_created).
        """
        existing = await self.get_by_external_id(db, external_job_id=job_data.external_job_id)
        now = datetime.now(timezone.utc)

        if existing:
            # Update existing listing
            data = job_data.model_dump()
            for field, value in data.items():
                setattr(existing, field, value)
            existing.last_synced_at = now
            await db.flush()
            await db.refresh(existing)
            return existing, False
        else:
            # Create new listing
            create_data = JobListingCreate(**job_data.model_dump())
            new_listing = await self.create(db, obj_in=create_data)
            new_listing.last_synced_at = now
            await db.flush()
            await db.refresh(new_listing)
            return new_listing, True

    async def upsert_from_apify(
        self,
        db: AsyncSession,
        *,
        job_data: ApifyJobListing,
        source_platform: str = "linkedin",
    ) -> tuple[JobListing, bool]:
        """
        Insert or update a job listing from APIFY scraper data.

        Transforms APIFY camelCase fields to internal snake_case format.
        Returns tuple of (listing, is_created).
        """
        external_id = job_data.id
        existing = await self.get_by_external_id(db, external_job_id=external_id)
        now = datetime.now(timezone.utc)

        # Parse date fields that might be strings
        date_posted = None
        if job_data.datePosted:
            if isinstance(job_data.datePosted, str):
                try:
                    date_posted = datetime.fromisoformat(job_data.datePosted.replace("Z", "+00:00"))
                except ValueError:
                    logger.warning(f"Could not parse datePosted: {job_data.datePosted}")
            else:
                date_posted = job_data.datePosted

        scraped_at = None
        if job_data.scrapedAt:
            if isinstance(job_data.scrapedAt, str):
                try:
                    scraped_at = datetime.fromisoformat(job_data.scrapedAt.replace("Z", "+00:00"))
                except ValueError:
                    logger.warning(f"Could not parse scrapedAt: {job_data.scrapedAt}")
            else:
                scraped_at = job_data.scrapedAt

        # Extract compensation fields
        salary_min = None
        salary_max = None
        salary_currency = "USD"
        salary_period = None
        if job_data.compensation:
            salary_min = job_data.compensation.minAmount
            salary_max = job_data.compensation.maxAmount
            salary_currency = job_data.compensation.currency or "USD"
            salary_period = job_data.compensation.interval

        # Build the update/create data
        data = {
            "external_job_id": external_id,
            "job_title": job_data.title,
            "company_name": job_data.companyName,
            "company_url": job_data.companyUrl,
            "company_logo": job_data.companyLogo,
            "location": job_data.location,
            "city": job_data.city,
            "state": job_data.state,
            "country": job_data.country,
            "is_remote": job_data.isRemote or False,
            "seniority": job_data.jobLevel,
            "job_function": job_data.jobFunction,
            "industry": job_data.companyIndustry,
            "job_description": job_data.description,
            "job_url": job_data.jobUrl,
            "job_url_direct": job_data.jobUrlDirect,
            "job_type": job_data.jobType,
            "emails": job_data.emails,
            "easy_apply": job_data.easyApply or False,
            "applicants_count": job_data.applicantsCount,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": salary_currency,
            "salary_period": salary_period,
            "date_posted": date_posted,
            "scraped_at": scraped_at,
            "source_platform": source_platform,
            "region": job_data.region,
            "last_synced_at": now,
        }

        if existing:
            # Update existing listing
            for field, value in data.items():
                setattr(existing, field, value)
            await db.flush()
            await db.refresh(existing)
            return existing, False
        else:
            # Create new listing
            new_listing = JobListing(**data, is_active=True)
            db.add(new_listing)
            await db.flush()
            await db.refresh(new_listing)
            return new_listing, True

    async def deactivate(self, db: AsyncSession, *, id: int) -> bool:
        """Mark a job listing as inactive (soft delete)."""
        result = await db.execute(
            update(JobListing)
            .where(JobListing.id == id)
            .values(is_active=False)
        )
        await db.flush()
        return result.rowcount > 0

    async def count(
        self,
        db: AsyncSession,
        *,
        active_only: bool = True,
    ) -> int:
        """Count job listings."""
        query = select(func.count(JobListing.id))
        if active_only:
            query = query.where(JobListing.is_active == True)
        result = await db.execute(query)
        return result.scalar() or 0

    async def batch_upsert_from_apify(
        self,
        db: AsyncSession,
        *,
        jobs_data: list[ApifyJobListing],
        source_platform: str = "linkedin",
        batch_size: int = 100,
    ) -> tuple[int, int, list[dict]]:
        """
        Batch upsert job listings from APIFY scraper data.

        Uses PostgreSQL ON CONFLICT for efficient upserts with a single
        round-trip per batch instead of one per job.

        Args:
            db: Database session
            jobs_data: List of ApifyJobListing objects
            source_platform: Source platform identifier
            batch_size: Number of jobs to process per batch

        Returns:
            Tuple of (created_count, updated_count, errors)
        """
        from sqlalchemy.dialects.postgresql import insert

        created_count = 0
        updated_count = 0
        errors: list[dict] = []
        now = datetime.now(timezone.utc)

        # Process in batches
        for i in range(0, len(jobs_data), batch_size):
            batch = jobs_data[i : i + batch_size]
            values_list = []

            for job_data in batch:
                try:
                    # Parse date fields
                    date_posted = None
                    if job_data.datePosted:
                        if isinstance(job_data.datePosted, str):
                            try:
                                date_posted = datetime.fromisoformat(
                                    job_data.datePosted.replace("Z", "+00:00")
                                )
                            except ValueError:
                                pass
                        else:
                            date_posted = job_data.datePosted

                    scraped_at = None
                    if job_data.scrapedAt:
                        if isinstance(job_data.scrapedAt, str):
                            try:
                                scraped_at = datetime.fromisoformat(
                                    job_data.scrapedAt.replace("Z", "+00:00")
                                )
                            except ValueError:
                                pass
                        else:
                            scraped_at = job_data.scrapedAt

                    # Extract compensation
                    salary_min = None
                    salary_max = None
                    salary_currency = "USD"
                    salary_period = None
                    if job_data.compensation:
                        salary_min = job_data.compensation.minAmount
                        salary_max = job_data.compensation.maxAmount
                        salary_currency = job_data.compensation.currency or "USD"
                        salary_period = job_data.compensation.interval

                    values_list.append(
                        {
                            "external_job_id": job_data.id,
                            "job_title": job_data.title,
                            "company_name": job_data.companyName,
                            "company_url": job_data.companyUrl,
                            "company_logo": job_data.companyLogo,
                            "location": job_data.location,
                            "city": job_data.city,
                            "state": job_data.state,
                            "country": job_data.country,
                            "is_remote": job_data.isRemote or False,
                            "seniority": job_data.jobLevel,
                            "job_function": job_data.jobFunction,
                            "industry": job_data.companyIndustry,
                            "job_description": job_data.description,
                            "job_url": job_data.jobUrl,
                            "job_url_direct": job_data.jobUrlDirect,
                            "job_type": job_data.jobType,
                            "emails": job_data.emails,
                            "easy_apply": job_data.easyApply or False,
                            "applicants_count": job_data.applicantsCount,
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "salary_currency": salary_currency,
                            "salary_period": salary_period,
                            "date_posted": date_posted,
                            "scraped_at": scraped_at,
                            "source_platform": source_platform,
                            "region": job_data.region,
                            "last_synced_at": now,
                            "is_active": True,
                        }
                    )
                except Exception as e:
                    errors.append(
                        {
                            "job_id": getattr(job_data, "id", "unknown"),
                            "error": "parse_error",
                            "message": str(e),
                        }
                    )

            if not values_list:
                continue

            # Build upsert statement
            stmt = insert(JobListing).values(values_list)

            # ON CONFLICT DO UPDATE - update all fields except id and created_at
            update_cols = {
                col.name: col
                for col in stmt.excluded
                if col.name not in ("id", "external_job_id", "created_at")
            }

            stmt = stmt.on_conflict_do_update(
                index_elements=["external_job_id"],
                set_=update_cols,
            )

            # Execute and get result
            try:
                result = await db.execute(stmt)
                # Note: PostgreSQL doesn't easily distinguish created vs updated
                # in batch upserts, so we track this separately
                affected = result.rowcount
                # Approximate: assume new jobs > existing for first run
                # For more accuracy, would need to query existing IDs first
                created_count += affected
            except Exception as e:
                logger.error(f"Batch upsert error: {e}")
                errors.append(
                    {
                        "batch_start": i,
                        "batch_size": len(values_list),
                        "error": "db_error",
                        "message": str(e),
                    }
                )

        await db.flush()
        return created_count, updated_count, errors

    async def count_by_region(
        self,
        db: AsyncSession,
        *,
        active_only: bool = True,
    ) -> dict[str, int]:
        """Count job listings grouped by region."""
        query = select(JobListing.region, func.count(JobListing.id)).group_by(
            JobListing.region
        )
        if active_only:
            query = query.where(JobListing.is_active == True)
        result = await db.execute(query)
        return {region or "unknown": count for region, count in result.all()}


class UserJobInteractionRepository:
    """Repository for UserJobInteraction operations."""

    async def get_or_create(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
    ) -> UserJobInteraction:
        """Get existing interaction or create a new one."""
        result = await db.execute(
            select(UserJobInteraction).where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.job_listing_id == job_listing_id,
            )
        )
        interaction = result.scalar_one_or_none()

        if interaction is None:
            interaction = UserJobInteraction(
                user_id=user_id,
                job_listing_id=job_listing_id,
            )
            db.add(interaction)
            await db.flush()
            await db.refresh(interaction)

        return interaction

    async def get(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
    ) -> UserJobInteraction | None:
        """Get interaction for user and job."""
        result = await db.execute(
            select(UserJobInteraction).where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.job_listing_id == job_listing_id,
            )
        )
        return result.scalar_one_or_none()

    async def set_saved(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
        is_saved: bool,
    ) -> UserJobInteraction:
        """Set the saved status for a job listing."""
        interaction = await self.get_or_create(
            db, user_id=user_id, job_listing_id=job_listing_id
        )
        interaction.is_saved = is_saved
        await db.flush()
        await db.refresh(interaction)
        return interaction

    async def set_hidden(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
        is_hidden: bool,
    ) -> UserJobInteraction:
        """Set the hidden status for a job listing."""
        interaction = await self.get_or_create(
            db, user_id=user_id, job_listing_id=job_listing_id
        )
        interaction.is_hidden = is_hidden
        await db.flush()
        await db.refresh(interaction)
        return interaction

    async def set_applied(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
        applied: bool,
    ) -> UserJobInteraction:
        """Set the applied status for a job listing."""
        interaction = await self.get_or_create(
            db, user_id=user_id, job_listing_id=job_listing_id
        )
        if applied:
            interaction.applied_at = datetime.now(timezone.utc)
        else:
            interaction.applied_at = None
        await db.flush()
        await db.refresh(interaction)
        return interaction

    async def record_view(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
    ) -> UserJobInteraction:
        """Record that a user viewed a job listing."""
        interaction = await self.get_or_create(
            db, user_id=user_id, job_listing_id=job_listing_id
        )
        interaction.last_viewed_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(interaction)
        return interaction

    async def get_saved_jobs(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[UserJobInteraction]:
        """Get all saved jobs for a user."""
        result = await db.execute(
            select(UserJobInteraction)
            .where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.is_saved == True,
            )
            .options(selectinload(UserJobInteraction.job_listing))
            .offset(offset)
            .limit(limit)
            .order_by(UserJobInteraction.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_applied_jobs(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[UserJobInteraction]:
        """Get all applied jobs for a user."""
        result = await db.execute(
            select(UserJobInteraction)
            .where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.applied_at.isnot(None),
            )
            .options(selectinload(UserJobInteraction.job_listing))
            .offset(offset)
            .limit(limit)
            .order_by(UserJobInteraction.applied_at.desc())
        )
        return list(result.scalars().all())


# Module-level singleton instances
job_listing_repository = JobListingRepository()
user_job_interaction_repository = UserJobInteractionRepository()
