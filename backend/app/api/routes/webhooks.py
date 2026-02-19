"""
Webhook endpoints for external integrations.

Currently supports n8n job listing ingestion with API key authentication.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.core.config import get_settings
from app.crud import job_listing_repository
from app.schemas.job_listing import (
    WebhookBatchRequest,
    WebhookBatchResponse,
    WebhookJobListing,
)

router = APIRouter()
settings = get_settings()


async def verify_webhook_api_key(
    x_api_key: str = Header(..., description="API key for webhook authentication"),
) -> None:
    """
    Verify the webhook API key.

    Raises 401 Unauthorized if the key is missing or invalid.
    """
    expected_key = settings.n8n_webhook_api_key
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook API key not configured",
        )
    if x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


@router.post(
    "/job-listings",
    response_model=WebhookBatchResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_webhook_api_key)],
)
async def ingest_job_listings(
    request: WebhookBatchRequest,
    db: AsyncSession = Depends(get_db_session),
) -> WebhookBatchResponse:
    """
    Batch ingest job listings from n8n/Apify.

    Accepts up to 1000 job listings per request. Jobs are upserted based
    on external_job_id - existing jobs are updated, new jobs are created.

    ## Authentication

    Requires `X-API-Key` header with the configured webhook API key.

    ## Request Body

    ```json
    {
      "jobs": [
        {
          "external_job_id": "linkedin_12345",
          "job_title": "Senior Backend Engineer",
          "company_name": "TechCorp",
          "location": "San Francisco, CA",
          "seniority": "senior",
          "job_function": "Engineering",
          "industry": "Technology",
          "job_description": "Full job description...",
          "job_url": "https://linkedin.com/jobs/12345",
          "salary_min": 150000,
          "salary_max": 200000,
          "salary_currency": "USD",
          "salary_period": "yearly",
          "date_posted": "2026-02-19T10:00:00Z",
          "source_platform": "linkedin"
        }
      ]
    }
    ```

    ## Response

    Returns counts of created, updated, and failed jobs along with any errors.
    """
    created_count = 0
    updated_count = 0
    failed_count = 0
    errors = []

    for idx, job_data in enumerate(request.jobs):
        try:
            listing, is_created = await job_listing_repository.upsert_from_webhook(
                db, job_data=job_data
            )
            if is_created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({
                "index": idx,
                "external_job_id": job_data.external_job_id,
                "error": str(e),
            })

    return WebhookBatchResponse(
        created=created_count,
        updated=updated_count,
        failed=failed_count,
        errors=errors,
    )


@router.post(
    "/job-listings/single",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_webhook_api_key)],
)
async def ingest_single_job_listing(
    job_data: WebhookJobListing,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Ingest a single job listing from n8n/Apify.

    Upserts the job based on external_job_id.

    ## Authentication

    Requires `X-API-Key` header with the configured webhook API key.
    """
    try:
        listing, is_created = await job_listing_repository.upsert_from_webhook(
            db, job_data=job_data
        )
        return {
            "success": True,
            "action": "created" if is_created else "updated",
            "id": listing.id,
            "external_job_id": listing.external_job_id,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process job listing: {str(e)}",
        )


@router.delete(
    "/job-listings/{external_job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_webhook_api_key)],
)
async def deactivate_job_listing(
    external_job_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Deactivate a job listing by external ID.

    Marks the listing as inactive (soft delete).

    ## Authentication

    Requires `X-API-Key` header with the configured webhook API key.
    """
    listing = await job_listing_repository.get_by_external_id(
        db, external_job_id=external_job_id
    )
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job listing not found",
        )

    await job_listing_repository.deactivate(db, id=listing.id)
