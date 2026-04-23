/**
 * Attribution / agent-identity fields surfaced from the backend.
 *
 * These match the `AttributionProvenance` block written by the Neotoma
 * write-path services (see `src/crypto/agent_identity.ts`). Every field is
 * optional because existing rows predate AAuth and the Inspector must keep
 * rendering them.
 *
 * `attribution_tier` is the primary display signal; the remaining fields are
 * used for tooltips, filters, and the Settings summary.
 */
export type AgentAttributionTier =
  | "hardware"
  | "software"
  | "unverified_client"
  | "anonymous";

export interface AgentAttribution {
  agent_public_key?: string;
  agent_thumbprint?: string;
  agent_algorithm?: string;
  agent_sub?: string;
  agent_iss?: string;
  client_name?: string;
  client_version?: string;
  connection_id?: string;
  attribution_tier?: AgentAttributionTier;
  /** ISO-8601 timestamp when the attribution was recorded. */
  attributed_at?: string;
}

export interface Entity {
  id: string;
  entity_type: string;
  canonical_name: string;
  user_id?: string;
  merged_to_entity_id?: string | null;
  merged_at?: string | null;
}

export interface EntitySnapshot {
  /** Present on most API responses; some payloads use `id` only. */
  entity_id?: string;
  entity_type: string;
  schema_version?: string;
  snapshot: Record<string, unknown>;
  raw_fragments?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  computed_at?: string;
  observation_count?: number;
  last_observation_at?: string;
  canonical_name?: string;
  id?: string;
  merged_to_entity_id?: string | null;
  merged_at?: string | null;
  /** Optional schema-derived display label for `entity_type`. */
  entity_type_label?: string | null;
  /**
   * Optional, schema-informed ordering of the most important snapshot fields
   * for overview-style display. When absent, clients should fall back to
   * their own ordering heuristics.
   */
  primary_fields?: string[] | null;
  created_at?: string;
}

export interface Source {
  id: string;
  content_hash?: string;
  mime_type?: string;
  storage_url?: string;
  /** Local backend only: resolved absolute path to raw bytes on disk. */
  filesystem_absolute_path?: string;
  file_size?: number;
  original_filename?: string;
  source_type?: string;
  created_at?: string;
  user_id?: string;
  provenance?: Record<string, unknown> & Partial<AgentAttribution>;
}

export interface Observation {
  id: string;
  entity_id: string;
  entity_type: string;
  schema_version?: string;
  source_id?: string | null;
  interpretation_id?: string | null;
  observed_at?: string;
  specificity_score?: number;
  source_priority?: number;
  fields: Record<string, unknown>;
  user_id?: string;
  canonical_hash?: string;
  /**
   * Human-readable source label attached by the backend
   * (`attachSourceLabelsToObservations`). Prefer this over `source_id` for
   * display.
   */
  source?: string | null;
  /**
   * Agent-identity provenance written at observation creation time. See
   * `AgentAttribution`. Additional free-form keys may coexist in the
   * provenance blob, hence the intersection type.
   */
  provenance?: Record<string, unknown> & Partial<AgentAttribution>;
}

export interface RelationshipSnapshot {
  relationship_key: string;
  relationship_type: string;
  source_entity_id: string;
  target_entity_id: string;
  schema_version?: string;
  snapshot?: Record<string, unknown>;
  computed_at?: string;
  observation_count?: number;
  last_observation_at?: string;
  /**
   * Reducer provenance: a `field → observation_id` map that records which
   * contributing observation produced each snapshot field. This is NOT
   * AAuth / clientInfo attribution — use {@link agent_attribution} for
   * that. Kept as a generic blob so `JsonViewer` and the reducer
   * inspection UI continue to work.
   */
  provenance?: Record<string, unknown>;
  /**
   * Latest agent-identity attribution attached by the backend. Derived
   * from the most recent contributing `relationship_observations.provenance`
   * row. Null when no contributing observation carried attribution keys
   * (anonymous writes, pre-AAuth rows).
   */
  agent_attribution?: (Record<string, unknown> & Partial<AgentAttribution>) | null;
  user_id?: string;
  /**
   * Convenience top-level fields attached by the backend when
   * `expand_entities=true` is requested; populated from the related
   * entity snapshot so clients don't have to look up `related_entities`.
   */
  source_entity_name?: string | null;
  source_entity_type?: string | null;
  source_entity_type_label?: string | null;
  target_entity_name?: string | null;
  target_entity_type?: string | null;
  target_entity_type_label?: string | null;
}

export interface RelationshipObservation {
  id: string;
  source_id?: string;
  observed_at?: string;
  specificity_score?: number;
  source_priority?: number;
  metadata?: Record<string, unknown>;
  /**
   * Agent-identity provenance written at relationship observation time.
   * See {@link AgentAttribution}; coexists with free-form keys.
   */
  provenance?: Record<string, unknown> & Partial<AgentAttribution>;
}

export interface RelationshipSnapshotResponse {
  snapshot: RelationshipSnapshot;
  observations: RelationshipObservation[];
}

export interface RelatedEntityExpansion {
  entity_id?: string;
  entity_type?: string;
  canonical_name?: string;
  snapshot?: Record<string, unknown>;
  entity_type_label?: string | null;
}

export interface EntityRelationshipsResponse {
  outgoing: RelationshipSnapshot[];
  incoming: RelationshipSnapshot[];
  relationships: RelationshipSnapshot[];
  related_entities?: Record<string, RelatedEntityExpansion>;
}

/** GET /sources/:id/relationships — flat list (no incoming/outgoing split). */
export interface SourceRelationshipsResponse {
  relationships: RelationshipSnapshot[];
  related_entities?: Record<string, RelatedEntityExpansion>;
}

export interface TimelineEvent {
  id: string;
  event_type?: string;
  event_timestamp?: string;
  event_date?: string;
  source_id?: string;
  source_field?: string;
  entity_id?: string;
  entity_name?: string;
  entity_type?: string;
  created_at?: string;
  user_id?: string;
  entity_ids?: string[];
  properties?: Record<string, unknown>;
  provenance?: Record<string, unknown> & Partial<AgentAttribution>;
}

export interface EntitySchema {
  entity_type: string;
  schema_version?: string;
  field_names?: string[];
  field_summary?: Record<string, unknown>;
  schema_definition?: { fields: Record<string, FieldDefinition> };
  reducer_config?: { merge_policies: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  active?: boolean;
}

export interface FieldDefinition {
  type: string;
  required?: boolean;
  validator?: string;
  converters?: unknown;
}

export interface Interpretation {
  id: string;
  source_id: string;
  status?: string;
  created_at?: string;
  completed_at?: string;
  interpretation_config?: Record<string, unknown>;
  observations_created?: number;
  provenance?: Record<string, unknown> & Partial<AgentAttribution>;
}

export type RecordActivityType =
  | "entity"
  | "source"
  | "observation"
  | "interpretation"
  | "timeline_event"
  | "relationship";

export interface RecordActivityItem {
  record_type: RecordActivityType;
  id: string;
  activity_at: string;
  title: string;
  subtitle: string | null;

  /**
   * Enriched, human-readable fields emitted by newer `/record_activity`
   * responses. All optional for backwards compatibility: when absent, UI
   * should fall back to `title`/`subtitle` rendering.
   */
  entity_id?: string | null;
  entity_name?: string | null;
  entity_type?: string | null;
  source_id?: string | null;
  source_filename?: string | null;
  source_type?: string | null;
  source_entity_id?: string | null;
  source_entity_name?: string | null;
  target_entity_id?: string | null;
  target_entity_name?: string | null;
  relationship_type?: string | null;
  event_type?: string | null;
  status?: string | null;
  turn_key?: string | null;
  group_key?: string | null;

  /**
   * Derived agent trust tier for this activity row. Provided by the
   * backend from row-level `AgentAttribution` provenance. Null for
   * record types that do not carry attribution (e.g. entity rows) or
   * rows that predate AAuth.
   */
  attribution_tier?: AgentAttributionTier | null;
  /**
   * Best-effort human-readable agent label for feed rendering. Priority
   * chosen server-side: `client_name` (+ `client_version`) → `agent_sub`
   * → shortened `agent_thumbprint`.
   */
  agent_label?: string | null;
}

/**
 * One row of the Agents directory (`GET /agents`). Aggregates a distinct
 * writer across all write-path tables based on `AgentAttribution`
 * provenance. `agent_key` is a stable identifier suitable for URL paths
 * — format: `thumb:<thumbprint>`, `sub:<subject>`,
 * `name:<client>[@version]`, or `anonymous`.
 */
export interface AgentDirectoryEntry {
  agent_key: string;
  label: string;
  tier: AgentAttributionTier;
  agent_thumbprint?: string | null;
  agent_public_key?: string | null;
  agent_algorithm?: string | null;
  agent_sub?: string | null;
  agent_iss?: string | null;
  client_name?: string | null;
  client_version?: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  total_records: number;
  record_counts: Partial<Record<RecordActivityType, number>>;
}

export interface AgentsListResponse {
  agents: AgentDirectoryEntry[];
  total: number;
}

export interface AgentDetailResponse {
  agent: AgentDirectoryEntry;
}

export interface AgentRecordsResponse {
  items: RecordActivityItem[];
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface RecentConversationRelatedEntity {
  entity_id: string;
  entity_type?: string | null;
  canonical_name?: string | null;
  title?: string | null;
  relationship_type: string;
}

export interface RecentConversationMessage {
  message_id: string;
  canonical_name?: string | null;
  role?: string | null;
  content?: string | null;
  turn_key?: string | null;
  activity_at: string;
  related_entities: RecentConversationRelatedEntity[];
}

export interface RecentConversationItem {
  conversation_id: string;
  canonical_name?: string | null;
  title?: string | null;
  activity_at: string;
  message_count: number;
  /** Latest observation provenance on the conversation entity (agent identity). */
  latest_write_provenance?: Record<string, unknown> | null;
  messages: RecentConversationMessage[];
}

export interface RecentConversationsResponse {
  items: RecentConversationItem[];
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  sources_count: number;
  total_entities: number;
  entities_by_type: Record<string, number>;
  total_relationships: number;
  total_events: number;
  total_observations: number;
  total_interpretations: number;
  last_updated: string;
}

/**
 * Rollup of attribution coverage across the write-path record types, used by
 * the Settings "Attribution" section. Counts are per-tier so hardware /
 * software / unverified_client / anonymous ratios can be rendered at a
 * glance. Backend may omit a bucket when the count is zero.
 */
export interface AttributionSummary {
  total_rows: number;
  by_tier: Partial<Record<AgentAttributionTier, number>>;
  by_record_type: Partial<
    Record<
      "observation" | "relationship" | "source" | "timeline_event" | "interpretation",
      {
        total: number;
        by_tier: Partial<Record<AgentAttributionTier, number>>;
      }
    >
  >;
  /** Distinct agents seen (count by `agent_thumbprint` or falling back to client_name). */
  distinct_agents?: number;
  last_attributed_at?: string;
}

export interface ServerInfo {
  httpPort?: number;
  apiBase?: string;
  mcpUrl?: string;
}

export interface UserInfo {
  user_id: string;
  email?: string;
  storage?: {
    storage_backend: string;
    data_dir: string;
    sqlite_db: string;
  };
}

export interface StoreRequest {
  entities?: Record<string, unknown>[];
  relationships?: StoreRelationship[];
  source_priority?: number;
  idempotency_key?: string;
  file_idempotency_key?: string;
  file_content?: string;
  file_path?: string;
  mime_type?: string;
  original_filename?: string;
  user_id?: string;
}

export interface StoreRelationship {
  relationship_type: string;
  source_index: number;
  target_index: number;
}

export interface StoreResponse {
  structured?: {
    success: boolean;
    entities: Array<{ entity_id: string; entity_type: string; observation_id: string }>;
  };
  unstructured?: {
    source_id: string;
    content_hash: string;
    file_size: number;
    deduplicated: boolean;
    interpretation?: Record<string, unknown>;
    entity_ids?: string[];
    asset_entity_id?: string;
  };
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface EntitiesQueryParams {
  entity_type?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  published?: boolean;
  published_after?: string;
  published_before?: string;
  include_snapshots?: boolean;
  include_merged?: boolean;
  user_id?: string;
  /**
   * R3: filter entities by the identity_basis carried on their observations.
   * Most useful value is `heuristic_name`, which surfaces entities that were
   * matched by canonical_name similarity rather than a schema rule.
   */
  identity_basis?:
    | "schema_rule"
    | "schema_lookup"
    | "heuristic_name"
    | "heuristic_fallback"
    | "target_id";
}

export interface ObservationsQueryParams {
  entity_id?: string;
  entity_type?: string;
  source_id?: string;
  limit?: number;
  offset?: number;
  user_id?: string;
}

export interface GraphNeighborhoodParams {
  node_id: string;
  node_type?: "entity" | "source";
  include_relationships?: boolean;
  include_sources?: boolean;
  include_events?: boolean;
  include_observations?: boolean;
}

export interface RelatedEntitiesParams {
  entity_id: string;
  relationship_types?: string[];
  direction?: "inbound" | "outbound" | "both";
  max_hops?: number;
  include_entities?: boolean;
}

export interface HealthCheckResult {
  stale_snapshots?: number;
  details?: Record<string, unknown>[];
  auto_fix?: boolean;
}
