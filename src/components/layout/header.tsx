import { useHealthCheck, useMe } from "@/hooks/use_infra";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInspectorUserBadge } from "@/lib/constants";
import { Circle, User } from "lucide-react";

export function Header() {
  const health = useHealthCheck();
  const me = useMe();

  const isHealthy = health.data?.ok === true;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">
        Neotoma
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Circle
            className={`h-2.5 w-2.5 fill-current ${isHealthy ? "text-green-500" : health.isLoading ? "text-yellow-500" : "text-red-500"}`}
          />
          <span className="text-muted-foreground">
            {isHealthy ? "Connected" : health.isLoading ? "Connecting…" : "Disconnected"}
          </span>
        </div>
        {me.data && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1.5 cursor-default">
                <User className="h-3 w-3" />
                {formatInspectorUserBadge(me.data.email, me.data.user_id)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="font-mono text-xs break-all">{me.data.user_id}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
