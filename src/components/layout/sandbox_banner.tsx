import { Link } from "react-router-dom";
import {
  isSandboxUiEnabled,
  SANDBOX_HOST_LABEL,
  SANDBOX_WEEKLY_RESET_LABEL,
} from "@/lib/sandbox";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use_infra";
import { AlertTriangle, Flag } from "lucide-react";

function tierLabel(tier?: string): { label: string; className: string } {
  switch (tier) {
    case "hardware":
      return { label: "Hardware-verified", className: "border-green-600 text-green-700" };
    case "software":
      return { label: "Software-verified", className: "border-emerald-600 text-emerald-700" };
    case "unverified_client":
      return { label: "Unverified client", className: "border-amber-600 text-amber-700" };
    case "anonymous":
      return { label: "Anonymous", className: "border-muted-foreground text-muted-foreground" };
    default:
      return { label: tier || "Unknown", className: "border-muted-foreground text-muted-foreground" };
  }
}

export function SandboxBanner() {
  const session = useSession();
  if (!isSandboxUiEnabled()) return null;

  const tier = session.data?.attribution?.tier;
  const chip = tierLabel(tier);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        <span>Public sandbox</span>
      </div>
      <span className="text-amber-800/90 dark:text-amber-200/90">
        Running on <span className="font-mono">{SANDBOX_HOST_LABEL}</span>. All data is public,
        rate-limited, and wiped weekly ({SANDBOX_WEEKLY_RESET_LABEL}). Do not submit real personal
        information.
      </span>
      {tier ? (
        <Badge variant="outline" className={`font-normal ${chip.className}`}>
          AAuth: {chip.label}
        </Badge>
      ) : null}
      <div className="ml-auto flex items-center gap-3">
        <Link
          to="/sandbox#terms"
          className="underline-offset-2 hover:underline focus:outline-none focus:underline"
        >
          Terms
        </Link>
        <Link
          to="/sandbox#report"
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline focus:outline-none focus:underline"
        >
          <Flag className="h-3 w-3" aria-hidden />
          Report abuse
        </Link>
      </div>
    </div>
  );
}
