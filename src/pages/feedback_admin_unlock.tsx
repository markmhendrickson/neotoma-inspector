import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, XCircle } from "lucide-react";
import { isApiUrlConfigured, MISSING_API_URL_MESSAGE } from "@/api/client";
import { activateFeedbackAdminSession } from "@/api/endpoints/feedback_admin";
import { PageShell } from "@/components/layout/page_shell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Phase = "activating" | "success" | "error";

function initialUnlockState(challenge: string): { phase: Phase; message: string } {
  if (!challenge.trim()) {
    return {
      phase: "error",
      message:
        "Missing challenge query parameter. Run `neotoma inspector admin unlock` and open the printed URL.",
    };
  }
  if (!isApiUrlConfigured()) {
    return { phase: "error", message: MISSING_API_URL_MESSAGE };
  }
  return { phase: "activating", message: "" };
}

export default function FeedbackAdminUnlockPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const challenge = searchParams.get("challenge")?.trim() ?? "";
  const initial = initialUnlockState(challenge);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [message, setMessage] = useState<string>(initial.message);

  useEffect(() => {
    const boot = initialUnlockState(challenge);
    if (boot.phase === "error") {
      setPhase("error");
      setMessage(boot.message);
      return;
    }

    let cancelled = false;
    setPhase("activating");
    setMessage("");
    void (async () => {
      try {
        await activateFeedbackAdminSession(challenge);
        if (cancelled) return;
        await qc.invalidateQueries({ queryKey: ["admin-feedback-preflight"] });
        setPhase("success");
        setMessage("Admin session cookie is set for this browser. You can open Feedback to triage the pipeline.");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setMessage(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge, qc]);

  return (
    <PageShell
      title="Feedback admin unlock"
      titleIcon={<KeyRound className="h-5 w-5" aria-hidden />}
      description="Completes the CLI redeem step by activating the short-lived Inspector admin cookie for this API origin."
    >
      <div className="space-y-6 max-w-lg">
        {phase === "activating" ? (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <AlertTitle>Activating session</AlertTitle>
            <AlertDescription>Calling the Neotoma API with your challenge…</AlertDescription>
          </Alert>
        ) : null}

        {phase === "success" ? (
          <Alert className="border-emerald-500/40 bg-emerald-500/5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            <AlertTitle>Unlocked</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {phase === "error" ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>Could not activate</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/feedback">
              Open Feedback
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings">Settings</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Flow: run <code className="rounded bg-muted px-1">neotoma inspector admin unlock</code> (CLI signs{" "}
          <code className="rounded bg-muted px-1">/admin/feedback/auth/redeem</code> with your AAuth key), then open
          this page so the browser can pick up the httpOnly cookie. If this fails, confirm the API URL in Settings
          matches the server where you ran the CLI, and that the challenge has not expired.
        </p>
      </div>
    </PageShell>
  );
}
