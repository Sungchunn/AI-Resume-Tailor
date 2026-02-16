// API Types - matches backend Pydantic schemas
// These will be replaced by auto-generated types from OpenAPI spec

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
