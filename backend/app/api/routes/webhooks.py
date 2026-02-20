"""
Webhook endpoints for external integrations.

Supports n8n/APIFY LinkedIn job listing ingestion.
These endpoints are unauthenticated for webhook access.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.crud import job_listing_repository
from app.schemas.job_listing import (
    ApifyBatchRequest,
    ApifyJobListing,
    WebhookBatchResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/job-listings",
    response_model=WebhookBatchResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "All jobs processed successfully"},
        207: {"description": "Partial success - some jobs failed validation"},
    },
)
async def ingest_job_listings(
    request: ApifyBatchRequest,
    db: AsyncSession = Depends(get_db_session),
) -> WebhookBatchResponse:
    """
    Batch ingest job listings from n8n/APIFY LinkedIn scraper.

    Accepts up to 2000 job listings per request. Jobs are upserted based
    on the LinkedIn `id` field - existing jobs are updated, new jobs are created.

    ## No Authentication Required

    This endpoint is unauthenticated for webhook access from n8n.

    ## Request Body

    ```json
    {
      "jobs": [
        {
          "id": "4334158613",
          "title": "Software Engineer, Fullstack",
          "companyName": "Notion",
          "companyUrl": "https://www.linkedin.com/company/notionhq",
          "companyLogo": "https://media.licdn.com/dms/image/...",
          "companyIndustry": "Software Development",
          "location": "San Francisco, CA",
          "city": "San Francisco",
          "state": "CA",
          "country": "United States",
          "isRemote": false,
          "jobUrl": "https://www.linkedin.com/jobs/view/4334158613",
          "jobUrlDirect": "https://notion.com/careers/apply/...",
          "datePosted": "2024-01-15",
          "compensation": {
            "minAmount": 126000,
            "maxAmount": 180000,
            "currency": "USD",
            "interval": "yearly"
          },
          "jobType": ["Full-time"],
          "jobLevel": "Entry level",
          "jobFunction": "Engineering",
          "description": "We are looking for a talented engineer...",
          "emails": ["careers@notion.com"],
          "easyApply": false,
          "scrapedAt": "2025-11-28T10:30:00Z",
          "region": "singapore"
        }
      ],
      "metadata": {
        "source": "linkedin",
        "scraper": "silentflow/linkedin-jobs-scraper-ppr",
        "scrapedAt": "2025-02-19T12:00:00Z",
        "totalJobs": 400,
        "regions": ["thailand", "taiwan", "singapore", "other"]
      }
    }
    ```

    ## Response

    Returns counts of received, created, updated, and errored jobs.

    ```json
    {
      "received": 400,
      "created": 350,
      "updated": 45,
      "errors": 5,
      "error_details": [
        {"index": 12, "id": "123", "error": "validation error..."}
      ]
    }
    ```
    """
    created_count = 0
    updated_count = 0
    error_count = 0
    error_details: list[dict[str, Any]] = []

    # Get source platform from metadata if available
    source_platform = "linkedin"
    if request.metadata and request.metadata.source:
        source_platform = request.metadata.source

    for idx, job_data in enumerate(request.jobs):
        try:
            # Validate required fields
            if not job_data.id or not job_data.title or not job_data.jobUrl:
                error_count += 1
                error_details.append({
                    "index": idx,
                    "id": job_data.id or "unknown",
                    "error": "Missing required field: id, title, or jobUrl",
                })
                continue

            listing, is_created = await job_listing_repository.upsert_from_apify(
                db, job_data=job_data, source_platform=source_platform
            )
            if is_created:
                created_count += 1
            else:
                updated_count += 1

        except Exception as e:
            error_count += 1
            error_details.append({
                "index": idx,
                "id": getattr(job_data, "id", "unknown"),
                "error": str(e),
            })
            logger.warning(
                f"Failed to process job at index {idx}: {e}",
                exc_info=True,
            )

    total_received = len(request.jobs)

    # Log summary
    logger.info(
        f"Batch ingestion complete: received={total_received}, "
        f"created={created_count}, updated={updated_count}, errors={error_count}"
    )

    return WebhookBatchResponse(
        received=total_received,
        created=created_count,
        updated=updated_count,
        errors=error_count,
        error_details=error_details if error_details else [],
    )


@router.post(
    "/job-listings/single",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def ingest_single_job_listing(
    job_data: ApifyJobListing,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Ingest a single job listing from n8n/APIFY.

    Upserts the job based on the LinkedIn `id` field.

    ## No Authentication Required

    This endpoint is unauthenticated for webhook access from n8n.

    ## Request Body

    A single job object in APIFY format (see batch endpoint for schema).

    ## Response

    ```json
    {
      "success": true,
      "action": "created",
      "id": 123,
      "external_job_id": "4334158613"
    }
    ```
    """
    # Validate required fields
    if not job_data.id or not job_data.title or not job_data.jobUrl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: id, title, or jobUrl",
        )

    try:
        listing, is_created = await job_listing_repository.upsert_from_apify(
            db, job_data=job_data, source_platform="linkedin"
        )
        return {
            "success": True,
            "action": "created" if is_created else "updated",
            "id": listing.id,
            "external_job_id": listing.external_job_id,
        }
    except Exception as e:
        logger.error(f"Failed to process single job listing: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process job listing: {str(e)}",
        )


@router.delete(
    "/job-listings/{external_job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_job_listing(
    external_job_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Deactivate a job listing by external ID.

    Marks the listing as inactive (soft delete).

    ## No Authentication Required

    This endpoint is unauthenticated for webhook access from n8n.
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
