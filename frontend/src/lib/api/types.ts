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
  created_at: string;
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

export interface ResumeCreate extends ResumeBase {}

export interface ResumeUpdate {
  title?: string;
  raw_content?: string;
}

export interface ResumeResponse extends ResumeBase {
  id: number;
  owner_id: number;
  parsed_content?: Record<string, unknown> | null;
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
  resume_id: number;
  job_id: number;
}

export interface QuickMatchRequest {
  resume_id: number;
  job_id: number;
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
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  skills: string[];
  highlights: string[];
}

export interface TailorResponse {
  id: number;
  resume_id: number;
  job_id: number;
  tailored_content: TailoredContent;
  suggestions: Suggestion[];
  match_score: number;
  skill_matches: string[];
  skill_gaps: string[];
  keyword_coverage: number;
  created_at: string;
}

export interface QuickMatchResponse {
  match_score: number;
  keyword_coverage: number;
  skill_matches: string[];
  skill_gaps: string[];
}

export interface TailoredResumeListItem {
  id: number;
  resume_id: number;
  job_id: number;
  match_score: number | null;
  created_at: string;
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

// Workshop Types
export type WorkshopStatus = "draft" | "in_progress" | "exported";

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

export interface WorkshopCreate {
  job_title: string;
  job_company?: string | null;
  job_description?: string | null;
}

export interface WorkshopUpdate {
  job_title?: string;
  job_company?: string | null;
  job_description?: string | null;
}

export interface WorkshopResponse {
  id: number;
  user_id: number;
  job_title: string;
  job_company?: string | null;
  job_description?: string | null;
  status: WorkshopStatus;
  sections: Record<string, unknown>;
  pulled_block_ids: number[];
  pending_diffs: DiffSuggestion[];
  created_at: string;
  updated_at?: string | null;
  exported_at?: string | null;
}

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
  workshop: WorkshopResponse;
  newly_pulled: number[];
  already_pulled: number[];
}

export interface SuggestRequest {
  max_suggestions?: number;
  focus_sections?: string[] | null;
}

export interface SuggestResponse {
  workshop: WorkshopResponse;
  new_suggestions_count: number;
  gaps_identified: string[];
}

export interface DiffActionRequest {
  diff_index: number;
}

export interface DiffActionResponse {
  workshop: WorkshopResponse;
  action: "accept" | "reject";
  applied_diff?: DiffSuggestion | null;
}

export interface UpdateSectionsRequest {
  sections: Record<string, unknown>;
}

export interface UpdateStatusRequest {
  status: WorkshopStatus;
}

export interface ExportRequest {
  format: "pdf" | "docx" | "txt" | "json";
  template?: string;
}

// Upload Types
export interface DocumentExtractionResponse {
  raw_content: string;
  source_filename: string;
  file_type: "pdf" | "docx";
  page_count: number | null;
  word_count: number;
  warnings: string[];
}
