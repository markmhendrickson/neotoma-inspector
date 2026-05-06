import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isApiUrlConfigured } from "@/api/client";
import {
  adminFeedbackPreflight,
  findFeedbackByCommit,
  listAllFeedback,
  listPendingFeedback,
  updateFeedbackStatus,
  type UpdateFeedbackStatusRequest,
} from "@/api/endpoints/feedback_admin";

/**
 * Preflight check: is the /admin/feedback/* proxy configured? Does NOT
 * gate on AAuth tier (the caller is assumed to be inside the Inspector);
 * we check tier when the maintainer actually submits a write.
 */
export function useAdminFeedbackPreflight() {
  return useQuery({
    queryKey: ["admin-feedback-preflight"],
    queryFn: adminFeedbackPreflight,
    staleTime: 60_000,
    retry: false,
    enabled: isApiUrlConfigured(),
  });
}

export function usePendingFeedback(options?: { limit?: number; offset?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["admin-feedback-pending", options?.limit ?? 50, options?.offset ?? 0],
    queryFn: () => listPendingFeedback(options),
    placeholderData: keepPreviousData,
    enabled: isApiUrlConfigured() && options?.enabled !== false,
  });
}

export function useFindFeedbackByCommit(sha: string | null) {
  return useQuery({
    queryKey: ["admin-feedback-by-commit", sha],
    queryFn: () => findFeedbackByCommit(sha!),
    enabled: isApiUrlConfigured() && !!sha && sha.trim().length > 0,
  });
}

export function useAllFeedback(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["admin-feedback-all"],
    queryFn: listAllFeedback,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: isApiUrlConfigured() && options?.enabled !== false,
  });
}

export function useUpdateFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { feedbackId: string; body: UpdateFeedbackStatusRequest }) =>
      updateFeedbackStatus(args.feedbackId, args.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neotoma-feedback"] });
      qc.invalidateQueries({ queryKey: ["entity"] });
      qc.invalidateQueries({ queryKey: ["entity-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-feedback-pending"] });
    },
  });
}
