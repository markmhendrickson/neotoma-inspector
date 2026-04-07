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
}

export interface Source {
  id: string;
  content_hash?: string;
  mime_type?: string;
  storage_url?: string;
  file_size?: number;
  original_filename?: string;
  source_type?: string;
  created_at?: string;
  user_id?: string;
  provenance?: Record<string, unknown>;
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
  provenance?: Record<string, unknown>;
  user_id?: string;
}

export interface TimelineEvent {
  id: string;
  event_type?: string;
  event_timestamp?: string;
  event_date?: string;
  source_id?: string;
  source_field?: string;
  entity_id?: string;
  created_at?: string;
  user_id?: string;
  entity_ids?: string[];
  properties?: Record<string, unknown>;
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
