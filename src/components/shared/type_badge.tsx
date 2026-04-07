import { cn } from "@/lib/utils";
import { getEntityTypeColor } from "@/lib/constants";

interface TypeBadgeProps {
  type: string;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", getEntityTypeColor(type), className)}>
      {type}
    </span>
  );
}
