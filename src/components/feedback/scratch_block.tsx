import { useEffect, useState } from "react";
import { NotebookPen, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useClearFeedbackScratch,
  useFeedbackScratch,
} from "@/hooks/use_feedback_scratch";
import {
  arrayOfStrings,
  scratchOf,
  snapshotOf,
} from "@/lib/feedback";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { shortId } from "@/lib/humanize";
import type { EntitySnapshot } from "@/types/api";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "triaged", label: "Triaged" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "duplicate", label: "Duplicate" },
  { value: "wait_for_next_release", label: "Awaiting release" },
  { value: "wontfix", label: "Won't fix" },
  { value: "removed", label: "Removed" },
];

export interface ScratchBlockProps {
  entity: EntitySnapshot;
  canPromote: boolean;
  onPromote?: (draft: {
    status?: string;
    triage_notes?: string;
    issue_urls?: string[];
    pr_urls?: string[];
    duplicate_of_feedback_id?: string;
  }) => void;
}

/**
 * Visually isolated block on the expanded feedback card for maintainer
 * scratch annotations. Writes live under `inspector_scratch.*` and never
 * auto-propagate to agent.neotoma.io. Phase 4 surfaces a "Promote to
 * pipeline" affordance that opens a review dialog and forwards the
 * scratch values through the admin proxy; nothing here fires that path
 * directly.
 */
export function ScratchBlock({ entity, canPromote, onPromote }: ScratchBlockProps) {
  const snapshot = snapshotOf(entity);
  const scratch = scratchOf(snapshot);
  const scratchMutation = useFeedbackScratch();
  const clearMutation = useClearFeedbackScratch();

  const [triageNotes, setTriageNotes] = useState<string>(scratch.triage_notes ?? "");
  const [duplicateOf, setDuplicateOf] = useState<string>(
    scratch.duplicate_of_feedback_id ?? "",
  );
  const [issueUrlInput, setIssueUrlInput] = useState("");
  const [prUrlInput, setPrUrlInput] = useState("");

  useEffect(() => {
    setTriageNotes(scratch.triage_notes ?? "");
    setDuplicateOf(scratch.duplicate_of_feedback_id ?? "");
  }, [scratch.triage_notes, scratch.duplicate_of_feedback_id]);

  const scratchStatus = typeof scratch.status === "string" ? scratch.status : "";
  const scratchIssueUrls = arrayOfStrings(scratch.issue_urls);
  const scratchPrUrls = arrayOfStrings(scratch.pr_urls);

  function handleError(err: unknown) {
    const message = err instanceof Error ? err.message : "Scratch update failed";
    toast.error(message);
  }

  function writePatch(patch: Record<string, unknown>, successMsg: string) {
    scratchMutation.mutate(
      { entity, patch },
      {
        onSuccess: () => toast.success(successMsg),
        onError: handleError,
      },
    );
  }

  function handleStatusChange(next: string) {
    writePatch(
      { status: next === "__clear__" ? null : next },
      next === "__clear__" ? "Cleared scratch status" : "Scratch status updated",
    );
  }

  function handleTriageNotesBlur() {
    const normalised = triageNotes.trim();
    if (normalised === (scratch.triage_notes ?? "")) return;
    writePatch(
      { triage_notes: normalised.length > 0 ? normalised : null },
      "Scratch notes saved",
    );
  }

  function handleDuplicateBlur() {
    const normalised = duplicateOf.trim();
    if (normalised === (scratch.duplicate_of_feedback_id ?? "")) return;
    writePatch(
      { duplicate_of_feedback_id: normalised.length > 0 ? normalised : null },
      "Hypothesized duplicate saved",
    );
  }

  function appendUrl(field: "issue_urls" | "pr_urls", rawInput: string) {
    const value = rawInput.trim();
    if (value.length === 0) return;
    const existing =
      field === "issue_urls" ? scratchIssueUrls : scratchPrUrls;
    if (existing.includes(value)) {
      toast.info("URL already present in scratch");
      return;
    }
    writePatch({ [field]: [...existing, value] }, "Scratch URL appended");
    if (field === "issue_urls") setIssueUrlInput("");
    else setPrUrlInput("");
  }

  function removeUrl(field: "issue_urls" | "pr_urls", url: string) {
    const existing =
      field === "issue_urls" ? scratchIssueUrls : scratchPrUrls;
    const next = existing.filter((u) => u !== url);
    writePatch(
      { [field]: next.length > 0 ? next : null },
      "Scratch URL removed",
    );
  }

  function handleClearAll() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Clear all scratch annotations for this feedback row?",
      );
      if (!confirmed) return;
    }
    clearMutation.mutate(entity, {
      onSuccess: () => toast.success("Scratch cleared"),
      onError: handleError,
    });
  }

  function handlePromote() {
    onPromote?.({
      status: scratchStatus || undefined,
      triage_notes: triageNotes.trim() || undefined,
      issue_urls: scratchIssueUrls.length > 0 ? scratchIssueUrls : undefined,
      pr_urls: scratchPrUrls.length > 0 ? scratchPrUrls : undefined,
      duplicate_of_feedback_id: duplicateOf.trim() || undefined,
    });
  }

  const busy = scratchMutation.isPending || clearMutation.isPending;
  const hasAnyScratch =
    !!scratchStatus ||
    scratchIssueUrls.length > 0 ||
    scratchPrUrls.length > 0 ||
    !!duplicateOf.trim() ||
    !!triageNotes.trim();

  return (
    <section className="rounded-md border-2 border-dashed border-amber-400/50 bg-amber-50/30 p-3 text-sm dark:border-amber-400/30 dark:bg-amber-950/20">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Scratch · Local to Inspector, never auto-synced
          </h3>
          {scratch.updated_at ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              saved <LiveRelativeTime iso={scratch.updated_at} title={false} />
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canPromote && hasAnyScratch ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handlePromote}
              disabled={busy}
            >
              <Send className="h-3 w-3" aria-hidden />
              Promote to pipeline
            </Button>
          ) : null}
          {hasAnyScratch ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
              disabled={busy}
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Clear scratch
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Scratch status</Label>
          <Select
            value={scratchStatus || "__clear__"}
            onValueChange={handleStatusChange}
            disabled={busy}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="— none —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">— none —</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`scratch-dup-${entity.entity_id ?? entity.id}`} className="text-xs text-muted-foreground">
            Hypothesized duplicate of
          </Label>
          <Input
            id={`scratch-dup-${entity.entity_id ?? entity.id}`}
            value={duplicateOf}
            onChange={(e) => setDuplicateOf(e.target.value)}
            onBlur={handleDuplicateBlur}
            placeholder="feedback_id"
            className="h-8 font-mono text-xs"
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Working issue URLs</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://github.com/…/issues/…"
            value={issueUrlInput}
            onChange={(e) => setIssueUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                appendUrl("issue_urls", issueUrlInput);
              }
            }}
            className="h-8 text-xs"
            disabled={busy}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => appendUrl("issue_urls", issueUrlInput)}
            disabled={busy || issueUrlInput.trim().length === 0}
          >
            Add
          </Button>
        </div>
        {scratchIssueUrls.length > 0 ? (
          <ul className="space-y-0.5 text-xs">
            {scratchIssueUrls.map((url) => (
              <li key={url} className="flex items-center gap-2">
                <Badge variant="secondary" className="max-w-full truncate font-mono text-[10px]">
                  {url}
                </Badge>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeUrl("issue_urls", url)}
                  disabled={busy}
                  aria-label={`Remove ${url}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Working PR URLs</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://github.com/…/pull/…"
            value={prUrlInput}
            onChange={(e) => setPrUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                appendUrl("pr_urls", prUrlInput);
              }
            }}
            className="h-8 text-xs"
            disabled={busy}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => appendUrl("pr_urls", prUrlInput)}
            disabled={busy || prUrlInput.trim().length === 0}
          >
            Add
          </Button>
        </div>
        {scratchPrUrls.length > 0 ? (
          <ul className="space-y-0.5 text-xs">
            {scratchPrUrls.map((url) => (
              <li key={url} className="flex items-center gap-2">
                <Badge variant="secondary" className="max-w-full truncate font-mono text-[10px]">
                  {url}
                </Badge>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeUrl("pr_urls", url)}
                  disabled={busy}
                  aria-label={`Remove ${url}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label htmlFor={`scratch-notes-${entity.entity_id ?? entity.id}`} className="text-xs text-muted-foreground">
          Scratch notes
        </Label>
        <Textarea
          id={`scratch-notes-${entity.entity_id ?? entity.id}`}
          placeholder="Triage hypotheses, follow-ups, questions for the reporter…"
          rows={3}
          value={triageNotes}
          onChange={(e) => setTriageNotes(e.target.value)}
          onBlur={handleTriageNotesBlur}
          disabled={busy}
          className="text-sm"
        />
      </div>

      {scratchStatus ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Scratch status <Badge variant="outline" className="ml-1 font-normal">{scratchStatus}</Badge>{" "}
          renders alongside the authoritative status but never replaces it.
          {scratch.duplicate_of_feedback_id ? (
            <span className="ml-1">
              Duplicate hypothesis: <code>{shortId(scratch.duplicate_of_feedback_id, 12)}</code>
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
