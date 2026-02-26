import type {
  ResumeCreate,
  ResumeUpdate,
  ResumeResponse,
  JobCreate,
  JobUpdate,
  JobResponse,
  TailorRequest,
  TailorResponse,
  QuickMatchRequest,
  QuickMatchResponse,
  TailoredResumeListItem,
  TailoredResumeFullResponse,
  TailoredResumeUpdateRequest,
  UserCreate,
  UserLogin,
  UserResponse,
  Token,
  TokenRefresh,
  BlockCreate,
  BlockUpdate,
  BlockResponse,
  BlockListResponse,
  BlockImportRequest,
  BlockImportResponse,
  BlockEmbedRequest,
  BlockEmbedResponse,
  BlockType,
  MatchRequest,
  MatchResponse,
  GapAnalysisResponse,
  WorkshopCreate,
  WorkshopUpdate,
  WorkshopResponse,
  WorkshopListResponse,
  PullBlocksRequest,
  PullBlocksResponse,
  SuggestRequest,
  SuggestResponse,
  DiffActionRequest,
  DiffActionResponse,
  UpdateSectionsRequest,
  UpdateStatusRequest,
  ExportRequest,
  WorkshopStatus,
  DocumentExtractionResponse,
  JobListingResponse,
  JobListingListResponse,
  JobListingFilters,
  SaveJobRequest,
  HideJobRequest,
  ApplyJobRequest,
  JobInteractionActionResponse,
  AdHocScrapeRequest,
  AdHocScrapeResponse,
  JobListingFilterOptionsResponse,
  ScraperPresetCreate,
  ScraperPresetUpdate,
  ScraperPresetResponse,
  ScraperPresetListResponse,
  ScheduleSettingsUpdate,
  ScheduleSettingsResponse,
  ATSKeywordDetailedRequest,
  ATSKeywordDetailedResponse,
  ResumeExportRequest,
  ExportTemplatesResponse,
  ImproveSectionRequest,
  ImproveSectionResponse,
  AIChatRequest,
  AIChatResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Token storage keys
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// Token management
export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (accessToken: string, refreshToken: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!tokenManager.getAccessToken();
  },
};

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Add auth header if token exists and auth is required
  if (includeAuth) {
    const token = tokenManager.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && includeAuth) {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await authApi.refresh({ refresh_token: refreshToken });
        tokenManager.setTokens(refreshed.access_token, refreshed.refresh_token);

        // Retry the original request with new token
        headers["Authorization"] = `Bearer ${refreshed.access_token}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ detail: "Unknown error" }));
          throw new Error(error.detail || `HTTP ${retryResponse.status}`);
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      } catch {
        // Refresh failed, clear tokens
        tokenManager.clearTokens();
        throw new Error("Session expired. Please log in again.");
      }
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  register: (data: UserCreate): Promise<UserResponse> =>
    fetchApi("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }, false),

  login: async (data: UserLogin): Promise<Token> => {
    const token = await fetchApi<Token>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }, false);
    tokenManager.setTokens(token.access_token, token.refresh_token);
    return token;
  },

  refresh: (data: TokenRefresh): Promise<Token> =>
    fetchApi("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data),
    }, false),

  me: (): Promise<UserResponse> =>
    fetchApi("/api/auth/me"),

  logout: (): void => {
    tokenManager.clearTokens();
  },
};

// Resume API
export const resumeApi = {
  list: (skip = 0, limit = 100): Promise<ResumeResponse[]> =>
    fetchApi(`/api/resumes?skip=${skip}&limit=${limit}`),

  get: (id: number): Promise<ResumeResponse> =>
    fetchApi(`/api/resumes/${id}`),

  create: (data: ResumeCreate): Promise<ResumeResponse> =>
    fetchApi("/api/resumes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: ResumeUpdate): Promise<ResumeResponse> =>
    fetchApi(`/api/resumes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/resumes/${id}`, {
      method: "DELETE",
    }),

  // Export functions
  getExportTemplates: (): Promise<ExportTemplatesResponse> =>
    fetchApi("/api/resumes/export/templates"),

  export: async (id: number, data: ResumeExportRequest): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE_URL}/api/resumes/${id}/export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenManager.getAccessToken()}`,
        },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.blob();
  },
};

// Job API
export const jobApi = {
  list: (skip = 0, limit = 100): Promise<JobResponse[]> =>
    fetchApi(`/api/jobs?skip=${skip}&limit=${limit}`),

  get: (id: number): Promise<JobResponse> =>
    fetchApi(`/api/jobs/${id}`),

  create: (data: JobCreate): Promise<JobResponse> =>
    fetchApi("/api/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: JobUpdate): Promise<JobResponse> =>
    fetchApi(`/api/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/jobs/${id}`, {
      method: "DELETE",
    }),
};

// Tailor API
export const tailorApi = {
  tailor: (data: TailorRequest): Promise<TailorResponse> =>
    fetchApi("/api/tailor", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  quickMatch: (data: QuickMatchRequest): Promise<QuickMatchResponse> =>
    fetchApi("/api/tailor/quick-match", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: number): Promise<TailorResponse> =>
    fetchApi(`/api/tailor/${id}`),

  list: (): Promise<TailoredResumeListItem[]> =>
    fetchApi("/api/tailor"),

  listByResume: (resumeId: number): Promise<TailoredResumeListItem[]> =>
    fetchApi(`/api/tailor?resume_id=${resumeId}`),

  listByJob: (jobId: number): Promise<TailoredResumeListItem[]> =>
    fetchApi(`/api/tailor?job_id=${jobId}`),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/tailor/${id}`, {
      method: "DELETE",
    }),

  update: (id: number, data: TailoredResumeUpdateRequest): Promise<TailoredResumeFullResponse> =>
    fetchApi(`/api/tailor/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Block API (Vault)
export const blockApi = {
  list: (
    params: {
      block_types?: BlockType[];
      tags?: string[];
      verified_only?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<BlockListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.block_types) {
      params.block_types.forEach((bt) => searchParams.append("block_types", bt));
    }
    if (params.tags) {
      params.tags.forEach((tag) => searchParams.append("tags", tag));
    }
    if (params.verified_only) {
      searchParams.append("verified_only", "true");
    }
    if (params.limit !== undefined) {
      searchParams.append("limit", String(params.limit));
    }
    if (params.offset !== undefined) {
      searchParams.append("offset", String(params.offset));
    }
    const query = searchParams.toString();
    return fetchApi(`/api/v1/blocks${query ? `?${query}` : ""}`);
  },

  get: (id: number): Promise<BlockResponse> =>
    fetchApi(`/api/v1/blocks/${id}`),

  create: (data: BlockCreate): Promise<BlockResponse> =>
    fetchApi("/api/v1/blocks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: BlockUpdate): Promise<BlockResponse> =>
    fetchApi(`/api/v1/blocks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/v1/blocks/${id}`, {
      method: "DELETE",
    }),

  verify: (id: number, verified: boolean = true): Promise<BlockResponse> =>
    fetchApi(`/api/v1/blocks/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ verified }),
    }),

  import: (data: BlockImportRequest): Promise<BlockImportResponse> =>
    fetchApi("/api/v1/blocks/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  embed: (data?: BlockEmbedRequest): Promise<BlockEmbedResponse> =>
    fetchApi("/api/v1/blocks/embed", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  embedSingle: (id: number): Promise<BlockResponse> =>
    fetchApi(`/api/v1/blocks/${id}/embed`, {
      method: "POST",
    }),
};

// Match API (Semantic Search)
export const matchApi = {
  match: (data: MatchRequest): Promise<MatchResponse> =>
    fetchApi("/api/v1/match", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  analyzeGaps: (data: MatchRequest): Promise<GapAnalysisResponse> =>
    fetchApi("/api/v1/match/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getForJob: (jobId: number, limit: number = 20): Promise<MatchResponse> =>
    fetchApi(`/api/v1/match/job/${jobId}?limit=${limit}`),
};

// Resume Build API (formerly Workshop API)
export const resumeBuildApi = {
  list: async (
    params: {
      status?: WorkshopStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WorkshopListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.status) {
      searchParams.append("status", params.status);
    }
    if (params.limit !== undefined) {
      searchParams.append("limit", String(params.limit));
    }
    if (params.offset !== undefined) {
      searchParams.append("offset", String(params.offset));
    }
    const query = searchParams.toString();
    const response = await fetchApi<{ resume_builds: WorkshopResponse[]; total: number; limit: number; offset: number }>(`/api/v1/resume-builds${query ? `?${query}` : ""}`);
    // Transform response for backward compatibility
    return { workshops: response.resume_builds, total: response.total, limit: response.limit, offset: response.offset };
  },

  get: (id: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${id}`),

  create: (data: WorkshopCreate): Promise<WorkshopResponse> =>
    fetchApi("/api/v1/resume-builds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: WorkshopUpdate): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/v1/resume-builds/${id}`, {
      method: "DELETE",
    }),

  pullBlocks: async (id: number, data: PullBlocksRequest): Promise<PullBlocksResponse> => {
    const response = await fetchApi<{ resume_build: WorkshopResponse; newly_pulled: number[]; already_pulled: number[] }>(`/api/v1/resume-builds/${id}/pull`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Transform for backward compatibility
    return { workshop: response.resume_build, newly_pulled: response.newly_pulled, already_pulled: response.already_pulled };
  },

  removeBlock: (resumeBuildId: number, blockId: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${resumeBuildId}/blocks/${blockId}`, {
      method: "DELETE",
    }),

  suggest: async (id: number, data?: SuggestRequest): Promise<SuggestResponse> => {
    const response = await fetchApi<{ resume_build: WorkshopResponse; new_suggestions_count: number; gaps_identified: string[] }>(`/api/v1/resume-builds/${id}/suggest`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
    // Transform for backward compatibility
    return { workshop: response.resume_build, new_suggestions_count: response.new_suggestions_count, gaps_identified: response.gaps_identified };
  },

  acceptDiff: async (id: number, data: DiffActionRequest): Promise<DiffActionResponse> => {
    const response = await fetchApi<{ resume_build: WorkshopResponse; action: "accept" | "reject"; applied_diff?: unknown }>(`/api/v1/resume-builds/${id}/diffs/accept`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Transform for backward compatibility
    return { workshop: response.resume_build, action: response.action, applied_diff: response.applied_diff as DiffActionResponse["applied_diff"] };
  },

  rejectDiff: async (id: number, data: DiffActionRequest): Promise<DiffActionResponse> => {
    const response = await fetchApi<{ resume_build: WorkshopResponse; action: "accept" | "reject"; applied_diff?: unknown }>(`/api/v1/resume-builds/${id}/diffs/reject`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Transform for backward compatibility
    return { workshop: response.resume_build, action: response.action, applied_diff: response.applied_diff as DiffActionResponse["applied_diff"] };
  },

  clearDiffs: (id: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${id}/diffs/clear`, {
      method: "POST",
    }),

  updateSections: (id: number, data: UpdateSectionsRequest): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${id}/sections`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, data: UpdateStatusRequest): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/resume-builds/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  export: async (id: number, data: ExportRequest): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/resume-builds/${id}/export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenManager.getAccessToken()}`,
        },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.blob();
  },
};

// Backward compatibility alias
export const workshopApi = resumeBuildApi;

// Upload API
export const uploadApi = {
  extractDocument: async (file: File): Promise<DocumentExtractionResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/upload/extract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenManager.getAccessToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },
};

// Job Listings API (system-wide jobs from external sources)
export const jobListingApi = {
  list: (filters: JobListingFilters = {}): Promise<JobListingListResponse> => {
    const searchParams = new URLSearchParams();

    if (filters.location) searchParams.append("location", filters.location);
    if (filters.region) searchParams.append("region", filters.region);
    if (filters.country) searchParams.append("country", filters.country);
    if (filters.city) searchParams.append("city", filters.city);
    if (filters.exclude_city) searchParams.append("exclude_city", filters.exclude_city);
    if (filters.exclude_country) searchParams.append("exclude_country", filters.exclude_country);
    if (filters.company_name) searchParams.append("company_name", filters.company_name);
    if (filters.seniority) searchParams.append("seniority", filters.seniority);
    if (filters.job_function) searchParams.append("job_function", filters.job_function);
    if (filters.industry) searchParams.append("industry", filters.industry);
    if (filters.is_remote !== undefined) searchParams.append("is_remote", String(filters.is_remote));
    if (filters.easy_apply !== undefined) searchParams.append("easy_apply", String(filters.easy_apply));
    if (filters.applicants_max !== undefined) searchParams.append("applicants_max", String(filters.applicants_max));
    if (filters.applicants_include_na !== undefined) searchParams.append("applicants_include_na", String(filters.applicants_include_na));
    if (filters.salary_min !== undefined) searchParams.append("salary_min", String(filters.salary_min));
    if (filters.salary_max !== undefined) searchParams.append("salary_max", String(filters.salary_max));
    if (filters.date_posted_after) searchParams.append("date_posted_after", filters.date_posted_after);
    if (filters.search) searchParams.append("search", filters.search);
    if (filters.is_saved !== undefined) searchParams.append("is_saved", String(filters.is_saved));
    if (filters.is_hidden !== undefined) searchParams.append("is_hidden", String(filters.is_hidden));
    if (filters.applied !== undefined) searchParams.append("applied", String(filters.applied));
    if (filters.sort_by) searchParams.append("sort_by", filters.sort_by);
    if (filters.sort_order) searchParams.append("sort_order", filters.sort_order);
    if (filters.limit !== undefined) searchParams.append("limit", String(filters.limit));
    if (filters.offset !== undefined) searchParams.append("offset", String(filters.offset));

    const query = searchParams.toString();
    return fetchApi(`/api/job-listings${query ? `?${query}` : ""}`);
  },

  getFilterOptions: (): Promise<JobListingFilterOptionsResponse> =>
    fetchApi("/api/job-listings/filter-options"),

  search: (q: string, limit = 20, offset = 0): Promise<JobListingListResponse> =>
    fetchApi(`/api/job-listings/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`),

  get: (id: number): Promise<JobListingResponse> =>
    fetchApi(`/api/job-listings/${id}`),

  getSaved: (limit = 50, offset = 0): Promise<JobListingListResponse> =>
    fetchApi(`/api/job-listings/saved?limit=${limit}&offset=${offset}`),

  getApplied: (limit = 50, offset = 0): Promise<JobListingListResponse> =>
    fetchApi(`/api/job-listings/applied?limit=${limit}&offset=${offset}`),

  save: (id: number, save = true): Promise<JobInteractionActionResponse> =>
    fetchApi(`/api/job-listings/${id}/save`, {
      method: "POST",
      body: JSON.stringify({ save } as SaveJobRequest),
    }),

  hide: (id: number, hide = true): Promise<JobInteractionActionResponse> =>
    fetchApi(`/api/job-listings/${id}/hide`, {
      method: "POST",
      body: JSON.stringify({ hide } as HideJobRequest),
    }),

  markApplied: (id: number, applied = true): Promise<JobInteractionActionResponse> =>
    fetchApi(`/api/job-listings/${id}/applied`, {
      method: "POST",
      body: JSON.stringify({ applied } as ApplyJobRequest),
    }),
};

// Admin API
export const adminApi = {
  triggerAdhocScrape: (data: AdHocScrapeRequest): Promise<AdHocScrapeResponse> =>
    fetchApi("/api/admin/scraper/adhoc", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Scraper Presets
  listPresets: (): Promise<ScraperPresetListResponse> =>
    fetchApi("/api/admin/scraper/presets"),

  getPreset: (id: number): Promise<ScraperPresetResponse> =>
    fetchApi(`/api/admin/scraper/presets/${id}`),

  createPreset: (data: ScraperPresetCreate): Promise<ScraperPresetResponse> =>
    fetchApi("/api/admin/scraper/presets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePreset: (id: number, data: ScraperPresetUpdate): Promise<ScraperPresetResponse> =>
    fetchApi(`/api/admin/scraper/presets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePreset: (id: number): Promise<void> =>
    fetchApi(`/api/admin/scraper/presets/${id}`, {
      method: "DELETE",
    }),

  togglePreset: (id: number): Promise<ScraperPresetResponse> =>
    fetchApi(`/api/admin/scraper/presets/${id}/toggle`, {
      method: "POST",
    }),

  // Schedule Settings
  getScheduleSettings: (): Promise<ScheduleSettingsResponse> =>
    fetchApi("/api/admin/scraper/schedule"),

  updateScheduleSettings: (data: ScheduleSettingsUpdate): Promise<ScheduleSettingsResponse> =>
    fetchApi("/api/admin/scraper/schedule", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  toggleSchedule: (): Promise<ScheduleSettingsResponse> =>
    fetchApi("/api/admin/scraper/schedule/toggle", {
      method: "POST",
    }),
};

// ATS Analysis API
export const atsApi = {
  analyzeKeywordsDetailed: (
    data: ATSKeywordDetailedRequest
  ): Promise<ATSKeywordDetailedResponse> =>
    fetchApi("/api/v1/ats/keywords/detailed", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTips: (): Promise<{ tips: string[] }> => fetchApi("/api/v1/ats/tips"),
};

// AI Chat API (Resume Section Improvements)
export const aiApi = {
  improveSection: (data: ImproveSectionRequest): Promise<ImproveSectionResponse> =>
    fetchApi("/api/v1/ai/improve-section", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  chat: (data: AIChatRequest): Promise<AIChatResponse> =>
    fetchApi("/api/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
