from app.schemas.export import (
    ExportTemplateInfo,
    ExportTemplatesResponse,
    HTMLExportRequest,
    ResumeExportRequest,
)
from app.schemas.job import JobBase, JobCreate, JobResponse, JobUpdate
from app.schemas.job_listing import (
    ApplyJobRequest,
    HideJobRequest,
    JobInteractionActionResponse,
    JobListingBase,
    JobListingCreate,
    JobListingFilters,
    JobListingListItem,
    JobListingListItemResponse,
    JobListingListResponse,
    JobListingResponse,
    JobListingUpdate,
    PDFPreviewRequest,
    PDFPreviewResponse,
    ResumeStyle,
    SaveJobRequest,
    SeniorityLevel,
    SortBy,
    SortOrder,
    UserJobInteractionResponse,
    WebhookBatchRequest,
    WebhookBatchResponse,
    WebhookJobListing,
)
from app.schemas.resume import ResumeBase, ResumeCreate, ResumeResponse, ResumeUpdate
from app.schemas.resume_build import (
    DiffActionRequest,
    DiffActionResponse,
    DiffSuggestion,
    ExportRequest,
    ResumeBuildBase,
    ResumeBuildCreate,
    ResumeBuildListResponse,
    ResumeBuildResponse,
    ResumeBuildUpdate,
    SuggestRequest,
    SuggestResponse,
    UpdateSectionsRequest,
    UpdateStatusRequest,
)
from app.schemas.tailor import (
    QuickMatchRequest,
    QuickMatchResponse,
    TailoredResumeListResponse,
    TailorRequest,
    TailorResponse,
)
from app.schemas.user import (
    GoogleAuthRequest,
    GoogleAuthResponse,
    Token,
    TokenRefresh,
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
)

# Backward compatibility aliases
WorkshopBase = ResumeBuildBase
WorkshopCreate = ResumeBuildCreate
WorkshopUpdate = ResumeBuildUpdate
WorkshopResponse = ResumeBuildResponse
WorkshopListResponse = ResumeBuildListResponse

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "Token",
    "TokenRefresh",
    "GoogleAuthRequest",
    "GoogleAuthResponse",
    # Resume schemas
    "ResumeBase",
    "ResumeCreate",
    "ResumeUpdate",
    "ResumeResponse",
    # Job schemas
    "JobBase",
    "JobCreate",
    "JobUpdate",
    "JobResponse",
    # Job Listing schemas
    "JobListingBase",
    "JobListingCreate",
    "JobListingUpdate",
    "JobListingResponse",
    "JobListingListResponse",
    "JobListingListItem",
    "JobListingListItemResponse",
    "JobListingFilters",
    "UserJobInteractionResponse",
    "SaveJobRequest",
    "HideJobRequest",
    "ApplyJobRequest",
    "JobInteractionActionResponse",
    "WebhookJobListing",
    "WebhookBatchRequest",
    "WebhookBatchResponse",
    "ResumeStyle",
    "PDFPreviewRequest",
    "PDFPreviewResponse",
    "SeniorityLevel",
    "SortBy",
    "SortOrder",
    # Tailor schemas
    "TailorRequest",
    "TailorResponse",
    "QuickMatchRequest",
    "QuickMatchResponse",
    "TailoredResumeListResponse",
    # Resume Build schemas
    "DiffSuggestion",
    "ResumeBuildBase",
    "ResumeBuildCreate",
    "ResumeBuildUpdate",
    "ResumeBuildResponse",
    "ResumeBuildListResponse",
    "SuggestRequest",
    "SuggestResponse",
    "DiffActionRequest",
    "DiffActionResponse",
    "UpdateSectionsRequest",
    "UpdateStatusRequest",
    "ExportRequest",
    # Export schemas
    "HTMLExportRequest",
    "ResumeExportRequest",
    "ExportTemplateInfo",
    "ExportTemplatesResponse",
    # Backward compatibility aliases
    "WorkshopBase",
    "WorkshopCreate",
    "WorkshopUpdate",
    "WorkshopResponse",
    "WorkshopListResponse",
]
