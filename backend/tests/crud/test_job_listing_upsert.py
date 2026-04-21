"""Regression tests for batch_upsert_from_apify collision handling.

JobListing has two unique constraints (external_job_id, dedup_hash).
A single ON CONFLICT target can't handle both, so the upsert
pre-queries existing rows and partitions into INSERT vs UPDATE-by-pk.
See docs/features/infrastructure/260421_external-id-upsert-fix.md.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.job_listing import job_listing_repository as job_listing
from app.models.job_listing import JobListing
from app.schemas.job_listing import ApifyJobListing
from app.utils.apify_helpers import compute_dedup_hash


def _apify_job(
    *,
    ext_id: str,
    title: str = "Senior Engineer",
    company: str = "Acme",
    location: str = "San Francisco, CA",
) -> ApifyJobListing:
    return ApifyJobListing(
        id=ext_id,
        title=title,
        link=f"https://linkedin.com/jobs/view/{ext_id}",
        companyName=company,
        location=location,
        descriptionText="Job description body.",
    )


async def test_same_external_id_different_hash_updates_in_place(
    db_session: AsyncSession,
):
    # Seed: scrape 1 — ext=X, city parsed as "San Francisco"
    await job_listing.batch_upsert_from_apify(
        db_session,
        jobs_data=[_apify_job(ext_id="ext-X", location="San Francisco, CA")],
    )
    await db_session.commit()

    # Scrape 2 — same ext_id, different location normalization → new dedup_hash
    await job_listing.batch_upsert_from_apify(
        db_session,
        jobs_data=[_apify_job(ext_id="ext-X", location="San Francisco Bay Area")],
    )
    await db_session.commit()

    rows = (await db_session.execute(
        select(JobListing).where(JobListing.external_job_id == "ext-X")
    )).scalars().all()
    assert len(rows) == 1


async def test_different_external_id_same_hash_updates_ext_id(
    db_session: AsyncSession,
):
    # Seed: scrape 1 — ext=Y
    await job_listing.batch_upsert_from_apify(
        db_session,
        jobs_data=[_apify_job(ext_id="ext-Y")],
    )
    await db_session.commit()

    # Scrape 2 — repost with new ext_id but identical title/company/city
    await job_listing.batch_upsert_from_apify(
        db_session,
        jobs_data=[_apify_job(ext_id="ext-Z")],
    )
    await db_session.commit()

    # Only one row should exist — the repost refreshed external_job_id
    dedup = compute_dedup_hash("Senior Engineer", "Acme", "San Francisco")
    rows = (await db_session.execute(
        select(JobListing).where(JobListing.dedup_hash == dedup)
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].external_job_id == "ext-Z"


async def test_new_job_inserts(db_session: AsyncSession):
    await job_listing.batch_upsert_from_apify(
        db_session,
        jobs_data=[_apify_job(ext_id="ext-NEW", company="Novel Co")],
    )
    await db_session.commit()

    row = (await db_session.execute(
        select(JobListing).where(JobListing.external_job_id == "ext-NEW")
    )).scalar_one_or_none()
    assert row is not None
    assert row.company_name == "Novel Co"
