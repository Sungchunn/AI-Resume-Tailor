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

// Workshop API
export const workshopApi = {
  list: (
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
    return fetchApi(`/api/v1/workshops${query ? `?${query}` : ""}`);
  },

  get: (id: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${id}`),

  create: (data: WorkshopCreate): Promise<WorkshopResponse> =>
    fetchApi("/api/v1/workshops", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: WorkshopUpdate): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    fetchApi(`/api/v1/workshops/${id}`, {
      method: "DELETE",
    }),

  pullBlocks: (id: number, data: PullBlocksRequest): Promise<PullBlocksResponse> =>
    fetchApi(`/api/v1/workshops/${id}/pull`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeBlock: (workshopId: number, blockId: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${workshopId}/blocks/${blockId}`, {
      method: "DELETE",
    }),

  suggest: (id: number, data?: SuggestRequest): Promise<SuggestResponse> =>
    fetchApi(`/api/v1/workshops/${id}/suggest`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  acceptDiff: (id: number, data: DiffActionRequest): Promise<DiffActionResponse> =>
    fetchApi(`/api/v1/workshops/${id}/diffs/accept`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rejectDiff: (id: number, data: DiffActionRequest): Promise<DiffActionResponse> =>
    fetchApi(`/api/v1/workshops/${id}/diffs/reject`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  clearDiffs: (id: number): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${id}/diffs/clear`, {
      method: "POST",
    }),

  updateSections: (id: number, data: UpdateSectionsRequest): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${id}/sections`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, data: UpdateStatusRequest): Promise<WorkshopResponse> =>
    fetchApi(`/api/v1/workshops/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  export: async (id: number, data: ExportRequest): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workshops/${id}/export`,
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
