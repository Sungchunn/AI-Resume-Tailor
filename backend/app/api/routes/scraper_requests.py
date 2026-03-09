"""
User-facing API endpoints for scraper requests.

Allows authenticated users to:
- Submit new job scraping requests
- View their submitted requests
- Cancel pending requests
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.crud.scraper_request import scraper_request_repository
from app.schemas.scraper import (
    ScraperRequestCreate,
    ScraperRequestResponse,
    ScraperRequestListResponse,
)

router = APIRouter(prefix="/scraper-requests", tags=["scraper-requests"])


@router.post("", response_model=ScraperRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: ScraperRequestCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScraperRequestResponse:
    """
    Submit a new scraper request.

    Users can submit LinkedIn job search URLs for admin review.
    Admins will approve or reject the request.
    """
    db_request = await scraper_request_repository.create(
        db,
        user_id=current_user.id,
        url=data.url,
        name=data.name,
        reason=data.reason,
    )
    await db.commit()
    return ScraperRequestResponse.model_validate(db_request)


@router.get("", response_model=ScraperRequestListResponse)
async def list_my_requests(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScraperRequestListResponse:
    """
    List my submitted requests.

    Returns all requests submitted by the current user, most recent first.
    """
    requests, total = await scraper_request_repository.list_by_user(
        db, user_id=current_user.id, limit=limit, offset=offset
    )
    return ScraperRequestListResponse(
        requests=[ScraperRequestResponse.model_validate(r) for r in requests],
        total=total,
    )


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    request_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Cancel a pending request.

    Users can only cancel their own pending requests.
    Approved or rejected requests cannot be cancelled.
    """
    deleted = await scraper_request_repository.cancel(
        db, request_id=request_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be cancelled",
        )
    await db.commit()
