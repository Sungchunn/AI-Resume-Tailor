import type {
  ResumeCreate,
  ResumeUpdate,
  ResumeResponse,
  JobCreate,
  JobUpdate,
  JobResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
