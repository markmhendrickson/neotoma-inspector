import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useAdminFeedbackPreflight,
  useUpdateFeedbackStatus,
} from "@/hooks/use_feedback_admin";
import { useClearFeedbackScratch } from "@/hooks/use_feedback_scratch";
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

export interface PublishDraft {
  status?: string;
  triage_notes?: string;
  issue_urls?: string[];
  pr_urls?: string[];
  duplicate_of_feedback_id?: string;
}

export interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  entity: EntitySnapshot;
  feedbackId: string;
  initialDraft: PublishDraft;
  /**
   * When true, the dialog will clear the scratch namespace after a
   * successful publish so the maintainer does not have to do it
   * manually. Matches the Phase 3/4 plan handoff.
   */
  clearScratchOnPublish?: boolean;
}

/**
 * Review dialog that runs between a Phase 3 scratch write-up and a Phase
 * 4 authoritative pipeline write. Submits through the local
 * `/admin/feedback/:id/status` proxy. Routes to agent.neotoma.io with
 * the shared admin bearer when the server is in hosted mode, or to the
 * local JSON feedback store (which mirrors into the neotoma_feedback
 * entity graph) when the server is in self-contained local mode.
 */
export function PublishDialog({
  open,
  onClose,
  entity,
  feedbackId,
  initialDraft,
  clearScratchOnPublish = true,
}: PublishDialogProps) {
  const [status, setStatus] = useState<string>(initialDraft.status ?? "");
  const [notes, setNotes] = useState<string>(initialDraft.triage_notes ?? "");
  const [issueUrls, setIssueUrls] = useState<string>(
    (initialDraft.issue_urls ?? []).join("\n"),
  );
  const [prUrls, setPrUrls] = useState<string>(
    (initialDraft.pr_urls ?? []).join("\n"),
  );
  const [duplicate, setDuplicate] = useState<string>(
    initialDraft.duplicate_of_feedback_id ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setStatus(initialDraft.status ?? "");
    setNotes(initialDraft.triage_notes ?? "");
    setIssueUrls((initialDraft.issue_urls ?? []).join("\n"));
    setPrUrls((initialDraft.pr_urls ?? []).join("\n"));
    setDuplicate(initialDraft.duplicate_of_feedback_id ?? "");
  }, [open, initialDraft]);

  const updateMutation = useUpdateFeedbackStatus();
  const clearScratch = useClearFeedbackScratch();
  const preflight = useAdminFeedbackPreflight();
  const adminMode: "hosted" | "local" | "disabled" =
    preflight.data?.mode ??
    (preflight.data?.configured === true ? "hosted" : "disabled");

  function splitLines(raw: string): string[] {
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function buildBody() {
    const body: Record<string, unknown> = {};
    if (status) body.status = status;
    if (notes.trim().length > 0) body.triage_notes = notes.trim();
    const parsedIssueUrls = splitLines(issueUrls);
    if (parsedIssueUrls.length > 0) body.github_issue_urls = parsedIssueUrls;
    const parsedPrUrls = splitLines(prUrls);
    if (parsedPrUrls.length > 0) body.pull_request_urls = parsedPrUrls;
    if (duplicate.trim().length > 0) {
      body.duplicate_of_feedback_id = duplicate.trim();
    }
    return body;
  }

  function handlePublish() {
    const body = buildBody();
    if (Object.keys(body).length === 0) {
      toast.error("Nothing to publish — fill in at least one field.");
      return;
    }
    updateMutation.mutate(
      { feedbackId, body },
      {
        onSuccess: () => {
          toast.success(
            adminMode === "local"
              ? "Published to local feedback store"
              : "Published to pipeline",
          );
          if (clearScratchOnPublish) {
            clearScratch.mutate(entity, {
              onError: () =>
                toast.warning("Published, but could not clear local scratch."),
            });
          }
          onClose();
        },
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : "Publish failed";
          toast.error(message);
        },
      },
    );
  }

  const busy = updateMutation.isPending || clearScratch.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {adminMode === "local" ? "Publish to local store" : "Publish to pipeline"}
          </DialogTitle>
          <DialogDescription>
            Write the fields below to <Badge variant="outline">{feedbackId}</Badge>{" "}
            via <code>POST /admin/feedback/:id/status</code>.{" "}
            {adminMode === "local" ? (
              <>
                This server is in self-contained local mode — the write updates
                the local JSON store and mirrors into the{" "}
                <code>neotoma_feedback</code> entity graph. It becomes visible
                to the reporting agent on the next{" "}
                <code>get_feedback_status</code> poll.
              </>
            ) : (
              <>
                This proxies through the local Neotoma server to{" "}
                <code>agent.neotoma.io</code> and becomes visible to the
                reporting agent on the next{" "}
                <code>get_feedback_status</code> poll.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="publish-status">Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={busy}>
              <SelectTrigger id="publish-status" className="h-9">
                <SelectValue placeholder="— no change —" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="publish-duplicate">Duplicate of feedback_id</Label>
            <Input
              id="publish-duplicate"
              value={duplicate}
              onChange={(e) => setDuplicate(e.target.value)}
              placeholder="Leave empty to not set"
              className="h-9 font-mono text-xs"
              disabled={busy}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="publish-issues">Issue URLs (one per line)</Label>
            <Textarea
              id="publish-issues"
              rows={2}
              value={issueUrls}
              onChange={(e) => setIssueUrls(e.target.value)}
              className="font-mono text-xs"
              disabled={busy}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="publish-prs">PR URLs (one per line)</Label>
            <Textarea
              id="publish-prs"
              rows={2}
              value={prUrls}
              onChange={(e) => setPrUrls(e.target.value)}
              className="font-mono text-xs"
              disabled={busy}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="publish-notes">Triage notes</Label>
            <Textarea
              id="publish-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={busy}>
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
