"""
CRUD operations for JobListing and UserJobInteraction models.

Provides repository-style operations with advanced filtering,
full-text search, and user interaction tracking.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import Integer, and_, cast, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job_listing import JobListing
from app.models.user_job_interaction import UserJobInteraction
from app.schemas.job_listing import (
    ApifyJobListing,
    ApplicationStatus,
    JobListingCreate,
    JobListingFilters,
    JobListingUpdate,
    SortBy,
    SortOrder,
    WebhookJobListing,
)
from app.utils.apify_helpers import (
    convert_employment_type,
    detect_remote,
    extract_company_address,
    normalize_url,
    parse_job_date,
    parse_location,
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
            company_logo=obj_in.company_logo,
            company_website=obj_in.company_website,
            company_description=obj_in.company_description,
            company_linkedin_url=obj_in.company_linkedin_url,
            company_address_locality=obj_in.company_address_locality,
            company_address_country=obj_in.company_address_country,
            location=obj_in.location,
            city=obj_in.city,
            state=obj_in.state,
            country=obj_in.country,
            is_remote=obj_in.is_remote,
            seniority=obj_in.seniority,
            job_function=obj_in.job_function,
            industry=obj_in.industry,
            job_description=obj_in.job_description,
            job_description_html=obj_in.job_description_html,
            job_url=obj_in.job_url,
            job_url_direct=obj_in.job_url_direct,
            apply_url=obj_in.apply_url,
            job_type=obj_in.job_type,
            emails=obj_in.emails,
            benefits=obj_in.benefits,
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

        # Country filter (multi-select)
        if filters.country:
            countries = [c.strip() for c in filters.country.split(",")]
            country_conditions = [
                JobListing.country.ilike(f"%{c}%") for c in countries
            ]
            conditions.append(or_(*country_conditions))

        # City filter (multi-select, exact match on normalized data)
        if filters.city:
            cities = [c.strip().lower() for c in filters.city.split(",")]
            city_conditions = [func.lower(JobListing.city) == c for c in cities]
            conditions.append(or_(*city_conditions))

        # Exclude city filter
        if filters.exclude_city:
            excluded_cities = [c.strip().lower() for c in filters.exclude_city.split(",")]
            for excluded_city in excluded_cities:
                conditions.append(
                    or_(
                        JobListing.city.is_(None),
                        func.lower(JobListing.city) != excluded_city,
                    )
                )

        # Exclude country filter
        if filters.exclude_country:
            excluded_countries = [c.strip() for c in filters.exclude_country.split(",")]
            for excluded_country in excluded_countries:
                conditions.append(
                    or_(
                        JobListing.country.is_(None),
                        ~JobListing.country.ilike(f"%{excluded_country}%"),
                    )
                )

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

        # Company name filter (dedicated filter separate from full-text search)
        if filters.company_name:
            conditions.append(
                JobListing.company_name.ilike(f"%{filters.company_name.strip()}%")
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

        # Use helper functions for data transformation
        date_posted = parse_job_date(job_data.postedAt)
        is_remote = detect_remote(job_data.location)
        job_type = convert_employment_type(job_data.employmentType)
        company_address_locality, company_address_country = extract_company_address(
            job_data.companyAddress
        )
        # Parse location to extract city, state, country
        city, state, country = parse_location(
            job_data.location,
            job_data.companyAddress,
        )

        # Build the update/create data
        data = {
            "external_job_id": external_id,
            "job_title": job_data.title,
            "company_name": job_data.companyName,
            "company_logo": normalize_url(job_data.companyLogo),
            "company_website": normalize_url(job_data.companyWebsite),
            "company_description": job_data.companyDescription,
            "company_linkedin_url": normalize_url(job_data.companyLinkedinUrl),
            "company_address_locality": company_address_locality,
            "company_address_country": company_address_country,
            "location": job_data.location,
            "city": city,
            "state": state,
            "country": country,
            "is_remote": is_remote,
            "seniority": job_data.seniorityLevel,
            "job_function": job_data.jobFunction,
            "industry": job_data.industries,
            "job_description": job_data.descriptionText,
            "job_description_html": job_data.descriptionHtml,
            "job_url": job_data.link,
            "job_url_direct": normalize_url(job_data.applyUrl),
            "apply_url": normalize_url(job_data.applyUrl),
            "job_type": job_type,
            "emails": None,  # Not provided by this actor
            "benefits": job_data.benefits,
            "easy_apply": not bool(job_data.applyUrl),  # Easy apply if no external URL
            "applicants_count": job_data.applicantsCount,
            "salary_min": None,  # Would need to parse from salaryInfo
            "salary_max": None,
            "salary_currency": "USD",
            "salary_period": None,
            "date_posted": date_posted,
            "scraped_at": now,
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

        logger.info(f"Starting batch upsert of {len(jobs_data)} jobs from {source_platform}")

        # Process in batches
        for i in range(0, len(jobs_data), batch_size):
            batch = jobs_data[i : i + batch_size]
            values_list = []

            for job_data in batch:
                try:
                    # Use helper functions for data transformation
                    date_posted = parse_job_date(job_data.postedAt)
                    is_remote = detect_remote(job_data.location)
                    job_type = convert_employment_type(job_data.employmentType)
                    company_address_locality, company_address_country = extract_company_address(
                        job_data.companyAddress
                    )
                    # Parse location to extract city, state, country
                    city, state, country = parse_location(
                        job_data.location,
                        job_data.companyAddress,
                    )

                    # Handle empty strings and normalize URLs
                    apply_url = normalize_url(job_data.applyUrl)
                    company_logo = normalize_url(job_data.companyLogo)
                    company_website = normalize_url(job_data.companyWebsite)
                    company_linkedin_url = normalize_url(job_data.companyLinkedinUrl)

                    values_list.append(
                        {
                            "external_job_id": job_data.id,
                            "job_title": job_data.title,
                            "company_name": job_data.companyName,
                            "company_logo": company_logo,
                            "company_website": company_website,
                            "company_description": job_data.companyDescription,
                            "company_linkedin_url": company_linkedin_url,
                            "company_address_locality": company_address_locality,
                            "company_address_country": company_address_country,
                            "location": job_data.location,
                            "city": city,
                            "state": state,
                            "country": country,
                            "is_remote": is_remote,
                            "seniority": job_data.seniorityLevel,
                            "job_function": job_data.jobFunction,
                            "industry": job_data.industries,
                            "job_description": job_data.descriptionText,
                            "job_description_html": job_data.descriptionHtml,
                            "job_url": job_data.link,
                            "job_url_direct": apply_url,
                            "apply_url": apply_url,
                            "job_type": job_type,
                            "emails": None,
                            "benefits": job_data.benefits if job_data.benefits else None,
                            "easy_apply": not bool(apply_url),
                            "applicants_count": job_data.applicantsCount if job_data.applicantsCount else None,
                            "salary_min": None,
                            "salary_max": None,
                            "salary_currency": "USD",
                            "salary_period": None,
                            "date_posted": date_posted,
                            "scraped_at": now,
                            "source_platform": source_platform,
                            "region": job_data.region,
                            "last_synced_at": now,
                            "is_active": True,
                        }
                    )
                except Exception as e:
                    logger.error(f"Parse error for job {getattr(job_data, 'id', 'unknown')}: {e}")
                    errors.append(
                        {
                            "job_id": getattr(job_data, "id", "unknown"),
                            "error": "parse_error",
                            "message": str(e),
                        }
                    )

            if not values_list:
                logger.warning(f"Batch {i // batch_size + 1}: all jobs failed parsing, skipping")
                continue

            logger.info(f"Batch {i // batch_size + 1}: prepared {len(values_list)} jobs for upsert")

            # Build upsert statement
            stmt = insert(JobListing).values(values_list)

            # ON CONFLICT DO UPDATE - update all fields except id and created_at
            # Use explicit column list from the values to ensure compatibility
            excluded_from_update = {"id", "external_job_id", "created_at"}
            update_cols = {}
            for key in values_list[0].keys():
                if key not in excluded_from_update:
                    update_cols[key] = stmt.excluded[key]

            stmt = stmt.on_conflict_do_update(
                index_elements=["external_job_id"],
                set_=update_cols,
            )

            # Execute within a savepoint to isolate batch failures
            # This prevents a single batch failure from aborting the entire transaction
            try:
                async with db.begin_nested():
                    result = await db.execute(stmt)
                    # Note: PostgreSQL doesn't easily distinguish created vs updated
                    # in batch upserts, so we track this separately
                    affected = result.rowcount
                    # Approximate: assume new jobs > existing for first run
                    # For more accuracy, would need to query existing IDs first
                    created_count += affected
                    logger.info(f"Batch {i // batch_size + 1}: upserted {affected} jobs successfully")
            except Exception as e:
                logger.error(f"Batch upsert error at index {i}: {e}", exc_info=True)
                errors.append(
                    {
                        "batch_start": i,
                        "batch_size": len(values_list),
                        "error": "db_error",
                        "message": str(e),
                    }
                )
                # Savepoint rollback is automatic on exception within begin_nested()
                # Transaction continues with next batch

        await db.flush()
        logger.info(f"Batch upsert complete: {created_count} affected, {len(errors)} errors")
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

    async def get_filter_options(
        self,
        db: AsyncSession,
        *,
        active_only: bool = True,
    ) -> dict[str, list[dict[str, str | int]]]:
        """
        Get available filter options based on existing data.

        Returns distinct values with counts for countries, regions,
        and seniority levels.
        """
        base_condition = JobListing.is_active == True if active_only else True

        # Get countries with counts
        country_query = (
            select(JobListing.country, func.count(JobListing.id).label("count"))
            .where(base_condition, JobListing.country.isnot(None))
            .group_by(JobListing.country)
            .order_by(func.count(JobListing.id).desc())
        )
        country_result = await db.execute(country_query)
        countries = [
            {"value": country, "label": country, "count": count}
            for country, count in country_result.all()
            if country
        ]

        # Get regions with counts
        region_query = (
            select(JobListing.region, func.count(JobListing.id).label("count"))
            .where(base_condition, JobListing.region.isnot(None))
            .group_by(JobListing.region)
            .order_by(func.count(JobListing.id).desc())
        )
        region_result = await db.execute(region_query)
        regions = [
            {"value": region, "label": region, "count": count}
            for region, count in region_result.all()
            if region
        ]

        # Get seniority levels with counts
        seniority_query = (
            select(JobListing.seniority, func.count(JobListing.id).label("count"))
            .where(base_condition, JobListing.seniority.isnot(None))
            .group_by(JobListing.seniority)
            .order_by(func.count(JobListing.id).desc())
        )
        seniority_result = await db.execute(seniority_query)
        seniorities = [
            {"value": seniority, "label": seniority, "count": count}
            for seniority, count in seniority_result.all()
            if seniority
        ]

        # Get cities with counts (limit to top 50)
        city_query = (
            select(JobListing.city, func.count(JobListing.id).label("count"))
            .where(base_condition, JobListing.city.isnot(None), JobListing.city != "")
            .group_by(JobListing.city)
            .order_by(func.count(JobListing.id).desc())
            .limit(50)
        )
        city_result = await db.execute(city_query)
        cities = [
            {"value": city, "label": city, "count": count}
            for city, count in city_result.all()
            if city
        ]

        return {
            "countries": countries,
            "regions": regions,
            "seniorities": seniorities,
            "cities": cities,
        }

    async def delete_expired(
        self,
        db: AsyncSession,
        *,
        retention_days: int,
    ) -> int:
        """
        Delete job listings older than the specified retention period.

        Uses hard delete based on created_at timestamp.

        Args:
            db: Database session
            retention_days: Number of days to retain jobs

        Returns:
            Number of jobs deleted
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

        result = await db.execute(
            delete(JobListing).where(JobListing.created_at < cutoff_date)
        )
        await db.flush()

        deleted_count = result.rowcount
        if deleted_count > 0:
            logger.info(
                f"Deleted {deleted_count} expired job listings "
                f"(older than {retention_days} days)"
            )

        return deleted_count


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
        now = datetime.now(timezone.utc)
        if applied:
            interaction.applied_at = now
            # Also set Kanban status if not already set
            if not interaction.application_status:
                interaction.application_status = ApplicationStatus.APPLIED.value
                interaction.status_changed_at = now
                interaction.column_position = 0
        else:
            interaction.applied_at = None
            interaction.application_status = None
            interaction.status_changed_at = None
            interaction.column_position = 0
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

    async def update_application_status(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        job_listing_id: int,
        status: ApplicationStatus,
    ) -> UserJobInteraction:
        """
        Update the application status for a job listing.

        Sets status_changed_at to current time and resets column_position to 0
        (bottom of the new column).
        """
        interaction = await self.get_or_create(
            db, user_id=user_id, job_listing_id=job_listing_id
        )

        now = datetime.now(timezone.utc)
        interaction.application_status = status.value
        interaction.status_changed_at = now

        # If this is the first time marking as applied, also set applied_at
        if status == ApplicationStatus.APPLIED and interaction.applied_at is None:
            interaction.applied_at = now

        # Get the max position in the target column and add to the end
        result = await db.execute(
            select(func.coalesce(func.max(UserJobInteraction.column_position), -1))
            .where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.application_status == status.value,
                UserJobInteraction.id != interaction.id,
            )
        )
        max_position = result.scalar() or -1
        interaction.column_position = max_position + 1

        await db.flush()
        await db.refresh(interaction)
        return interaction

    async def get_kanban_board(
        self,
        db: AsyncSession,
        *,
        user_id: int,
    ) -> dict[str, list[tuple[UserJobInteraction, JobListing]]]:
        """
        Get all applied jobs for a user grouped by application status.

        Returns a dict mapping status -> list of (interaction, job_listing) tuples,
        ordered by column_position within each status.
        """
        result = await db.execute(
            select(UserJobInteraction)
            .where(
                UserJobInteraction.user_id == user_id,
                UserJobInteraction.applied_at.isnot(None),
                UserJobInteraction.application_status.isnot(None),
            )
            .options(selectinload(UserJobInteraction.job_listing))
            .order_by(
                UserJobInteraction.application_status,
                UserJobInteraction.column_position,
            )
        )
        interactions = result.scalars().all()

        # Group by status
        board: dict[str, list[tuple[UserJobInteraction, JobListing]]] = {
            status.value: [] for status in ApplicationStatus
        }

        for interaction in interactions:
            status = interaction.application_status
            if status and status in board:
                board[status].append((interaction, interaction.job_listing))

        return board

    async def reorder_jobs_in_column(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        status: ApplicationStatus,
        job_listing_ids: list[int],
    ) -> None:
        """
        Update column_position for jobs in a specific Kanban column.

        The job_listing_ids list defines the new order (index = position).
        """
        for position, job_listing_id in enumerate(job_listing_ids):
            await db.execute(
                update(UserJobInteraction)
                .where(
                    UserJobInteraction.user_id == user_id,
                    UserJobInteraction.job_listing_id == job_listing_id,
                    UserJobInteraction.application_status == status.value,
                )
                .values(column_position=position)
            )

        await db.flush()


# Module-level singleton instances
job_listing_repository = JobListingRepository()
user_job_interaction_repository = UserJobInteractionRepository()
