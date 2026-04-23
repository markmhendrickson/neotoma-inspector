import { Link } from "react-router-dom";
import { useSchemas } from "@/hooks/use_schemas";
import { useRegisterSchema } from "@/hooks/use_mutations";
import { PageShell } from "@/components/layout/page_shell";
import { DataTableSkeleton, QueryErrorAlert } from "@/components/shared/query_status";
import { DataTable } from "@/components/shared/data_table";
import { TypeBadge } from "@/components/shared/type_badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { EntitySchema } from "@/types/api";

export default function SchemasPage() {
  const schemas = useSchemas();
  const registerMut = useRegisterSchema();

  const [regType, setRegType] = useState("");
  const [regDef, setRegDef] = useState('{\n  "fields": {}\n}');
  const [regReducer, setRegReducer] = useState('{\n  "merge_policies": {}\n}');

  const columns: ColumnDef<EntitySchema, unknown>[] = [
    {
      header: "Entity Type",
      accessorKey: "entity_type",
      cell: ({ row }) => (
        <Link to={`/schemas/${encodeURIComponent(row.original.entity_type)}`} className="font-medium text-primary hover:underline">
          <TypeBadge type={row.original.entity_type} />
        </Link>
      ),
    },
    { header: "Version", accessorKey: "schema_version" },
    {
      header: "Fields",
      accessorKey: "field_names",
      cell: ({ getValue }) => {
        const names = getValue() as string[] | undefined;
        return names ? names.length : "—";
      },
    },
    {
      header: "Active",
      accessorKey: "active",
      cell: ({ getValue }) => (getValue() !== false ? "Yes" : "No"),
    },
  ];

  return (
    <PageShell
      title="Schemas"
      description={schemas.data ? `${schemas.data.schemas.length} registered` : undefined}
      actions={
        <Dialog>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Register</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Register Schema</DialogTitle><DialogDescription>Register a new entity type schema.</DialogDescription></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Entity Type</Label><Input value={regType} onChange={(e) => setRegType(e.target.value)} placeholder="my_entity_type" /></div>
              <div><Label>Schema Definition (JSON)</Label><Textarea value={regDef} onChange={(e) => setRegDef(e.target.value)} rows={6} className="font-mono text-xs" /></div>
              <div><Label>Reducer Config (JSON)</Label><Textarea value={regReducer} onChange={(e) => setRegReducer(e.target.value)} rows={4} className="font-mono text-xs" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                try {
                  registerMut.mutate(
                    { entity_type: regType, schema_definition: JSON.parse(regDef), reducer_config: JSON.parse(regReducer), activate: true },
                    { onSuccess: () => { toast.success("Schema registered"); setRegType(""); } }
                  );
                } catch { toast.error("Invalid JSON"); }
              }}>Register</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {schemas.isLoading ? (
        <DataTableSkeleton rows={8} cols={4} />
      ) : schemas.error ? (
        <QueryErrorAlert title="Could not load schemas">{schemas.error.message}</QueryErrorAlert>
      ) : (
        <DataTable columns={columns} data={schemas.data?.schemas ?? []} />
      )}
    </PageShell>
  );
}
