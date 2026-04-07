import { get, post } from "../client";
import type { EntitySchema } from "@/types/api";

export function listSchemas(userId?: string) {
  return get<{ schemas: EntitySchema[] }>("/schemas", userId ? { user_id: userId } : undefined);
}

export function getSchemaByEntityType(entityType: string) {
  return get<EntitySchema>(`/schemas/${encodeURIComponent(entityType)}`);
}

export function registerSchema(data: {
  entity_type: string;
  schema_definition: Record<string, unknown>;
  reducer_config: Record<string, unknown>;
  schema_version?: string;
  user_specific?: boolean;
  activate?: boolean;
}) {
  return post<Record<string, unknown>>("/register_schema", data);
}

export function updateSchemaIncremental(data: {
  entity_type: string;
  fields_to_add: Array<{ field_name: string; field_type: string; required?: boolean; reducer_strategy?: string }>;
  schema_version?: string;
  user_specific?: boolean;
  activate?: boolean;
  migrate_existing?: boolean;
}) {
  return post<Record<string, unknown>>("/update_schema_incremental", data);
}

export function analyzeSchemaCandidates(params?: { entity_type?: string; min_frequency?: number; min_confidence?: number }) {
  return post<Record<string, unknown>>("/analyze_schema_candidates", params ?? {});
}

export function getSchemaRecommendations(entityType: string, source?: string, status?: string) {
  return post<Record<string, unknown>>("/get_schema_recommendations", {
    entity_type: entityType,
    ...(source ? { source } : {}),
    ...(status ? { status } : {}),
  });
}
