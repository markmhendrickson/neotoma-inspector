import { useQuery } from "@tanstack/react-query";
import { queryEntities, getEntityById, getEntityObservations, getEntityRelationships, getFieldProvenance } from "@/api/endpoints/entities";
import type { EntitiesQueryParams } from "@/types/api";

export function useEntitiesQuery(params: EntitiesQueryParams) {
  return useQuery({
    queryKey: ["entities", params],
    queryFn: () => queryEntities(params),
    placeholderData: (prev) => prev,
  });
}

export function useEntityById(id: string | undefined) {
  return useQuery({
    queryKey: ["entity", id],
    queryFn: () => getEntityById(id!),
    enabled: !!id,
  });
}

export function useEntityObservations(id: string | undefined) {
  return useQuery({
    queryKey: ["entity-observations", id],
    queryFn: () => getEntityObservations(id!),
    enabled: !!id,
  });
}

export function useEntityRelationships(id: string | undefined) {
  return useQuery({
    queryKey: ["entity-relationships", id],
    queryFn: () => getEntityRelationships(id!),
    enabled: !!id,
  });
}

export function useFieldProvenance(entityId: string | undefined, field: string | undefined) {
  return useQuery({
    queryKey: ["field-provenance", entityId, field],
    queryFn: () => getFieldProvenance(entityId!, field!),
    enabled: !!entityId && !!field,
  });
}
