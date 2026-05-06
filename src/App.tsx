import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app_layout";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const SearchPage = lazy(() => import("@/pages/search"));
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
const RecentActivityPage = lazy(() => import("@/pages/recent_activity"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const FeedbackAdminUnlockPage = lazy(() => import("@/pages/feedback_admin_unlock"));
const RecentConversationsPage = lazy(() => import("@/pages/recent_conversations"));
const ConversationDetailPage = lazy(() => import("@/pages/conversation_detail"));
const TurnsPage = lazy(() => import("@/pages/turns"));
const TurnDetailPage = lazy(() => import("@/pages/turn_detail"));
const InterpretationsPage = lazy(() => import("@/pages/interpretations"));
const AgentsPage = lazy(() => import("@/pages/agents"));
const AgentDetailPage = lazy(() => import("@/pages/agent_detail"));
const AgentGrantsPage = lazy(() => import("@/pages/agent_grants"));
const AgentGrantDetailPage = lazy(() => import("@/pages/agent_grant_detail"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const SandboxPage = lazy(() => import("@/pages/sandbox"));
const ComplianceDashboardPage = lazy(() => import("@/pages/compliance"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12" aria-busy aria-label="Loading page">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-72 max-w-[90vw]" />
      <Skeleton className="h-4 w-48 max-w-[70vw]" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
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
          <Route path="/activity" element={<RecentActivityPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/feedback/admin-unlock" element={<FeedbackAdminUnlockPage />} />
          <Route path="/conversations/:conversationId" element={<ConversationDetailPage />} />
          <Route path="/conversations" element={<RecentConversationsPage />} />
          <Route path="/turns" element={<TurnsPage />} />
          <Route path="/turns/:turnKey" element={<TurnDetailPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/timeline/:id" element={<TimelineEventDetailPage />} />
          <Route path="/interpretations" element={<InterpretationsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/grants" element={<AgentGrantsPage />} />
          <Route path="/agents/grants/:id" element={<AgentGrantDetailPage />} />
          <Route path="/agents/:key" element={<AgentDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/compliance" element={<ComplianceDashboardPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
