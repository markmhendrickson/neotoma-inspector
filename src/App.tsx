import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app_layout";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const EntitiesPage = lazy(() => import("@/pages/entities"));
const EntityDetailPage = lazy(() => import("@/pages/entity_detail"));
const ObservationsPage = lazy(() => import("@/pages/observations"));
const SourcesPage = lazy(() => import("@/pages/sources"));
const SourceDetailPage = lazy(() => import("@/pages/source_detail"));
const RelationshipsPage = lazy(() => import("@/pages/relationships"));
const RelationshipDetailPage = lazy(() => import("@/pages/relationship_detail"));
const GraphExplorerPage = lazy(() => import("@/pages/graph_explorer"));
const SchemasPage = lazy(() => import("@/pages/schemas"));
const SchemaDetailPage = lazy(() => import("@/pages/schema_detail"));
const TimelinePage = lazy(() => import("@/pages/timeline"));
const TimelineEventDetailPage = lazy(() => import("@/pages/timeline_event_detail"));
const InterpretationsPage = lazy(() => import("@/pages/interpretations"));
const SettingsPage = lazy(() => import("@/pages/settings"));

function PageLoader() {
  return <div className="flex items-center justify-center p-12 text-muted-foreground">Loading…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/entities/:id" element={<EntityDetailPage />} />
          <Route path="/observations" element={<ObservationsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/sources/:id" element={<SourceDetailPage />} />
          <Route path="/relationships" element={<RelationshipsPage />} />
          <Route path="/relationships/:key" element={<RelationshipDetailPage />} />
          <Route path="/graph" element={<GraphExplorerPage />} />
          <Route path="/schemas" element={<SchemasPage />} />
          <Route path="/schemas/:entityType" element={<SchemaDetailPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/timeline/:id" element={<TimelineEventDetailPage />} />
          <Route path="/interpretations" element={<InterpretationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
