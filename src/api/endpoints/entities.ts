import { get, post } from "../client";
import type { EntitySnapshot, EntitiesQueryParams, Observation, RelationshipSnapshot } from "@/types/api";

export function queryEntities(params: EntitiesQueryParams) {
  return post<{ entities: EntitySnapshot[]; total: number; limit: number; offset: number }>("/entities/query", params);
}

type EntityDetailResponse = EntitySnapshot | { entity: EntitySnapshot };

function unwrapEntityDetail(res: EntityDetailResponse): EntitySnapshot {
  if (res && typeof res === "object" && "entity" in res && res.entity && typeof res.entity === "object") {
    return res.entity;
  }
  return res as EntitySnapshot;
}

export function getEntityById(id: string) {
  return get<EntityDetailResponse>(`/entities/${encodeURIComponent(id)}`).then(unwrapEntityDetail);
}

export function getEntityObservations(id: string) {
  return get<{ observations: Observation[] }>(`/entities/${encodeURIComponent(id)}/observations`);
}

export function getEntityRelationships(id: string) {
  return get<{ relationships: RelationshipSnapshot[] }>(`/entities/${encodeURIComponent(id)}/relationships`);
}

export function getEntitySnapshot(entityId: string) {
  return post<EntitySnapshot>("/get_entity_snapshot", { entity_id: entityId });
}

export function getFieldProvenance(entityId: string, field: string) {
  return post<Record<string, unknown>>("/get_field_provenance", { entity_id: entityId, field });
}

export function mergeEntities(fromEntityId: string, toEntityId: string, mergeReason?: string) {
  return post<{ observations_moved: number; merged_at: string }>("/entities/merge", {
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    merge_reason: mergeReason,
  });
}

export function deleteEntity(entityId: string, entityType: string, reason?: string) {
  return post<Record<string, unknown>>("/delete_entity", {
    entity_id: entityId,
    entity_type: entityType,
    reason,
  });
}

export function restoreEntity(entityId: string, entityType: string, reason?: string) {
  return post<Record<string, unknown>>("/restore_entity", {
    entity_id: entityId,
    entity_type: entityType,
    reason,
  });
}
