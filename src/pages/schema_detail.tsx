import { useParams } from "react-router-dom";
import { useState } from "react";
import { useSchemaByType, useSchemaRecommendations, useSchemaCandidates } from "@/hooks/use_schemas";
import { useUpdateSchema } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TypeBadge } from "@/components/shared/type_badge";
import { JsonViewer } from "@/components/shared/json_viewer";
import { toast } from "sonner";
import { Plus, BarChart3, Lightbulb } from "lucide-react";

export default function SchemaDetailPage() {
  const { entityType } = useParams<{ entityType: string }>();
  const schema = useSchemaByType(entityType);
  const recommendations = useSchemaRecommendations(entityType);
  const candidates = useSchemaCandidates(entityType);
  const updateMut = useUpdateSchema();

  const [addFieldName, setAddFieldName] = useState("");
  const [addFieldType, setAddFieldType] = useState("string");
  const [addFieldRequired, setAddFieldRequired] = useState(false);

  const s = schema.data;

  if (schema.isLoading) return <PageShell title="Loading…"><div className="text-muted-foreground">Loading…</div></PageShell>;
  if (!s) return <PageShell title="Not Found"><div className="text-muted-foreground">Schema not found.</div></PageShell>;

  const fields = s.schema_definition?.fields ?? s.field_summary ?? {};

  return (
    <PageShell
      title={s.entity_type}
      description={`Schema v${s.schema_version || "?"}`}
      actions={
        <Dialog>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add Field</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Field to Schema</DialogTitle><DialogDescription>Incrementally add a field and bump the schema version.</DialogDescription></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Field Name</Label><Input value={addFieldName} onChange={(e) => setAddFieldName(e.target.value)} /></div>
              <div>
                <Label>Field Type</Label>
                <Select value={addFieldType} onValueChange={setAddFieldType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["string", "number", "date", "boolean", "array", "object"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                if (!addFieldName || !entityType) return;
                updateMut.mutate(
                  { entity_type: entityType, fields_to_add: [{ field_name: addFieldName, field_type: addFieldType, required: addFieldRequired }] },
                  { onSuccess: () => { toast.success("Field added"); setAddFieldName(""); } }
                );
              }}>Add Field</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        <TypeBadge type={s.entity_type} />
        <span className="text-sm text-muted-foreground">v{s.schema_version}</span>
        {s.active !== false && <span className="text-xs text-green-600 font-medium">Active</span>}
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields ({Object.keys(fields).length})</TabsTrigger>
          <TabsTrigger value="reducer">Reducer Config</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="fields">
          <Card>
            <CardContent className="pt-6">
              {Object.keys(fields).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(fields).map(([name, def]) => (
                    <div key={name} className="flex items-start gap-4 py-2 border-b last:border-0">
                      <span className="font-mono text-sm text-purple-600 min-w-[160px]">{name}</span>
                      <div className="flex-1"><JsonViewer data={def} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No field definitions.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reducer">
          <Card>
            <CardContent className="pt-6">
              <JsonViewer data={s.reducer_config} defaultExpanded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata">
          <Card>
            <CardContent className="pt-6">
              <JsonViewer data={s.metadata} defaultExpanded />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Schema Candidates</CardTitle>
              <Button variant="outline" size="sm" onClick={() => candidates.refetch()}>Analyze</Button>
            </CardHeader>
            <CardContent>
              {candidates.isFetching ? (
                <span className="text-muted-foreground text-sm">Analyzing…</span>
              ) : candidates.data ? (
                <JsonViewer data={candidates.data} defaultExpanded />
              ) : (
                <p className="text-sm text-muted-foreground">Click Analyze to discover candidate fields from raw fragments.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.isLoading ? (
                <span className="text-muted-foreground text-sm">Loading…</span>
              ) : recommendations.data ? (
                <JsonViewer data={recommendations.data} defaultExpanded />
              ) : (
                <p className="text-sm text-muted-foreground">No recommendations available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
