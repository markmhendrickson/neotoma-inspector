import { ArrowLeftRight, BookOpen, Terminal } from "lucide-react";
import type { AdminFeedbackMode } from "@/api/endpoints/feedback_admin";

export interface FeedbackStoreSyncPanelProps {
  adminProxyConfigured: boolean;
  adminMode: AdminFeedbackMode;
  baseUrlEnv: string;
  bearerEnv: string;
  modeEnv?: string;
}

/**
 * Explains how pipeline feedback storage relates to `neotoma_feedback` entities
 * and surfaces maintainer commands to resync when transports diverge.
 */
export function FeedbackStoreSyncPanel(props: FeedbackStoreSyncPanelProps) {
  const { adminProxyConfigured, adminMode, baseUrlEnv, bearerEnv, modeEnv } = props;
  const modeLabel = modeEnv ?? "NEOTOMA_FEEDBACK_ADMIN_MODE";

  return (
    <details className="group rounded-lg border bg-card/50 text-sm shadow-sm open:bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>Store sync &amp; repair options</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
          Show
        </span>
      </summary>

      <div className="space-y-4 border-t px-3 py-3 text-muted-foreground">
        <section className="space-y-2">
          <p className="font-medium text-foreground">Two surfaces</p>
          <ul className="list-inside list-disc space-y-1 pl-0.5">
            <li>
              <strong className="font-medium text-foreground">Mirrored records</strong> —{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">neotoma_feedback</code>{" "}
              rows in this Neotoma database (what agents query via MCP).
            </li>
            <li>
              <strong className="font-medium text-foreground">All</strong> (when admin is on) — the
              pipeline source: local JSON (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">NEOTOMA_FEEDBACK_STORE_PATH</code>
              ) or forwarded <code className="rounded bg-muted px-1 py-0.5 text-xs">agent.neotoma.io</code>{" "}
              admin API, depending on server mode.
            </li>
          </ul>
          <p>
            New submissions and maintainer status writes are designed to update both: the pipeline
            record and a mirrored entity observation.
          </p>
        </section>

        {!adminProxyConfigured ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-2 py-1.5 text-xs">
            Admin proxy is off ({modeLabel}
            =disabled or missing env). You only see the entity-backed list until{" "}
            <code className="rounded bg-muted px-1 py-0.5">{baseUrlEnv}</code> +{" "}
            <code className="rounded bg-muted px-1 py-0.5">{bearerEnv}</code> are set for hosted
            forwarding, or <code className="rounded bg-muted px-1 py-0.5">{modeLabel}</code> is{" "}
            <code className="rounded bg-muted px-1 py-0.5">local</code>.
          </p>
        ) : adminMode === "local" ? (
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              Local pipeline → entities
            </p>
            <p>
              Writes through this Inspector (or the CLI) update the JSON store and call the mirror
              helper on the server. If a row and its entity ever drift, trigger a fresh mirror by
              changing status or notes for that id (Inspector publish / triage), or run an ingest pass
              so pending items are re-upserted and mirrored:
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
              neotoma triage
            </pre>
            <p className="text-xs">
              From the repo root; runs{" "}
              <code className="rounded bg-muted px-1 py-0.5">scripts/cron/ingest_agent_incidents.ts</code> once.
              That pass touches only <span className="font-medium text-foreground">pending</span> pipeline
              feedback (up to 100), not every JSON row and not “all of Neotoma.” Each item it updates is
              mirrored to <code className="rounded bg-muted px-1 py-0.5">neotoma_feedback</code> as part of
              that ingest.
            </p>
          </section>
        ) : (
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              Hosted pipeline → Neotoma mirror
            </p>
            <p>
              Stuck forwarder rows on <code className="rounded bg-muted px-1 py-0.5">agent.neotoma.io</code>{" "}
              can be replayed per id (requires{" "}
              <code className="rounded bg-muted px-1 py-0.5">{baseUrlEnv}</code> +{" "}
              <code className="rounded bg-muted px-1 py-0.5">{bearerEnv}</code> in the environment):
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
              neotoma triage --mirror-replay &lt;feedback_id&gt;
            </pre>
            <p>Bulk historical replay from the agent site:</p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
              npm run feedback:mirror-backfill
            </pre>
          </section>
        )}

        <section className="flex items-start gap-2 rounded-md border border-dashed bg-muted/20 px-2 py-1.5 text-xs">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Canonical architecture:{" "}
            <code className="rounded bg-muted px-1 py-0.5">docs/subsystems/feedback_system_architecture.md</code>{" "}
            and <code className="rounded bg-muted px-1 py-0.5">docs/subsystems/agent_feedback_pipeline.md</code>.
          </span>
        </section>
      </div>
    </details>
  );
}
