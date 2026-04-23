import { get } from "../client";

/**
 * Diagnostic block returned by `GET /session`. Mirrors the server-side
 * `AttributionDecisionDiagnostics` shape but with only the fields the
 * Inspector actually renders. Keep this aligned with
 * `src/services/session_attribution.ts`.
 */
export interface SessionAttribution {
  tier?: "hardware" | "software" | "unverified_client" | "anonymous" | string;
  eligible_for_trusted_writes?: boolean;
  decision?: {
    reason?: string;
    client_name?: string;
    client_version?: string;
    agent_sub?: string;
  } | null;
}

export interface SessionResponse {
  attribution?: SessionAttribution;
  user_id?: string;
  authority?: string;
}

export function getSession() {
  return get<SessionResponse>("/session");
}
