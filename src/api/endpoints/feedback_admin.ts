import { get, post } from "../client";

/**
 * Client bindings for the Neotoma server's `/admin/feedback/*` proxy.
 * See `src/services/feedback/admin_proxy.ts` for the server contract
 * (env-gated, hardware/software AAuth tier required).
 */

export type AdminFeedbackMode = "hosted" | "local" | "disabled";

export interface AdminProxyPreflight {
  /**
   * True when the admin surface is serving live responses. `false` only
   * when `mode === "disabled"` (or hosted mode requested but env vars
   * missing, which is a misconfiguration and rare in practice).
   */
  configured: boolean;
  /**
   * Which backend is currently serving admin routes:
   *   - `hosted` — requests forwarded to agent.neotoma.io using the
   *     maintainer admin bearer on the Neotoma server.
   *   - `local`  — requests served from the local JSON feedback store.
   *     Status writes mutate the JSON record and mirror into the
   *     `neotoma_feedback` entity graph.
   *   - `disabled` — admin routes return 501 admin_proxy_unconfigured.
   * Older servers (pre-self-contained local pipeline) may omit this
   * field; callers should fall back to inferring hosted/disabled from
   * `configured` in that case.
   */
  mode?: AdminFeedbackMode;
  base_url_env: string;
  bearer_env: string;
  /**
   * Env var name that controls `mode` (defaults to
   * `NEOTOMA_FEEDBACK_ADMIN_MODE`). Present on self-contained-local
   * servers; may be omitted on older servers.
   */
  mode_env?: string;
  allowed_tiers: string[];
}

export function adminFeedbackPreflight() {
  return get<AdminProxyPreflight>("/admin/feedback/preflight");
}

export interface PendingFeedbackResponse {
  items: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export function listPendingFeedback(options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined) params.set("offset", String(options.offset));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return get<PendingFeedbackResponse>(`/admin/feedback/pending${suffix}`);
}

export function findFeedbackByCommit(sha: string) {
  return get<Record<string, unknown>>(
    `/admin/feedback/by_commit/${encodeURIComponent(sha)}`,
  );
}

export interface UpdateFeedbackStatusRequest {
  status?: string;
  classification?: string;
  triage_notes?: string;
  github_issue_urls?: string[];
  pull_request_urls?: string[];
  commit_shas?: string[];
  duplicate_of_feedback_id?: string;
  notes_markdown?: string;
  upgrade_guidance?: Record<string, unknown> | null;
  resolution_confidence?: string;
  regression_candidate?: boolean;
  regression_detected_at?: string | null;
  superseded_by_version?: string;
  next_check_suggested_at?: string | null;
  [key: string]: unknown;
}

export function updateFeedbackStatus(
  feedbackId: string,
  body: UpdateFeedbackStatusRequest,
) {
  return post<Record<string, unknown>>(
    `/admin/feedback/${encodeURIComponent(feedbackId)}/status`,
    body,
  );
}
