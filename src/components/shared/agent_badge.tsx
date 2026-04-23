/**
 * Compact rendering of the agent attribution stamped on a Neotoma record.
 *
 * Shows a coloured trust-tier pill plus the best available label
 * (client name → agent subject → thumbprint → "anonymous"). The full
 * provenance block is exposed via a tooltip so curious humans can inspect
 * the raw identity without cluttering table rows.
 *
 * Used by Observation / Relationship / Source / TimelineEvent / Interpretation
 * list views and the Agent filter introduced in Phase 1.11.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AgentAttribution,
  AgentAttributionTier,
} from "@/types/api";

/**
 * Extract an {@link AgentAttribution} from a row's `provenance` blob. Returns
 * `null` when the blob is missing or carries no attribution keys — callers
 * render "unattributed" for this case.
 */
export function extractAgentAttribution(
  provenance: Record<string, unknown> | undefined | null
): AgentAttribution | null {
  if (!provenance || typeof provenance !== "object") return null;
  const p = provenance as Record<string, unknown>;
  const any =
    p.agent_public_key ||
    p.agent_thumbprint ||
    p.agent_sub ||
    p.client_name ||
    p.attribution_tier ||
    p.connection_id;
  if (!any) return null;
  const tier =
    typeof p.attribution_tier === "string"
      ? (p.attribution_tier as AgentAttributionTier)
      : undefined;
  return {
    agent_public_key:
      typeof p.agent_public_key === "string" ? p.agent_public_key : undefined,
    agent_thumbprint:
      typeof p.agent_thumbprint === "string" ? p.agent_thumbprint : undefined,
    agent_algorithm:
      typeof p.agent_algorithm === "string" ? p.agent_algorithm : undefined,
    agent_sub: typeof p.agent_sub === "string" ? p.agent_sub : undefined,
    agent_iss: typeof p.agent_iss === "string" ? p.agent_iss : undefined,
    client_name:
      typeof p.client_name === "string" ? p.client_name : undefined,
    client_version:
      typeof p.client_version === "string" ? p.client_version : undefined,
    connection_id:
      typeof p.connection_id === "string" ? p.connection_id : undefined,
    attribution_tier: tier,
    attributed_at:
      typeof p.attributed_at === "string" ? p.attributed_at : undefined,
  };
}

/**
 * Human-readable label for an attribution record, used both inside the
 * badge and as the sort/filter key in tables.
 *
 * Priority: `client_name` (+ version) → `agent_sub` → shortened thumbprint
 * → "Anonymous".
 */
export function getAttributionLabel(
  attribution: AgentAttribution | null | undefined
): string {
  if (!attribution) return "Anonymous";
  if (attribution.client_name) {
    return attribution.client_version
      ? `${attribution.client_name} ${attribution.client_version}`
      : attribution.client_name;
  }
  if (attribution.agent_sub) return attribution.agent_sub;
  if (attribution.agent_thumbprint) {
    return `key:${attribution.agent_thumbprint.slice(0, 10)}`;
  }
  return "Anonymous";
}

/**
 * Canonical identifier for filter / group-by operations. Prefers the
 * thumbprint (stable across sessions when AAuth is in use), then the JWT
 * subject, then the client name. Returns `null` for anonymous rows so
 * callers can bucket them together.
 */
export function getAttributionKey(
  attribution: AgentAttribution | null | undefined
): string | null {
  if (!attribution) return null;
  if (attribution.agent_thumbprint) return `thumb:${attribution.agent_thumbprint}`;
  if (attribution.agent_sub) return `sub:${attribution.agent_sub}`;
  if (attribution.client_name) {
    return attribution.client_version
      ? `name:${attribution.client_name}@${attribution.client_version}`
      : `name:${attribution.client_name}`;
  }
  return null;
}

/**
 * Tier → colour + label mapping. Keep tier names short (single word) because
 * the badge sits inside dense tables; the long descriptions live in the
 * tooltip.
 */
const TIER_VISUAL: Record<
  AgentAttributionTier,
  { label: string; className: string; description: string }
> = {
  hardware: {
    label: "Hardware",
    className:
      "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700",
    description:
      "AAuth-verified with a hardware-backed key (Secure Enclave / YubiKey).",
  },
  software: {
    label: "Software",
    className:
      "bg-sky-100 text-sky-900 ring-1 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:ring-sky-700",
    description: "AAuth-verified with a software-only key.",
  },
  unverified_client: {
    label: "Self-reported",
    className:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700",
    description:
      "Client name and version from MCP `initialize.clientInfo`. Self-reported, not cryptographically verified.",
  },
  anonymous: {
    label: "Anonymous",
    className:
      "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    description:
      "No identifying information on this write (no AAuth, no meaningful clientInfo).",
  },
};

export interface AgentBadgeProps {
  /**
   * Either a raw provenance object (we will extract attribution) or an
   * already-extracted {@link AgentAttribution}. Passing the raw blob is
   * convenient inside table cells; passing the extracted value avoids
   * repeated parsing on detail pages.
   */
  provenance?: Record<string, unknown> | null;
  attribution?: AgentAttribution | null;
  /** When true, omit the label and show only the tier pill. */
  iconOnly?: boolean;
  className?: string;
}

export function AgentBadge({
  provenance,
  attribution: explicitAttribution,
  iconOnly = false,
  className,
}: AgentBadgeProps) {
  const attribution = React.useMemo(
    () => explicitAttribution ?? extractAgentAttribution(provenance),
    [explicitAttribution, provenance]
  );
  const tier: AgentAttributionTier =
    attribution?.attribution_tier ?? "anonymous";
  const visual = TIER_VISUAL[tier];
  const label = getAttributionLabel(attribution);

  const tooltipRows: Array<[string, string | undefined]> = [
    ["Tier", visual.label],
    ["Agent", label],
    ["Algorithm", attribution?.agent_algorithm],
    ["Thumbprint", attribution?.agent_thumbprint],
    ["Public key", attribution?.agent_public_key],
    ["Subject", attribution?.agent_sub],
    ["Issuer", attribution?.agent_iss],
    ["Client", attribution?.client_name],
    ["Version", attribution?.client_version],
    ["Connection", attribution?.connection_id],
    ["Stamped at", attribution?.attributed_at],
  ];

  const trigger = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        visual.className,
        className
      )}
    >
      <span aria-hidden="true">{tierIcon(tier)}</span>
      {!iconOnly && (
        <span className="max-w-[16ch] truncate" title={label}>
          {label}
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-1 text-xs">
            <p className="font-medium">{visual.label}</p>
            <p className="text-muted-foreground">{visual.description}</p>
            <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5">
              {tooltipRows
                .filter(([, value]) => !!value)
                .map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="break-all font-mono">{value}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Short, decorative glyph for the tier. Uses text characters rather than
 * icon fonts because the badge shows up in narrow table columns and we
 * want it zero-dependency.
 */
function tierIcon(tier: AgentAttributionTier): string {
  switch (tier) {
    case "hardware":
      return "◆";
    case "software":
      return "◇";
    case "unverified_client":
      return "●";
    case "anonymous":
    default:
      return "○";
  }
}
