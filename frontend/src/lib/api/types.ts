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
