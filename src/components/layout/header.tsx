import { useHealthCheck, useMe, useServerInfo } from "@/hooks/use_infra";
import {
  getDefaultApiUrl,
  getInspectorEnvironment,
  getApiUrl,
  isProxyDefaultEnabled,
  resolveInspectorBadgeEnvironment,
} from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { InlineSkeleton } from "@/components/shared/query_status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInspectorUserBadge } from "@/lib/constants";
import { Circle, User } from "lucide-react";

function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i >= 0 ? normalized.slice(i + 1) : normalized;
}

export function Header() {
  const health = useHealthCheck();
  const me = useMe();
  const serverInfo = useServerInfo();

  const isHealthy = health.data?.ok === true;
  const viteInspectorEnv = getInspectorEnvironment();
  const inspectorEnv = resolveInspectorBadgeEnvironment(serverInfo.data?.neotoma_env, viteInspectorEnv);
  const sqlitePath = me.data?.storage?.sqlite_db;
  const dataDir = me.data?.storage?.data_dir;
  const apiTargetRaw = isProxyDefaultEnabled() ? `proxy /api → ${getDefaultApiUrl()}` : getApiUrl();
  const apiTarget = apiTargetRaw.trim() ? apiTargetRaw : "Not configured (set in Settings)";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">
        Neotoma
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="min-w-0 max-w-full shrink cursor-default font-normal sm:max-w-[min(100%,28rem)]"
              >
                <span className="flex min-w-0 max-w-full items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <Circle
                      className={`h-2.5 w-2.5 shrink-0 fill-current ${
                        isHealthy ? "text-green-500" : health.isLoading ? "text-yellow-500" : "text-red-500"
                      }`}
                    />
                    <span>
                      {isHealthy ? "Connected" : health.isLoading ? "Connecting…" : "Disconnected"}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <span className="shrink-0 capitalize text-foreground">{inspectorEnv}</span>
                  {sqlitePath ? (
                    <>
                      <span className="shrink-0 text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <span
                        className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground sm:inline"
                        title={sqlitePath}
                      >
                        {fileBasename(sqlitePath)}
                      </span>
                    </>
                  ) : null}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-lg">
              {sqlitePath ? (
                <>
                  <p className="text-xs text-muted-foreground">SQLite database (full path)</p>
                  <p className="mt-1 font-mono text-xs break-all">{sqlitePath}</p>
                  {dataDir ? (
                    <p className="mt-2 font-mono text-xs break-all">
                      <span className="text-muted-foreground">Data dir: </span>
                      {dataDir}
                    </p>
                  ) : null}
                </>
              ) : null}
              <p className={`text-xs text-muted-foreground ${sqlitePath ? "mt-2" : ""}`}>Inspector build</p>
              <p className="text-xs">
                Badge: API <span className="font-mono">neotoma_env</span>={" "}
                {serverInfo.data?.neotoma_env ?? "…"}
              </p>
              <p className="text-xs">
                Vite <span className="font-mono">VITE_NEOTOMA_ENV</span>={" "}
                {String(import.meta.env.VITE_NEOTOMA_ENV ?? "(unset)")} → fallback badge{" "}
                <span className="font-mono">{viteInspectorEnv}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">API target</p>
              <p className="font-mono text-xs break-all">{apiTarget}</p>
              <p className="mt-2 text-xs text-muted-foreground">API health</p>
              <p className="text-xs">
                {isHealthy ? "Connected" : health.isLoading ? "Checking…" : "Unreachable or error"}
              </p>
            </TooltipContent>
          </Tooltip>

          {!sqlitePath &&
            (me.isLoading ? (
              <InlineSkeleton className="hidden h-3 w-20 sm:inline-block" />
            ) : me.data?.storage?.storage_backend ? (
              <span className="hidden truncate text-xs text-muted-foreground capitalize sm:inline max-w-[12rem]">
                {me.data.storage.storage_backend}
              </span>
            ) : me.data ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden cursor-default text-xs text-muted-foreground sm:inline">Remote</span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">No local SQLite path on this session (hosted / remote storage).</p>
                </TooltipContent>
              </Tooltip>
            ) : me.isError ? (
              <span className="hidden text-xs text-muted-foreground sm:inline" title={apiTarget}>
                API only
              </span>
            ) : null)}
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
