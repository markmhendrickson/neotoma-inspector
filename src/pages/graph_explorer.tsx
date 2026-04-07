import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraphNeighborhood } from "@/hooks/use_graph";
import { PageShell } from "@/components/layout/page_shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { JsonViewer } from "@/components/shared/json_viewer";
import { getEntityTypeColor } from "@/lib/constants";
import { Search } from "lucide-react";

export default function GraphExplorerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nodeId, setNodeId] = useState(searchParams.get("node") || "");
  const [activeNodeId, setActiveNodeId] = useState(searchParams.get("node") || "");
  const [includeRelationships, setIncludeRelationships] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);

  const graph = useGraphNeighborhood(
    activeNodeId ? { node_id: activeNodeId, include_relationships: includeRelationships, include_sources: includeSources, include_events: includeEvents } : null
  );

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!graph.data) return { flowNodes: [], flowEdges: [] };
    const data = graph.data as Record<string, unknown>;

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const seen = new Set<string>();

    const centerEntity = data.entity as Record<string, unknown> | undefined;
    if (centerEntity) {
      const eid = String(centerEntity.entity_id || centerEntity.id || activeNodeId);
      nodes.push({
        id: eid,
        position: { x: 300, y: 300 },
        data: { label: String(centerEntity.canonical_name || centerEntity.entity_type || eid), raw: centerEntity },
        style: { background: "#e0e7ff", border: "2px solid #6366f1", borderRadius: 8, padding: 8, fontSize: 12 },
      });
      seen.add(eid);
    }

    const relEntities = (data.related_entities || data.entities || []) as Record<string, unknown>[];
    relEntities.forEach((ent, i) => {
      const eid = String(ent.entity_id || ent.id || `ent-${i}`);
      if (seen.has(eid)) return;
      seen.add(eid);
      const angle = (2 * Math.PI * i) / Math.max(relEntities.length, 1);
      nodes.push({
        id: eid,
        position: { x: 300 + Math.cos(angle) * 200, y: 300 + Math.sin(angle) * 200 },
        data: { label: String(ent.canonical_name || ent.entity_type || eid), raw: ent },
        style: { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 8, fontSize: 11 },
      });
    });

    const rels = (data.relationships || []) as Record<string, unknown>[];
    rels.forEach((rel, i) => {
      const src = String(rel.source_entity_id || "");
      const tgt = String(rel.target_entity_id || "");
      if (src && tgt) {
        edges.push({
          id: `edge-${i}`,
          source: src,
          target: tgt,
          label: String(rel.relationship_type || ""),
          type: "default",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1.5 },
          labelStyle: { fontSize: 10 },
        });
      }
    });

    const sources = (data.sources || []) as Record<string, unknown>[];
    sources.forEach((src, i) => {
      const sid = String(src.id || `src-${i}`);
      if (seen.has(sid)) return;
      seen.add(sid);
      nodes.push({
        id: sid,
        position: { x: 300 + Math.cos((2 * Math.PI * (i + relEntities.length)) / Math.max(sources.length + relEntities.length, 1)) * 280, y: 300 + Math.sin((2 * Math.PI * (i + relEntities.length)) / Math.max(sources.length + relEntities.length, 1)) * 280 },
        data: { label: String(src.original_filename || sid), raw: src },
        style: { background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: 8, fontSize: 11 },
      });
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [graph.data, activeNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data?.raw as Record<string, unknown> ?? null);
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const raw = node.data?.raw as Record<string, unknown> | undefined;
    if (raw?.entity_id) {
      navigate(`/entities/${encodeURIComponent(String(raw.entity_id))}`);
    } else if (raw?.id) {
      navigate(`/sources/${encodeURIComponent(String(raw.id))}`);
    }
  }, [navigate]);

  return (
    <PageShell title="Graph Explorer" description="Interactive neighborhood visualization">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Entity or Source ID…"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="pl-9"
            onKeyDown={(e) => { if (e.key === "Enter") setActiveNodeId(nodeId); }}
          />
        </div>
        <Button onClick={() => setActiveNodeId(nodeId)} disabled={!nodeId}>Explore</Button>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><Switch checked={includeRelationships} onCheckedChange={setIncludeRelationships} /> Relationships</label>
          <label className="flex items-center gap-2"><Switch checked={includeSources} onCheckedChange={setIncludeSources} /> Sources</label>
          <label className="flex items-center gap-2"><Switch checked={includeEvents} onCheckedChange={setIncludeEvents} /> Events</label>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 h-[600px] rounded-lg border bg-background">
          {graph.isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading graph…</div>
          ) : !activeNodeId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Enter an entity or source ID to explore its neighborhood.</div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">No graph data found.</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edgesState}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          )}
        </div>

        {selectedNode && (
          <Card className="w-80 shrink-0 max-h-[600px] overflow-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Node Detail</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonViewer data={selectedNode} defaultExpanded />
              <div className="mt-3 flex gap-2">
                {selectedNode["entity_id"] != null && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/entities/${encodeURIComponent(String(selectedNode["entity_id"]))}`)}>
                    View Entity
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
