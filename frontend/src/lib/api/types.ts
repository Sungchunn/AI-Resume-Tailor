// API Types - matches backend Pydantic schemas
// These will be replaced by auto-generated types from OpenAPI spec

// Auth Types
export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  about_me?: string | null;
  about_me_generated_at?: string | null;
}

// Profile Types
export interface GenerateAboutMeRequest {
  force_refresh?: boolean;
}

export interface AboutMeResponse {
  about_me: string;
  generated_at: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface TokenRefresh {
  refresh_token: string;
}

// Resume Types
export interface ResumeBase {
  title: string;
  raw_content: string;
}

export interface ResumeCreate extends ResumeBase {
  html_content?: string;
  original_file_key?: string;
  original_filename?: string;
  file_type?: "pdf" | "docx";
  file_size_bytes?: number;
}

export interface ResumeUpdate {
  title?: string;
  raw_content?: string;
  html_content?: string;
  parsed_content?: Record<string, unknown> | null;
  style?: ResumeStyle | null;
}

export interface OriginalFileInfo {
  storage_key?: string | null;
  filename?: string | null;
  file_type?: string | null;
  size_bytes?: number | null;
}

export interface ResumeResponse extends ResumeBase {
  id: string; // MongoDB ObjectId as string
  user_id: number;
  parsed?: Record<string, unknown> | null;
  style?: ResumeStyle | null;
  html_content?: string | null;
  original_file?: OriginalFileInfo | null;
  is_master: boolean; // Designates default resume for tailoring flows
  created_at: string;
  updated_at?: string | null;
}

export interface JobBase {
  title: string;
  company?: string | null;
  raw_content: string;
  url?: string | null;
}

export interface JobCreate extends JobBase {}

export interface JobUpdate {
  title?: string;
  company?: string | null;
  raw_content?: string;
  url?: string | null;
}

export interface JobResponse extends JobBase {
  id: number;
  owner_id: number;
  parsed_content?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ApiError {
  detail: string;
}

// Tailor Types
export interface TailorRequest {
  resume_id: string; // MongoDB ObjectId as string
  job_id?: number;
  job_listing_id?: number;
  focus_keywords?: string[]; // User-selected keywords to emphasize
}

export interface QuickMatchRequest {
  resume_id: string; // MongoDB ObjectId as string
  job_id?: number;
  job_listing_id?: number;
}

export interface Suggestion {
  section: string;
  type: string;
  original: string;
  suggested: string;
  reason: string;
  impact: string;
}

export interface TailoredContent {
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  experience?: Array<{
    id?: string;
    title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  education?: Array<{
    id?: string;
    degree: string;
    institution: string;
    location?: string;
    graduation_date?: string;
    gpa?: string;
    honors?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    id?: string;
    name: string;
    issuer?: string;
    date?: string;
    expiration_date?: string;
    credential_id?: string;
    url?: string;
  }>;
  projects?: Array<{
    id?: string;
    name: string;
    description?: string;
    technologies?: string[];
    url?: string;
    start_date?: string;
    end_date?: string;
    bullets?: string[];
  }>;
  languages?: Array<{
    id?: string;
    language: string;
    proficiency: string;
  }>;
  volunteer?: Array<{
    id?: string;
    role: string;
    organization: string;
    location?: string;
    start_date: string;
    end_date?: string;
    current?: boolean;
    description?: string;
    bullets?: string[];
  }>;
  publications?: Array<{
    id?: string;
    title: string;
    publication_type?: string;
    publisher?: string;
    date?: string;
    url?: string;
    authors?: string;
    description?: string;
  }>;
  awards?: Array<{
    id?: string;
    title: string;
    issuer: string;
    date?: string;
    description?: string;
  }>;
  interests?: string;
  references?: Array<{
    id?: string;
    name: string;
    title: string;
    company: string;
    email?: string;
    phone?: string;
    relationship?: string;
  }>;
  courses?: Array<{
    id?: string;
    name: string;
    provider: string;
    date?: string;
    credential_url?: string;
    description?: string;
  }>;
  memberships?: Array<{
    id?: string;
    organization: string;
    role?: string;
    start_date?: string;
    end_date?: string;
    current?: boolean;
  }>;
  leadership?: Array<{
    id?: string;
    title: string;
    organization: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    current?: boolean;
    description?: string;
    bullets?: string[];
  }>;
  // User-defined section names (e.g., rename "Awards" to "Honors")
  section_labels?: Record<string, string>;
  // Fully custom user-created sections
  custom_sections?: Record<string, CustomSection>;
}

// Custom section can be free-text or entry-based
export interface CustomSection {
  label: string;
  type: "text" | "entries";
  content: string | CustomEntry[];
}

export interface CustomEntry {
  id: string;
  title?: string;
  subtitle?: string;
  date?: string;
  description?: string;
  bullets?: string[];
}

export interface TailorResponse {
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  tailored_data: TailoredContent;
  status: string;
  match_score: number;
  skill_matches: string[];
  skill_gaps: string[];
  keyword_coverage: number;
  job_title: string | null;
  company_name: string | null;
  focus_keywords_used: string[] | null; // Keywords that were used in tailoring
  created_at: string;
}

export interface TailoredResumeFullResponse {
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  tailored_data: TailoredContent;
  finalized_data: TailoredContent | null;
  status: string;
  match_score: number | null;
  skill_matches: string[];
  skill_gaps: string[];
  keyword_coverage: number;
  job_title: string | null;
  company_name: string | null;
  formatted_name: string; // Human-readable: "Job @ Company — Mar 5"
  style_settings: ResumeStyle;
  section_order: string[];
  created_at: string;
  updated_at: string | null;
  finalized_at: string | null;
}

export interface TailoredResumeUpdateRequest {
  tailored_data?: TailoredContent;
  style_settings?: ResumeStyle;
  section_order?: string[];
}

export interface QuickMatchResponse {
  match_score: number;
  keyword_coverage: number;
  skill_matches: string[];
  skill_gaps: string[];
}

export interface TailoredResumeListItem {
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  match_score: number | null;
  job_title: string | null;
  company_name: string | null;
  formatted_name: string; // Human-readable: "Job @ Company — Mar 5"
  created_at: string;
}

/**
 * Response from the /compare endpoint for the diff review UI.
 * Contains both original and AI-proposed resume blocks.
 */
export interface TailoringCompareResponse {
  id: string;
  resume_id: string;
  job_id: number | null;
  job_listing_id: number | null;
  /** Original resume blocks (from the source resume) */
  original_blocks: import("@/lib/resume/types").AnyResumeBlock[];
  /** AI-proposed resume blocks (tailored version) */
  ai_proposed_blocks: import("@/lib/resume/types").AnyResumeBlock[];
  /** Job title for context */
  job_title: string | null;
  /** Company name for context */
  company_name: string | null;
  /** Match score */
  match_score: number | null;
  created_at: string;
}

/**
 * Request to finalize a tailored resume after user review.
 */
export interface TailoringFinalizeRequest {
  /** The final merged blocks after user has accepted/rejected changes */
  finalized_blocks: import("@/lib/resume/types").AnyResumeBlock[];
}

// Block Types (Vault)
export type BlockType =
  | "achievement"
  | "responsibility"
  | "skill"
  | "project"
  | "certification"
  | "education";

export interface BlockCreate {
  content: string;
  block_type: BlockType;
  tags?: string[];
  source_company?: string | null;
  source_role?: string | null;
  source_date_start?: string | null;
  source_date_end?: string | null;
}

export interface BlockUpdate {
  content?: string;
  block_type?: BlockType;
  tags?: string[];
  source_company?: string | null;
  source_role?: string | null;
  source_date_start?: string | null;
  source_date_end?: string | null;
  verified?: boolean;
}

export interface BlockResponse {
  id: number;
  user_id: number;
  content: string;
  block_type: BlockType;
  tags: string[];
  source_company?: string | null;
  source_role?: string | null;
  source_date_start?: string | null;
  source_date_end?: string | null;
  verified: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface BlockListResponse {
  blocks: BlockResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface BlockImportRequest {
  raw_content: string;
  source_company?: string | null;
  source_role?: string | null;
}

export interface BlockImportResponse {
  imported_count: number;
  blocks: BlockResponse[];
}

export interface BlockEmbedRequest {
  block_ids?: number[] | null;
}

export interface BlockEmbedResponse {
  embedded_count: number;
  block_ids: number[];
}

// Semantic Match Types
export interface SemanticMatchResult {
  block: BlockResponse;
  score: number;
  matched_keywords: string[];
}

export interface MatchRequest {
  job_description: string;
  limit?: number;
  block_types?: BlockType[];
  tags?: string[];
}

export interface MatchResponse {
  matches: SemanticMatchResult[];
  query_keywords: string[];
  total_vault_blocks: number;
}

export interface GapAnalysisResponse {
  match_score: number;
  skill_matches: string[];
  skill_gaps: string[];
  keyword_coverage: number;
  recommendations: string[];
}

// Resume Build Types (formerly Workshop Types)
export type ResumeBuildStatus = "draft" | "in_progress" | "exported";
export type WorkshopStatus = ResumeBuildStatus; // Backward compatibility

export type DiffOperation = "add" | "remove" | "replace" | "move" | "copy" | "test";

export type SuggestionImpact = "high" | "medium" | "low";

export interface DiffSuggestion {
  operation: DiffOperation;
  path: string;
  value: unknown;
  original_value?: unknown;
  reason: string;
  impact: SuggestionImpact;
  source_block_id?: number | null;
}

export interface ResumeBuildCreate {
  job_title: string;
  job_company?: string | null;
  job_description?: string | null;
}
export type WorkshopCreate = ResumeBuildCreate; // Backward compatibility

export interface ResumeBuildUpdate {
  job_title?: string;
  job_company?: string | null;
  job_description?: string | null;
}
export type WorkshopUpdate = ResumeBuildUpdate; // Backward compatibility

export interface ResumeBuildResponse {
  id: number;
  user_id: number;
  job_title: string;
  job_company?: string | null;
  job_description?: string | null;
  status: ResumeBuildStatus;
  sections: Record<string, unknown>;
  pulled_block_ids: number[];
  pending_diffs: DiffSuggestion[];
  created_at: string;
  updated_at?: string | null;
  exported_at?: string | null;
}
export type WorkshopResponse = ResumeBuildResponse; // Backward compatibility

export interface ResumeBuildListResponse {
  resume_builds: ResumeBuildResponse[];
  total: number;
  limit: number;
  offset: number;
}
// Note: WorkshopListResponse has different field name (workshops vs resume_builds)
export interface WorkshopListResponse {
  workshops: WorkshopResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface PullBlocksRequest {
  block_ids: number[];
}

export interface PullBlocksResponse {
  workshop: WorkshopResponse;  // Kept as 'workshop' for backward compatibility (client transforms from API's 'resume_build')
  newly_pulled: number[];
  already_pulled: number[];
}

export interface SuggestRequest {
  max_suggestions?: number;
  focus_sections?: string[] | null;
}

export interface SuggestResponse {
  workshop: WorkshopResponse;  // Kept as 'workshop' for backward compatibility
  new_suggestions_count: number;
  gaps_identified: string[];
}

export interface DiffActionRequest {
  diff_index: number;
}

export interface DiffActionResponse {
  workshop: WorkshopResponse;  // Kept as 'workshop' for backward compatibility
  action: "accept" | "reject";
  applied_diff?: DiffSuggestion | null;
}

export interface BulletSuggestionEntryContext {
  title: string;
  company: string;
  date_range: string;
}

export interface BulletSuggestionRequest {
  bullet_text: string;
  entry_context: BulletSuggestionEntryContext;
  job_description: string;
}

export interface BulletSuggestionResponse {
  original: string;
  suggested: string;
  reason: string;
  impact: SuggestionImpact;
}

export interface UpdateSectionsRequest {
  sections: Record<string, unknown>;
}

export interface UpdateStatusRequest {
  status: ResumeBuildStatus;
}

export interface ExportRequest {
  format: "pdf" | "docx" | "txt" | "json";
  template?: string;
}

// Upload Types
export interface DocumentExtractionResponse {
  raw_content: string;
  html_content: string;
  source_filename: string;
  file_type: "pdf" | "docx";
  file_key: string | null;
  file_size_bytes: number | null;
  page_count: number | null;
  word_count: number;
  warnings: string[];
}

// ============================================================================
// Job Listing Types (System-wide jobs from external sources)
// ============================================================================

export type SeniorityLevel = "entry" | "mid" | "senior" | "lead" | "executive";
export type JobListingSortBy =
  | "date_posted"
  | "salary_min"
  | "salary_max"
  | "company_name"
  | "job_title"
  | "created_at";
export type SortOrder = "asc" | "desc";

// Kanban board application status
export type ApplicationStatus = "applied" | "interview" | "accepted" | "rejected" | "ghosted";

export interface JobListingResponse {
  id: number;
  external_job_id: string;
  job_title: string;
  company_name: string;
  company_logo: string | null;
  company_website: string | null;
  company_description: string | null;
  company_linkedin_url: string | null;
  company_address_locality: string | null;
  company_address_country: string | null;
  location: string | null;
  seniority: string | null;
  job_function: string | null;
  industry: string | null;
  job_description: string;
  job_description_html: string | null;
  job_url: string;
  apply_url: string | null;
  benefits: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string | null;
  date_posted: string | null;
  scraped_at: string | null;
  source_platform: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  // User interaction fields
  is_saved: boolean;
  is_hidden: boolean;
  applied_at: string | null;

  // Kanban board fields
  application_status: ApplicationStatus | null;
  status_changed_at: string | null;
  column_position: number;
}

export interface JobListingListResponse {
  listings: JobListingResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobListingFilters {
  location?: string;  // Deprecated - use city filter instead
  region?: string;
  country?: string;
  city?: string;
  exclude_city?: string;
  exclude_country?: string;
  company_name?: string;
  seniority?: string;
  job_function?: string;
  industry?: string;
  is_remote?: boolean;
  easy_apply?: boolean;
  applicants_max?: number;
  applicants_include_na?: boolean;
  salary_min?: number;
  salary_max?: number;
  date_posted_after?: string;
  search?: string;
  is_saved?: boolean;
  is_hidden?: boolean;
  applied?: boolean;
  sort_by?: JobListingSortBy;
  sort_order?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface JobListingFilterOptionsResponse {
  countries: FilterOption[];
  regions: FilterOption[];
  seniorities: FilterOption[];
  cities: FilterOption[];
}

export interface SaveJobRequest {
  save: boolean;
}

export interface HideJobRequest {
  hide: boolean;
}

export interface ApplyJobRequest {
  applied: boolean;
}

export interface UserJobInteractionResponse {
  id: number;
  user_id: number;
  job_listing_id: number;
  is_saved: boolean;
  is_hidden: boolean;
  applied_at: string | null;
  last_viewed_at: string | null;
  application_status: ApplicationStatus | null;
  status_changed_at: string | null;
  column_position: number;
  created_at: string;
  updated_at: string | null;
}

export interface JobInteractionActionResponse {
  success: boolean;
  message: string;
  interaction: UserJobInteractionResponse;
}

// Kanban board request/response types
export interface UpdateApplicationStatusRequest {
  status: ApplicationStatus;
}

export interface ReorderKanbanRequest {
  status: ApplicationStatus;
  job_listing_ids: number[];
}

export interface KanbanColumnResponse {
  status: string;
  jobs: JobListingResponse[];
  total: number;
}

export interface KanbanBoardResponse {
  columns: Record<ApplicationStatus, KanbanColumnResponse>;
}

// ============================================================================
// Resume Style Types (for PDF generation)
// ============================================================================

export type PageSizeType = "letter" | "a4";

export interface ResumeStyle {
  font_family?: string;
  font_size_body?: number;
  font_size_heading?: number;
  font_size_subheading?: number;
  margin_top?: number;
  margin_bottom?: number;
  margin_left?: number;
  margin_right?: number;
  line_spacing?: number;
  section_spacing?: number;
  entry_spacing?: number;
  page_size?: PageSizeType;
}

export interface PDFPreviewRequest {
  sections: Record<string, unknown>;
  style?: ResumeStyle;
}

export interface PDFPreviewResponse {
  pdf_url: string;
  content_hash: string;
  cached: boolean;
  expires_at: string;
}

// ============================================================================
// Admin Scraper Types
// ============================================================================

export interface AdHocScrapeRequest {
  url: string;
  count?: number;
}

export interface AdHocScrapeResponse {
  status: string;
  jobs_found: number;
  jobs_created: number;
  jobs_updated: number;
  errors: number;
  error_details: Array<Record<string, unknown>>;
  duration_seconds: number | null;
}

export interface ScraperRegionResult {
  region: string;
  status: string;
  jobs_found: number;
  jobs_created: number;
  jobs_updated: number;
  errors: number;
  error_details: Array<Record<string, unknown>>;
  duration_seconds: number | null;
}

export interface ScraperBatchResult {
  status: string;
  started_at: string;
  completed_at: string | null;
  total_jobs_found: number;
  total_jobs_created: number;
  total_jobs_updated: number;
  total_errors: number;
  region_results: ScraperRegionResult[];
}

// ============================================================================
// Scraper Preset Types
// ============================================================================

export interface ScraperPresetCreate {
  name: string;
  url: string;
  count?: number;
  is_active?: boolean;
}

export interface ScraperPresetUpdate {
  name?: string;
  url?: string;
  count?: number;
  is_active?: boolean;
}

export interface ScraperPresetResponse {
  id: number;
  name: string;
  url: string;
  count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ScraperPresetListResponse {
  presets: ScraperPresetResponse[];
  total: number;
}

// ============================================================================
// Schedule Settings Types
// ============================================================================

export type ScheduleType = "daily" | "weekly";

export interface ScheduleSettingsUpdate {
  is_enabled?: boolean;
  schedule_type?: ScheduleType;
  schedule_hour?: number;
  schedule_minute?: number;
  schedule_day_of_week?: number | null;
  schedule_timezone?: string;
}

export interface ScheduleSettingsResponse {
  is_enabled: boolean;
  schedule_type: ScheduleType;
  schedule_hour: number;
  schedule_minute: number;
  schedule_day_of_week: number | null;
  schedule_timezone: string;
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// HTML Export Types
// ============================================================================

export type ExportStyleTemplate = "classic" | "modern" | "minimal";
export type ExportFormat = "pdf" | "docx";

export interface ResumeExportRequest {
  format: ExportFormat;
  template?: ExportStyleTemplate;
  font_family?: string;
  font_size?: number;
  margin_top?: number;
  margin_bottom?: number;
  margin_left?: number;
  margin_right?: number;
}

export interface HTMLExportRequest extends ResumeExportRequest {
  html_content: string;
}

export interface ExportTemplateInfo {
  name: string;
  description: string;
  preview_image?: string | null;
}

export interface ExportTemplatesResponse {
  templates: ExportTemplateInfo[];
}

// ============================================================================
// ATS Analysis Types
// ============================================================================

export type KeywordImportance = "required" | "preferred" | "nice_to_have";

export interface KeywordDetail {
  keyword: string;
  importance: KeywordImportance;
  found_in_resume: boolean;
  found_in_vault: boolean;
  frequency_in_job: number;
  context: string | null;
}

export interface ATSKeywordDetailedRequest {
  job_description: string;
  resume_content?: string | null;
  resume_block_ids?: number[] | null;
}

export interface ATSKeywordDetailedResponse {
  coverage_score: number;
  required_coverage: number;
  preferred_coverage: number;

  // Grouped by importance
  required_matched: string[];
  required_missing: string[];
  preferred_matched: string[];
  preferred_missing: string[];
  nice_to_have_matched: string[];
  nice_to_have_missing: string[];

  // Vault availability
  missing_available_in_vault: string[];
  missing_not_in_vault: string[];

  // Full keyword details
  all_keywords: KeywordDetail[];

  // Suggestions and warnings
  suggestions: string[];
  warnings: string[];
}

// ============================================================================
// AI Chat Types (Resume Section Improvements)
// ============================================================================

export type AISectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "volunteer"
  | "publications"
  | "awards"
  | "interests"
  | "languages"
  | "references"
  | "courses"
  | "memberships"
  | "leadership";

export interface ImproveSectionRequest {
  section_type: AISectionType;
  section_content: string;
  instruction: string;
  job_context?: string | null;
}

export interface ImproveSectionResponse {
  improved_content: string;
  changes_summary: string;
  suggestions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  message: string;
  section_type?: AISectionType | null;
  section_content?: string | null;
  chat_history?: ChatMessage[];
  job_context?: string | null;
}

export type AIChatActionType = "advice" | "improvement" | "question";

export interface AIChatResponse {
  message: string;
  improved_content: string | null;
  action_type: AIChatActionType;
}

// ============================================================================
// Parse Task Types (Resume AI Parsing)
// ============================================================================

export type ParseTaskStatus = "pending" | "completed" | "failed";
export type ParseStage = "extracting" | "parsing" | "storing";

export interface ParseTaskResponse {
  task_id: string;
  status: ParseTaskStatus;
  resume_id: string; // MongoDB ObjectId as string
}

export interface ParseStatusResponse extends ParseTaskResponse {
  stage?: ParseStage | null;
  stage_progress?: number | null; // 0-100 within current stage
  error?: string | null;
  warning?: string | null; // For partial success (e.g., AI parsing failed but resume saved)
}

// ============================================================================
// ATS Progressive Analysis Types (SSE)
// ============================================================================

export interface ATSProgressiveRequest {
  resume_id?: number;
  job_id?: number;
  resume_content?: Record<string, any>;
  job_description?: string;
}

export interface ATSStageProgress {
  stage: number;
  stage_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_percent: number;
  elapsed_ms?: number;
  result?: any;
  error?: string;
}

export interface ATSCompositeScore {
  final_score: number;
  stage_breakdown: Record<string, number>;
  weights_used: Record<string, number>;
  normalization_applied: boolean;
  failed_stages: string[];
}

export interface ATSProgressiveCompleteEvent {
  stage: number;
  status: 'completed';
  progress_percent: number;
  elapsed_ms: number;
  composite_score: ATSCompositeScore;
}

// ============================================================================
// Scraper Request Types (User-submitted job URL requests)
// ============================================================================

export type ScraperRequestStatus = "pending" | "approved" | "rejected";

export interface ScraperRequestCreate {
  url: string;
  name?: string | null;
  reason?: string | null;
}

export interface ScraperRequestResponse {
  id: number;
  url: string;
  name: string | null;
  reason: string | null;
  status: ScraperRequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
  preset_id: number | null;
}

export interface ScraperRequestListResponse {
  requests: ScraperRequestResponse[];
  total: number;
}

// Admin types
export interface ScraperRequestAdminResponse extends ScraperRequestResponse {
  user_id: number;
  user_email: string;
  reviewed_by: number | null;
  reviewer_email: string | null;
}

export interface ScraperRequestAdminListResponse {
  requests: ScraperRequestAdminResponse[];
  total: number;
}

export interface ScraperRequestApproveRequest {
  admin_notes?: string | null;
  create_preset?: boolean;
  preset_name?: string | null;
  preset_count?: number;
  preset_is_active?: boolean;
}

export interface ScraperRequestRejectRequest {
  admin_notes: string;
}
