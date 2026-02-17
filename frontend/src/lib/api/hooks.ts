import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resumeApi, jobApi, tailorApi } from "./client";
import type {
  ResumeCreate,
  ResumeUpdate,
  JobCreate,
  JobUpdate,
  TailorRequest,
  QuickMatchRequest,
} from "./types";

// Query Keys
export const queryKeys = {
  resumes: {
    all: ["resumes"] as const,
    list: () => [...queryKeys.resumes.all, "list"] as const,
    detail: (id: number) => [...queryKeys.resumes.all, "detail", id] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: () => [...queryKeys.jobs.all, "list"] as const,
    detail: (id: number) => [...queryKeys.jobs.all, "detail", id] as const,
  },
  tailored: {
    all: ["tailored"] as const,
    detail: (id: number) => [...queryKeys.tailored.all, "detail", id] as const,
    byResume: (resumeId: number) =>
      [...queryKeys.tailored.all, "resume", resumeId] as const,
    byJob: (jobId: number) => [...queryKeys.tailored.all, "job", jobId] as const,
  },
};

// Resume Hooks
export function useResumes() {
  return useQuery({
    queryKey: queryKeys.resumes.list(),
    queryFn: () => resumeApi.list(),
  });
}

export function useResume(id: number) {
  return useQuery({
    queryKey: queryKeys.resumes.detail(id),
    queryFn: () => resumeApi.get(id),
    enabled: !!id,
  });
}

export function useCreateResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResumeCreate) => resumeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

export function useUpdateResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ResumeUpdate }) =>
      resumeApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.list() });
    },
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => resumeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

// Job Hooks
export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: () => jobApi.list(),
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: () => jobApi.get(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JobCreate) => jobApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: JobUpdate }) =>
      jobApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => jobApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

// Tailor Hooks
export function useTailorResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TailorRequest) => tailorApi.tailor(data),
    onSuccess: (_, { resume_id, job_id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tailored.byResume(resume_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tailored.byJob(job_id),
      });
    },
  });
}

export function useQuickMatch() {
  return useMutation({
    mutationFn: (data: QuickMatchRequest) => tailorApi.quickMatch(data),
  });
}

export function useTailoredResume(id: number) {
  return useQuery({
    queryKey: queryKeys.tailored.detail(id),
    queryFn: () => tailorApi.get(id),
    enabled: !!id,
  });
}

export function useTailoredResumesByResume(resumeId: number) {
  return useQuery({
    queryKey: queryKeys.tailored.byResume(resumeId),
    queryFn: () => tailorApi.listByResume(resumeId),
    enabled: !!resumeId,
  });
}

export function useTailoredResumesByJob(jobId: number) {
  return useQuery({
    queryKey: queryKeys.tailored.byJob(jobId),
    queryFn: () => tailorApi.listByJob(jobId),
    enabled: !!jobId,
  });
}

export function useDeleteTailoredResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => tailorApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tailored.all });
    },
  });
}
