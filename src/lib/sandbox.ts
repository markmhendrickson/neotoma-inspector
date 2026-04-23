/**
 * Helpers for detecting and operating in Inspector's sandbox UI mode.
 *
 * The Inspector is built once and deployed to `sandbox.neotoma.io/app` with
 * `VITE_NEOTOMA_SANDBOX_UI=1`. That flag:
 *   - locks the API URL to the build-time VITE_NEOTOMA_API_URL (no Settings override)
 *   - hides destructive actions (merge/split/delete)
 *   - shows a persistent SandboxBanner with weekly-reset + abuse-report links
 *
 * This module centralises the feature-flag read + banner-state computation
 * so individual components don't scatter `import.meta.env` probes.
 */

export function isSandboxUiEnabled(): boolean {
  const raw = import.meta.env.VITE_NEOTOMA_SANDBOX_UI as string | undefined;
  if (!raw) return false;
  const normalized = raw.toString().trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * When the sandbox UI is on, the API URL is locked to the build-time
 * VITE_NEOTOMA_API_URL value. The Settings page should render the override
 * field as disabled with an explanatory tooltip.
 */
export function isApiUrlOverrideDisabled(): boolean {
  return isSandboxUiEnabled();
}

/**
 * Destructive admin actions (entity merge/split, schema removal, permanent
 * deletion) are hidden on the public sandbox — they would be blocked by the
 * server anyway via `sandboxDestructiveGuard`, but silencing the buttons
 * keeps the demo UX clean.
 */
export function areDestructiveActionsHidden(): boolean {
  return isSandboxUiEnabled();
}

export const SANDBOX_WEEKLY_RESET_LABEL = "Sunday 00:00 UTC";
export const SANDBOX_HOST_LABEL = "sandbox.neotoma.io";
