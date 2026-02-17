import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  resumeApi,
  jobApi,
  tailorApi,
  blockApi,
  matchApi,
  workshopApi,
  uploadApi,
} from "./client";
import type {
  ResumeCreate,
  ResumeUpdate,
  JobCreate,
  JobUpdate,
  TailorRequest,
  QuickMatchRequest,
  BlockCreate,
  BlockUpdate,
  BlockImportRequest,
  BlockEmbedRequest,
  BlockType,
  MatchRequest,
  WorkshopCreate,
  WorkshopUpdate,
  PullBlocksRequest,
  SuggestRequest,
  UpdateSectionsRequest,
  UpdateStatusRequest,
  ExportRequest,
  WorkshopStatus,
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
    list: () => [...queryKeys.tailored.all, "list"] as const,
    detail: (id: number) => [...queryKeys.tailored.all, "detail", id] as const,
    byResume: (resumeId: number) =>
      [...queryKeys.tailored.all, "resume", resumeId] as const,
    byJob: (jobId: number) =>
      [...queryKeys.tailored.all, "job", jobId] as const,
  },
  blocks: {
    all: ["blocks"] as const,
    list: (params?: {
      block_types?: BlockType[];
      tags?: string[];
      verified_only?: boolean;
    }) => [...queryKeys.blocks.all, "list", params] as const,
    detail: (id: number) => [...queryKeys.blocks.all, "detail", id] as const,
  },
  match: {
    all: ["match"] as const,
    result: (jobDescription: string) =>
      [...queryKeys.match.all, "result", jobDescription] as const,
    forJob: (jobId: number) => [...queryKeys.match.all, "job", jobId] as const,
    gaps: (jobDescription: string) =>
      [...queryKeys.match.all, "gaps", jobDescription] as const,
  },
  workshops: {
    all: ["workshops"] as const,
    list: (status?: WorkshopStatus) =>
      [...queryKeys.workshops.all, "list", status] as const,
    detail: (id: number) =>
      [...queryKeys.workshops.all, "detail", id] as const,
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

export function useTailoredResumes() {
  return useQuery({
    queryKey: queryKeys.tailored.list(),
    queryFn: () => tailorApi.list(),
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

// Block Hooks (Vault)
export function useBlocks(params?: {
  block_types?: BlockType[];
  tags?: string[];
  verified_only?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.blocks.list(params),
    queryFn: () => blockApi.list(params),
  });
}

export function useBlock(id: number) {
  return useQuery({
    queryKey: queryKeys.blocks.detail(id),
    queryFn: () => blockApi.get(id),
    enabled: !!id,
  });
}

export function useCreateBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BlockCreate) => blockApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

export function useUpdateBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BlockUpdate }) =>
      blockApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

export function useDeleteBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => blockApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

export function useVerifyBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, verified }: { id: number; verified?: boolean }) =>
      blockApi.verify(id, verified),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

export function useImportBlocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BlockImportRequest) => blockApi.import(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

export function useEmbedBlocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: BlockEmbedRequest) => blockApi.embed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.all });
    },
  });
}

// Match Hooks (Semantic Search)
export function useMatch(data: MatchRequest, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.match.result(data.job_description),
    queryFn: () => matchApi.match(data),
    enabled,
  });
}

export function useMatchMutation() {
  return useMutation({
    mutationFn: (data: MatchRequest) => matchApi.match(data),
  });
}

export function useMatchForJob(jobId: number) {
  return useQuery({
    queryKey: queryKeys.match.forJob(jobId),
    queryFn: () => matchApi.getForJob(jobId),
    enabled: !!jobId,
  });
}

export function useAnalyzeGaps() {
  return useMutation({
    mutationFn: (data: MatchRequest) => matchApi.analyzeGaps(data),
  });
}

// Workshop Hooks
export function useWorkshops(status?: WorkshopStatus) {
  return useQuery({
    queryKey: queryKeys.workshops.list(status),
    queryFn: () => workshopApi.list({ status }),
  });
}

export function useWorkshop(id: number) {
  return useQuery({
    queryKey: queryKeys.workshops.detail(id),
    queryFn: () => workshopApi.get(id),
    enabled: !!id,
  });
}

export function useCreateWorkshop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WorkshopCreate) => workshopApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workshops.all });
    },
  });
}

export function useUpdateWorkshop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WorkshopUpdate }) =>
      workshopApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workshops.all });
    },
  });
}

export function useDeleteWorkshop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => workshopApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workshops.all });
    },
  });
}

export function usePullBlocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      data,
    }: {
      workshopId: number;
      data: PullBlocksRequest;
    }) => workshopApi.pullBlocks(workshopId, data),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useRemoveBlockFromWorkshop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      blockId,
    }: {
      workshopId: number;
      blockId: number;
    }) => workshopApi.removeBlock(workshopId, blockId),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useGenerateSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      data,
    }: {
      workshopId: number;
      data?: SuggestRequest;
    }) => workshopApi.suggest(workshopId, data),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useAcceptDiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      diffIndex,
    }: {
      workshopId: number;
      diffIndex: number;
    }) => workshopApi.acceptDiff(workshopId, { diff_index: diffIndex }),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useRejectDiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      diffIndex,
    }: {
      workshopId: number;
      diffIndex: number;
    }) => workshopApi.rejectDiff(workshopId, { diff_index: diffIndex }),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useClearDiffs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workshopId: number) => workshopApi.clearDiffs(workshopId),
    onSuccess: (_, workshopId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useUpdateSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      data,
    }: {
      workshopId: number;
      data: UpdateSectionsRequest;
    }) => workshopApi.updateSections(workshopId, data),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
    },
  });
}

export function useUpdateWorkshopStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workshopId,
      data,
    }: {
      workshopId: number;
      data: UpdateStatusRequest;
    }) => workshopApi.updateStatus(workshopId, data),
    onSuccess: (_, { workshopId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workshops.detail(workshopId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workshops.all });
    },
  });
}

export function useExportWorkshop() {
  return useMutation({
    mutationFn: ({
      workshopId,
      data,
    }: {
      workshopId: number;
      data: ExportRequest;
    }) => workshopApi.export(workshopId, data),
  });
}

// Upload Hooks
export function useExtractDocument() {
  return useMutation({
    mutationFn: (file: File) => uploadApi.extractDocument(file),
  });
}
