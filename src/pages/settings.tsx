import { useState } from "react";
import {
  getDefaultApiUrl,
  getInspectorEnvironment,
  getSavedApiUrl,
  isProxyDefaultEnabled,
  setApiUrl,
  clearApiUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "@/api/client";
import { useHealthCheck, useServerInfo, useMe, useHealthCheckSnapshots } from "@/hooks/use_infra";
import { PageShell } from "@/components/layout/page_shell";
import { InlineSkeleton } from "@/components/shared/query_status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "@/components/shared/json_viewer";
import { AttributionSummary } from "@/components/shared/attribution_summary";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInspectorUserId } from "@/lib/constants";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Circle, RefreshCw } from "lucide-react";

const LOCAL_PROXY_PLACEHOLDER = "/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const defaultApiUrl = getDefaultApiUrl();
  const inspectorEnvironment = getInspectorEnvironment();
  const proxyDefaultEnabled = isProxyDefaultEnabled();
  const savedApiUrl = getSavedApiUrl();
  const [apiUrl, setApiUrlLocal] = useState(savedApiUrl || "");
  const [token, setTokenLocal] = useState(getAuthToken() || "");

  const health = useHealthCheck();
  const serverInfo = useServerInfo();
  const me = useMe();
  const snapshotHealth = useHealthCheckSnapshots();

  function handleSaveConnection() {
    if (apiUrl.trim()) {
      setApiUrl(apiUrl);
    } else {
      clearApiUrl();
    }
    if (token) {
      setAuthToken(token);
    } else {
      clearAuthToken();
    }
    qc.invalidateQueries();
    toast.success(apiUrl.trim() ? "Connection override saved" : "Using default connection");
  }

  return (
    <PageShell title="Settings" description="Configure API connection and view server details">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Server Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {serverInfo.isLoading ? (
              <div className="space-y-2">
                <InlineSkeleton className="h-4 w-full max-w-xs" />
                <InlineSkeleton className="h-4 w-full max-w-sm" />
              </div>
            ) : serverInfo.data ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">HTTP Port</span><span>{serverInfo.data.httpPort}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">API Base</span><span className="font-mono text-xs">{serverInfo.data.apiBase || "—"}</span></div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">MCP URL</span>
                  <p className="font-mono text-xs break-all">{serverInfo.data.mcpUrl || "—"}</p>
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Unable to load server info.</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">API Connection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>API Base URL Override</Label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrlLocal(e.target.value)}
                placeholder={proxyDefaultEnabled ? LOCAL_PROXY_PLACEHOLDER : defaultApiUrl}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {proxyDefaultEnabled
                  ? `Local dev default for ${inspectorEnvironment}: /api -> ${defaultApiUrl}`
                  : `Default for the current Neotoma environment (${inspectorEnvironment}): ${defaultApiUrl}`}
              </p>
            </div>
            <div>
              <Label>Bearer Token</Label>
              <Input type="password" value={token} onChange={(e) => setTokenLocal(e.target.value)} placeholder="Optional auth token" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveConnection}>Save & Reconnect</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setApiUrlLocal("");
                  clearApiUrl();
                  qc.invalidateQueries();
                  toast.success("Reverted to default connection");
                }}
                disabled={!savedApiUrl && !apiUrl.trim()}
              >
                Use Default
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <Circle className={`h-2.5 w-2.5 fill-current ${health.data?.ok ? "text-green-500" : "text-red-500"}`} />
                {health.data?.ok ? "Connected" : "Disconnected"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Current User</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {me.isLoading ? (
              <div className="space-y-2">
                <InlineSkeleton className="h-4 w-full max-w-xs" />
                <InlineSkeleton className="h-4 w-full max-w-md" />
              </div>
            ) : me.data ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono text-xs cursor-default">
                        {formatInspectorUserId(me.data.user_id)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-sm">
                      <p className="text-xs text-muted-foreground">User ID</p>
                      <p className="font-mono text-xs break-all">{me.data.user_id}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {me.data.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{me.data.email}</span></div>}
                {me.data.storage && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Backend</span><Badge variant="secondary">{me.data.storage.storage_backend}</Badge></div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Data Dir</span>
                      <p className="font-mono text-xs break-all">{me.data.storage.data_dir}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">SQLite DB</span>
                      <p className="font-mono text-xs break-all">{me.data.storage.sqlite_db}</p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Not authenticated or unable to fetch user info.</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Snapshot Health
              <Button
                variant="outline"
                size="sm"
                onClick={() => snapshotHealth.mutate(false)}
                disabled={snapshotHealth.isPending}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${snapshotHealth.isPending ? "animate-spin" : ""}`} />
                Check
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshotHealth.data ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stale Snapshots</span>
                  <span className="font-medium">{snapshotHealth.data.stale_snapshots ?? 0}</span>
                </div>
                {snapshotHealth.data.stale_snapshots && snapshotHealth.data.stale_snapshots > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => snapshotHealth.mutate(true)}
                    disabled={snapshotHealth.isPending}
                  >
                    Auto-fix Stale Snapshots
                  </Button>
                )}
                {snapshotHealth.data.details && (
                  <JsonViewer data={snapshotHealth.data.details} />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click Check to run snapshot health analysis.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <div>
        <AttributionSummary />
      </div>
    </PageShell>
  );
}
