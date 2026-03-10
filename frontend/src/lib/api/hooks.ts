import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  resumeApi,
  jobApi,
  jobListingApi,
  tailorApi,
  blockApi,
  matchApi,
  workshopApi,
  uploadApi,
  adminApi,
  atsApi,
  scraperRequestApi,
  profileApi,
  tokenManager,
} from "./client";
import type {
  ResumeCreate,
  ResumeUpdate,
  JobCreate,
  JobUpdate,
  TailorRequest,
  QuickMatchRequest,
  TailoredResumeUpdateRequest,
  TailoringFinalizeRequest,
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
  JobListingFilters,
  ApplicationStatus,
  AdHocScrapeRequest,
  ScraperPresetCreate,
  ScraperPresetUpdate,
  ScheduleSettingsUpdate,
  ATSKeywordDetailedRequest,
  ScraperRequestCreate,
  ScraperRequestStatus,
  ScraperRequestApproveRequest,
  ScraperRequestRejectRequest,
  GenerateAboutMeRequest,
} from "./types";

// Query Keys
export const queryKeys = {
  resumes: {
    all: ["resumes"] as const,
    list: () => [...queryKeys.resumes.all, "list"] as const,
    detail: (id: string) => [...queryKeys.resumes.all, "detail", id] as const,
    parseStatus: (resumeId: string, taskId: string) =>
      [...queryKeys.resumes.all, "parseStatus", resumeId, taskId] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: () => [...queryKeys.jobs.all, "list"] as const,
    detail: (id: number) => [...queryKeys.jobs.all, "detail", id] as const,
  },
  tailored: {
    all: ["tailored"] as const,
    list: () => [...queryKeys.tailored.all, "list"] as const,
    detail: (id: string) => [...queryKeys.tailored.all, "detail", id] as const,
    byResume: (resumeId: string) =>
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
  jobListings: {
    all: ["jobListings"] as const,
    list: (filters?: JobListingFilters) =>
      [...queryKeys.jobListings.all, "list", filters] as const,
    detail: (id: number) =>
      [...queryKeys.jobListings.all, "detail", id] as const,
    saved: () => [...queryKeys.jobListings.all, "saved"] as const,
    applied: () => [...queryKeys.jobListings.all, "applied"] as const,
    search: (query: string) =>
      [...queryKeys.jobListings.all, "search", query] as const,
    kanban: () => [...queryKeys.jobListings.all, "kanban"] as const,
  },
  scraperPresets: {
    all: ["scraperPresets"] as const,
    list: () => [...queryKeys.scraperPresets.all, "list"] as const,
    detail: (id: number) =>
      [...queryKeys.scraperPresets.all, "detail", id] as const,
  },
  scheduleSettings: {
    all: ["scheduleSettings"] as const,
  },
  scraperRequests: {
    all: ["scraperRequests"] as const,
    myList: () => [...queryKeys.scraperRequests.all, "my"] as const,
    adminList: (status?: ScraperRequestStatus) =>
      [...queryKeys.scraperRequests.all, "admin", status] as const,
  },
  profile: {
    all: ["profile"] as const,
    aboutMe: () => [...queryKeys.profile.all, "aboutMe"] as const,
  },
};

// Resume Hooks
export function useResumes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.resumes.list(),
    queryFn: () => resumeApi.list(),
    enabled: options?.enabled,
  });
}

export function useResume(id: string) {
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
    mutationFn: ({ id, data }: { id: string; data: ResumeUpdate }) =>
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
    mutationFn: (id: string) => resumeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

export function useSetMasterResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resumeApi.setMaster(id),
    onSuccess: (_, id) => {
      // Invalidate all resumes since the old master was also updated
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

export function useExportTemplates() {
  return useQuery({
    queryKey: [...queryKeys.resumes.all, "exportTemplates"] as const,
    queryFn: () => resumeApi.getExportTemplates(),
  });
}

export function useExportResume() {
  return useMutation({
    mutationFn: ({
      resumeId,
      data,
    }: {
      resumeId: string;
      data: import("./types").ResumeExportRequest;
    }) => resumeApi.export(resumeId, data),
  });
}

// Trigger parse mutation
export function useParseResume() {
  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      resumeApi.parse(id, force),
  });
}

// Poll for parse status (enabled when taskId is set)
export function useParseStatus(resumeId: string, taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.resumes.parseStatus(resumeId, taskId ?? ""),
    queryFn: () => resumeApi.getParseStatus(resumeId, taskId!),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when completed or failed
      if (status === "completed" || status === "failed") return false;
      return 3000; // Poll every 3 seconds
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
      if (job_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tailored.byJob(job_id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.tailored.list(),
      });
    },
  });
}

export function useQuickMatch() {
  return useMutation({
    mutationFn: (data: QuickMatchRequest) => tailorApi.quickMatch(data),
  });
}

export function useTailoredResume(id: string) {
  return useQuery({
    queryKey: queryKeys.tailored.detail(id),
    queryFn: () => tailorApi.get(id),
    enabled: !!id,
  });
}

export function useTailoredResumesByResume(resumeId: string) {
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

/**
 * Hook to fetch tailored resumes filtered by both resume and job.
 * Used in the version history sidebar to show job-scoped versions.
 */
export function useTailoredResumesByResumeAndJob(
  resumeId: string,
  jobListingId?: number,
  jobId?: number
) {
  const hasJobFilter = !!jobListingId || !!jobId;
  return useQuery({
    queryKey: [
      ...queryKeys.tailored.byResume(resumeId),
      "job",
      jobListingId ?? jobId,
    ] as const,
    queryFn: () => tailorApi.listByResumeAndJob(resumeId, jobListingId, jobId),
    enabled: !!resumeId && hasJobFilter,
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
    mutationFn: (id: string) => tailorApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tailored.all });
    },
  });
}

export function useUpdateTailoredResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TailoredResumeUpdateRequest }) =>
      tailorApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tailored.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tailored.all });
    },
  });
}

/**
 * Hook to fetch comparison data for the diff review UI.
 * Returns both original and AI-proposed resume blocks.
 */
export function useTailoringCompare(id: string) {
  return useQuery({
    queryKey: [...queryKeys.tailored.detail(id), "compare"] as const,
    queryFn: () => tailorApi.compare(id),
    enabled: !!id,
  });
}

/**
 * Hook to finalize a tailored resume after user review.
 */
export function useFinalizeTailoredResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TailoringFinalizeRequest }) =>
      tailorApi.finalize(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tailored.detail(id) });
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
  enabled?: boolean;
}) {
  const { enabled, ...queryParams } = params ?? {};
  return useQuery({
    queryKey: queryKeys.blocks.list(queryParams),
    queryFn: () => blockApi.list(queryParams),
    enabled,
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

// Job Listing Hooks (system-wide jobs from external sources)
export function useJobListings(filters?: JobListingFilters) {
  return useQuery({
    queryKey: queryKeys.jobListings.list(filters),
    queryFn: () => jobListingApi.list(filters),
  });
}

export function useJobListing(id: number) {
  return useQuery({
    queryKey: queryKeys.jobListings.detail(id),
    queryFn: () => jobListingApi.get(id),
    enabled: !!id,
  });
}

export function useSavedJobListings(options?: {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const { limit = 50, offset = 0, enabled } = options ?? {};
  return useQuery({
    queryKey: queryKeys.jobListings.saved(),
    queryFn: () => jobListingApi.getSaved(limit, offset),
    enabled,
  });
}

export function useAppliedJobListings(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.jobListings.applied(),
    queryFn: () => jobListingApi.getApplied(limit, offset),
  });
}

export function useSearchJobListings(query: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: queryKeys.jobListings.search(query),
    queryFn: () => jobListingApi.search(query, limit, offset),
    enabled: query.length > 0,
  });
}

export function useSaveJobListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, save }: { id: number; save?: boolean }) =>
      jobListingApi.save(id, save),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.all });
    },
  });
}

export function useHideJobListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, hide }: { id: number; hide?: boolean }) =>
      jobListingApi.hide(id, hide),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.all });
    },
  });
}

export function useMarkJobApplied() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, applied }: { id: number; applied?: boolean }) =>
      jobListingApi.markApplied(id, applied),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.all });
    },
  });
}

// Kanban Board Hooks
export function useKanbanBoard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobListings.kanban(),
    queryFn: () => jobListingApi.getKanbanBoard(),
    enabled: options?.enabled,
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ApplicationStatus }) =>
      jobListingApi.updateApplicationStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.kanban() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.applied() });
    },
  });
}

export function useReorderKanbanColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ status, jobListingIds }: { status: ApplicationStatus; jobListingIds: number[] }) =>
      jobListingApi.reorderKanbanColumn(status, jobListingIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.kanban() });
    },
  });
}

// Admin Hooks
export function useAdhocScrape() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdHocScrapeRequest) => adminApi.triggerAdhocScrape(data),
    onSuccess: () => {
      // Invalidate job listings to show newly scraped jobs
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.all });
    },
  });
}

export function useTriggerScraper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminApi.triggerScraper(),
    onSuccess: () => {
      // Invalidate job listings to show newly scraped jobs
      queryClient.invalidateQueries({ queryKey: queryKeys.jobListings.all });
      // Invalidate schedule settings to update last_run_at
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSettings.all });
    },
  });
}

// Scraper Preset Hooks
export function useScraperPresets() {
  return useQuery({
    queryKey: queryKeys.scraperPresets.list(),
    queryFn: () => adminApi.listPresets(),
  });
}

export function useScraperPreset(id: number) {
  return useQuery({
    queryKey: queryKeys.scraperPresets.detail(id),
    queryFn: () => adminApi.getPreset(id),
    enabled: !!id,
  });
}

export function useCreateScraperPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScraperPresetCreate) => adminApi.createPreset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

export function useUpdateScraperPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScraperPresetUpdate }) =>
      adminApi.updatePreset(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

export function useDeleteScraperPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminApi.deletePreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

export function useToggleScraperPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminApi.togglePreset(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

// Schedule Settings Hooks
export function useScheduleSettings() {
  return useQuery({
    queryKey: queryKeys.scheduleSettings.all,
    queryFn: () => adminApi.getScheduleSettings(),
  });
}

export function useUpdateScheduleSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduleSettingsUpdate) => adminApi.updateScheduleSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSettings.all });
    },
  });
}

export function useToggleSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminApi.toggleSchedule(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSettings.all });
    },
  });
}

// ATS Analysis Hooks
export function useATSKeywordAnalysis() {
  return useMutation({
    mutationFn: (data: ATSKeywordDetailedRequest) =>
      atsApi.analyzeKeywordsDetailed(data),
  });
}

export function useATSTips() {
  return useQuery({
    queryKey: ["ats", "tips"],
    queryFn: () => atsApi.getTips(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}

// Scraper Request Hooks (User-facing)
export function useMyScraperRequests(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.scraperRequests.myList(),
    queryFn: () => scraperRequestApi.list(limit, offset),
  });
}

export function useCreateScraperRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScraperRequestCreate) => scraperRequestApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}

export function useCancelScraperRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => scraperRequestApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}

// Scraper Request Hooks (Admin)
export function useAdminScraperRequests(status?: ScraperRequestStatus, limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.scraperRequests.adminList(status),
    queryFn: () => adminApi.listScraperRequests(status, limit, offset),
  });
}

export function useApproveScraperRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScraperRequestApproveRequest }) =>
      adminApi.approveScraperRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperPresets.all });
    },
  });
}

export function useRejectScraperRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScraperRequestRejectRequest }) =>
      adminApi.rejectScraperRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scraperRequests.all });
    },
  });
}

// Profile Hooks
export function useGenerateAboutMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: GenerateAboutMeRequest) => profileApi.generateAboutMe(data),
    onSuccess: () => {
      // Invalidate the user profile to show updated about_me
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.aboutMe() });
    },
  });
}

// Progressive ATS Analysis with SSE
import { useCallback } from "react";
import { useATSProgressStore } from "@/lib/stores/atsProgressStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Hook for progressive ATS analysis with SSE streaming.
 *
 * Automatically manages EventSource connection and updates global state.
 * Analysis continues even if component unmounts (background execution).
 */
export function useATSProgressiveAnalysis() {
  const store = useATSProgressStore();

  const startAnalysis = useCallback(
    (resumeId: string, options: { jobId?: number; jobListingId?: number; forceRefresh?: boolean }) => {
      // Close any existing connection
      store.closeConnection();

      // Initialize analysis state (use effective job ID for store)
      const effectiveJobId = options.jobId || options.jobListingId || 0;
      store.startAnalysis(effectiveJobId, effectiveJobId);

      // Build query params
      const params = new URLSearchParams();
      params.set("resume_id", resumeId);
      if (options.jobId) {
        params.set("job_id", options.jobId.toString());
      }
      if (options.jobListingId) {
        params.set("job_listing_id", options.jobListingId.toString());
      }
      if (options.forceRefresh) {
        params.set("force_refresh", "true");
      }

      // Add auth token as query param (EventSource doesn't support headers)
      const accessToken = tokenManager.getAccessToken();
      if (accessToken) {
        params.set("token", accessToken);
      }

      // Create SSE connection
      const url = `${API_BASE_URL}/api/v1/ats/analyze-progressive?${params.toString()}`;
      const eventSource = new EventSource(url);

      // Store event source in global state
      useATSProgressStore.setState({ eventSource });

      // Event handlers
      eventSource.addEventListener("cache_hit", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        console.log("ATS analysis cache hit:", data.cached_at);
      });

      eventSource.addEventListener("cache_miss", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        console.log("ATS analysis cache miss, running fresh analysis for job:", data.job_id);
      });

      eventSource.addEventListener("stage_start", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(data);
      });

      eventSource.addEventListener("stage_complete", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(data);
      });

      eventSource.addEventListener("stage_error", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(data);
      });

      eventSource.addEventListener("score_calculation", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(data);
      });

      eventSource.addEventListener("complete", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        if (data.composite_score) {
          // Convert snake_case from backend to camelCase for frontend
          // Handle potential undefined/NaN values defensively
          const rawScore = data.composite_score.final_score;
          if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) {
            console.warn('ATS composite score is invalid:', rawScore, 'Full data:', data.composite_score);
          }
          const compositeScore = {
            finalScore: typeof rawScore === 'number' && !Number.isNaN(rawScore) ? rawScore : 0,
            stageBreakdown: data.composite_score.stage_breakdown || {},
            weightsUsed: data.composite_score.weights_used || {},
            normalizationApplied: data.composite_score.normalization_applied || false,
            failedStages: data.composite_score.failed_stages || [],
          };
          store.setCompositeScore(compositeScore);
        }
        store.completeAnalysis();
      });

      eventSource.addEventListener("error", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.setError(data.error || "Unknown error occurred");
      });

      // Handle connection errors
      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);

        // Check if error is due to auth or network
        if (eventSource.readyState === EventSource.CLOSED) {
          store.setError("Connection lost. Please try again.");
        }
      };

      return eventSource;
    },
    [store]
  );

  return {
    ...store,
    startAnalysis, // Override store's startAnalysis with SSE-enabled version
  };
}
