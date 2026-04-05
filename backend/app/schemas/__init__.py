from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserBase,
    UserLogin,
    Token,
    TokenRefresh,
    GoogleAuthRequest,
    GoogleAuthResponse,
)
from app.schemas.resume import ResumeCreate, ResumeUpdate, ResumeResponse, ResumeBase
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobBase
from app.schemas.job_listing import (
    JobListingBase,
    JobListingCreate,
    JobListingUpdate,
    JobListingResponse,
    JobListingListResponse,
    JobListingFilters,
    UserJobInteractionResponse,
    SaveJobRequest,
    HideJobRequest,
    ApplyJobRequest,
    JobInteractionActionResponse,
    WebhookJobListing,
    WebhookBatchRequest,
    WebhookBatchResponse,
    ResumeStyle,
    PDFPreviewRequest,
    PDFPreviewResponse,
    SeniorityLevel,
    SortBy,
    SortOrder,
)
from app.schemas.tailor import (
    TailorRequest,
    TailorResponse,
    QuickMatchRequest,
    QuickMatchResponse,
    TailoredResumeListResponse,
)
from app.schemas.resume_build import (
    DiffSuggestion,
    ResumeBuildBase,
    ResumeBuildCreate,
    ResumeBuildUpdate,
    ResumeBuildResponse,
    ResumeBuildListResponse,
    SuggestRequest,
    SuggestResponse,
    DiffActionRequest,
    DiffActionResponse,
    UpdateSectionsRequest,
    UpdateStatusRequest,
    ExportRequest,
)
from app.schemas.export import (
    HTMLExportRequest,
    ResumeExportRequest,
    ExportTemplateInfo,
    ExportTemplatesResponse,
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
