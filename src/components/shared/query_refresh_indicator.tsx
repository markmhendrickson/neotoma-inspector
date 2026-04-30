import { Loader2 } from "lucide-react";

export function QueryRefreshIndicator({
  label = "Updating",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      {label}
    </span>
  );
}
