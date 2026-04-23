import { useQuery } from "@tanstack/react-query";
import { listSources, getSourceById, getSourceRelationships } from "@/api/endpoints/sources";

export function useSources(params?: { search?: string; mime_type?: string; source_type?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["sources", params],
    queryFn: () => listSources(params),
    placeholderData: (prev) => prev,
  });
}

export function useSourceById(id: string | undefined) {
  return useQuery({
    queryKey: ["source", id],
    queryFn: () => getSourceById(id!),
    enabled: !!id,
  });
}

export function useSourceRelationships(id: string | undefined) {
  return useQuery({
    queryKey: ["source-relationships", id],
    queryFn: () => getSourceRelationships(id!, { expand_entities: true }),
    enabled: !!id,
  });
}
