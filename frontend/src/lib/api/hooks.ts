import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resumeApi, jobApi } from "./client";
import type { ResumeCreate, ResumeUpdate, JobCreate, JobUpdate } from "./types";

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
