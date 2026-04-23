import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  resumeApi,
  jobApi,
  jobListingApi,
  tailorApi,
  matchApi,
  workshopApi,
  uploadApi,
  adminApi,
  atsApi,
  scraperRequestApi,
  profileApi,
  authApi,
} from "./client";
import { VersionConflictError, isVersionConflictError } from "./errors";
import type {
  ResumeCreate,
  ResumeUpdate,
  JobCreate,
  JobUpdate,
  TailorRequest,
  QuickMatchRequest,
  TailoredResumeUpdateRequest,
  TailoringFinalizeRequest,
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
  ATSContentAnalysisRequest,
  ScraperRequestCreate,
  ScraperRequestStatus,
  ScraperRequestApproveRequest,
  ScraperRequestRejectRequest,
  GenerateAboutMeRequest,
  UpdateProfileRequest,
  AIPreferencesUpdate,
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
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
  },
  tailored: {
    all: ["tailored"] as const,
    list: () => [...queryKeys.tailored.all, "list"] as const,
    detail: (id: string) => [...queryKeys.tailored.all, "detail", id] as const,
    byResume: (resumeId: string) =>
      [...queryKeys.tailored.all, "resume", resumeId] as const,
    byJob: (jobId: string) =>
      [...queryKeys.tailored.all, "job", jobId] as const,
  },
  match: {
    all: ["match"] as const,
    result: (jobDescription: string) =>
      [...queryKeys.match.all, "result", jobDescription] as const,
    forJob: (jobId: string) => [...queryKeys.match.all, "job", jobId] as const,
    gaps: (jobDescription: string) =>
      [...queryKeys.match.all, "gaps", jobDescription] as const,
  },
  workshops: {
    all: ["workshops"] as const,
    list: (status?: WorkshopStatus) =>
      [...queryKeys.workshops.all, "list", status] as const,
    detail: (id: string) =>
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
    filterOptions: () => [...queryKeys.jobListings.all, "filterOptions"] as const,
    fitScoreMeta: () => [...queryKeys.jobListings.all, "fit-score-meta"] as const,
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
    aiPreferences: () => [...queryKeys.profile.all, "aiPreferences"] as const,
  },
  aiUsage: {
    all: ["aiUsage"] as const,
    summary: (start: string, end: string) =>
      [...queryKeys.aiUsage.all, "summary", start, end] as const,
    byEndpoint: (start: string, end: string) =>
      [...queryKeys.aiUsage.all, "byEndpoint", start, end] as const,
    byProvider: (start: string, end: string) =>
      [...queryKeys.aiUsage.all, "byProvider", start, end] as const,
    byUser: (start: string, end: string, limit: number) =>
      [...queryKeys.aiUsage.all, "byUser", start, end, limit] as const,
    timeSeries: (start: string, end: string, granularity: string) =>
      [...queryKeys.aiUsage.all, "timeSeries", start, end, granularity] as const,
    pricing: () => [...queryKeys.aiUsage.all, "pricing"] as const,
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

export interface UseUpdateResumeOptions {
  /**
   * Callback invoked when a version conflict (HTTP 409) occurs.
   * Use this to show conflict UI.
   */
  onVersionConflict?: (error: VersionConflictError) => void;
}

export function useUpdateResume(options?: UseUpdateResumeOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResumeUpdate }) =>
      resumeApi.update(id, data),
    onSuccess: (updatedResume, { id }) => {
      // Update cache with new data (includes new version)
      queryClient.setQueryData(queryKeys.resumes.detail(id), updatedResume);
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.list() });
    },
    onError: (error) => {
      if (isVersionConflictError(error) && options?.onVersionConflict) {
        options.onVersionConflict(error);
      }
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

/**
 * Hook to mark a resume's parsed content as verified.
 * Part of Parse-Once, Tailor-Many architecture.
 */
export function useVerifyResumeParsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resumeApi.verifyParsed(id),
    onSuccess: (_, id) => {
      // Invalidate resume queries to refetch with updated verification status
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.list() });
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

export function useJob(id: string) {
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
    mutationFn: ({ id, data }: { id: string; data: JobUpdate }) =>
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
    mutationFn: (id: string) => jobApi.delete(id),
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

export function useTailoredResumesByJob(jobId: string) {
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
  jobId?: string
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

export function useMatchForJob(jobId: string) {
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

export function useWorkshop(id: string) {
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
    mutationFn: ({ id, data }: { id: string; data: WorkshopUpdate }) =>
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
    mutationFn: (id: string) => workshopApi.delete(id),
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
      workshopId: string;
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
      workshopId: string;
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
      workshopId: string;
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
      workshopId: string;
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
      workshopId: string;
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
    mutationFn: (workshopId: string) => workshopApi.clearDiffs(workshopId),
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
      workshopId: string;
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
      workshopId: string;
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
      workshopId: string;
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
    placeholderData: keepPreviousData,
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: queryKeys.jobListings.filterOptions(),
    queryFn: () => jobListingApi.getFilterOptions(),
    staleTime: 60 * 60 * 1000, // 1 hour — filter options change infrequently
  });
}

/**
 * Metadata about the most recent fit-score batch run. Drives the
 * "Scores refreshed Xh ago (daily batch)" subtitle on /jobs.
 */
export function useFitScoreMeta() {
  return useQuery({
    queryKey: queryKeys.jobListings.fitScoreMeta(),
    queryFn: () => jobListingApi.getFitScoreMeta(),
    staleTime: 5 * 60 * 1000, // 5 min — batch runs daily
  });
}

/**
 * Run deep analysis for the user's master resume against a job listing.
 *
 * Returns a mutation so callers can fire it on click and observe
 * ``isPending`` for the 30–60s spinner. Supports cancellation via an
 * ``AbortSignal`` passed through ``mutate({ signal })``. On 429 the
 * rejected promise carries a ``DeepAnalysisQuotaError`` with structured
 * quota state for the error banner.
 */
export function useJobDeepAnalysis() {
  return useMutation({
    mutationFn: ({
      jobId,
      signal,
    }: {
      jobId: number;
      signal?: AbortSignal;
    }) => jobListingApi.runDeepAnalysis(jobId, { signal }),
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

// DEPRECATED: kept for the orphan editor and backend tests; new code should
// use `useATSContentAnalysis` which runs the same 5-stage pipeline as
// `/tailor/analyze` and produces a matching composite score.
export function useATSKeywordAnalysis() {
  return useMutation({
    mutationFn: (data: ATSKeywordDetailedRequest) =>
      atsApi.analyzeKeywordsDetailed(data),
  });
}

export function useATSContentAnalysis() {
  return useMutation({
    mutationFn: (data: ATSContentAnalysisRequest) =>
      atsApi.analyzeContent(data),
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

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => profileApi.updateProfile(data),
    onSuccess: () => {
      // Invalidate profile queries to show updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
}

// AI Model Preferences Hooks
export function useAIPreferences() {
  return useQuery({
    queryKey: queryKeys.profile.aiPreferences(),
    queryFn: () => profileApi.getAIPreferences(),
  });
}

export function useUpdateAIPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AIPreferencesUpdate) =>
      profileApi.updateAIPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile.aiPreferences(),
      });
    },
  });
}

// AI Usage Dashboard Hooks
export function useAIUsageSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.summary(startDate, endDate),
    queryFn: () => adminApi.getAIUsageSummary(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByEndpoint(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byEndpoint(startDate, endDate),
    queryFn: () => adminApi.getAIUsageByEndpoint(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByProvider(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byProvider(startDate, endDate),
    queryFn: () => adminApi.getAIUsageByProvider(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageByUser(startDate: string, endDate: string, limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.aiUsage.byUser(startDate, endDate, limit),
    queryFn: () => adminApi.getAIUsageByUser(startDate, endDate, limit),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIUsageTimeSeries(
  startDate: string,
  endDate: string,
  granularity: "hour" | "day" | "week" = "day"
) {
  return useQuery({
    queryKey: queryKeys.aiUsage.timeSeries(startDate, endDate, granularity),
    queryFn: () => adminApi.getAIUsageTimeSeries(startDate, endDate, granularity),
    enabled: !!startDate && !!endDate,
  });
}

export function useAIPricing() {
  return useQuery({
    queryKey: queryKeys.aiUsage.pricing(),
    queryFn: () => adminApi.getAIPricing(),
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
    async (resumeId: string, options: { jobId?: string; jobListingId?: number; forceRefresh?: boolean }) => {
      // Close any existing connection
      store.closeConnection();

      // Initialize analysis state (use effective job ID for store)
      // Convert to string for consistent storage (both UUIDs and job listing IDs as strings)
      const effectiveJobId = options.jobId || (options.jobListingId?.toString()) || "0";
      store.startAnalysis(resumeId, effectiveJobId);

      // Build query params
      const params = new URLSearchParams();
      params.set("resume_id", resumeId);
      if (options.jobId) {
        params.set("job_id", options.jobId);
      }
      if (options.jobListingId) {
        params.set("job_listing_id", options.jobListingId.toString());
      }
      if (options.forceRefresh) {
        params.set("force_refresh", "true");
      }

      // Exchange JWT for a one-time SSE ticket
      let ticket: string;
      try {
        ({ ticket } = await authApi.sseTicket());
      } catch {
        store.setError("Failed to obtain SSE ticket");
        return;
      }
      params.set("ticket", ticket);

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

      // Helper to convert snake_case SSE data to camelCase for store
      const transformStageData = (data: Record<string, unknown>) => ({
        stage: data.stage as number,
        stageName: data.stage_name as string,
        status: data.status as 'pending' | 'running' | 'completed' | 'failed',
        progressPercent: (data.progress_percent as number) ?? 0,
        elapsedMs: data.elapsed_ms as number | undefined,
        result: data.result,
        error: data.error as string | undefined,
      });

      eventSource.addEventListener("stage_start", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(transformStageData(data));
      });

      eventSource.addEventListener("stage_complete", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(transformStageData(data));
      });

      eventSource.addEventListener("stage_error", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(transformStageData(data));
      });

      eventSource.addEventListener("score_calculation", (e: Event) => {
        const customEvent = e as MessageEvent;
        const data = JSON.parse(customEvent.data);
        store.updateStage(transformStageData(data));
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
