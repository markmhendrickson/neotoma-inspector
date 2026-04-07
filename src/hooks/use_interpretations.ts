import { useQuery } from "@tanstack/react-query";
import { listInterpretations } from "@/api/endpoints/interpretations";

export function useInterpretations(params?: { source_id?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["interpretations", params],
    queryFn: () => listInterpretations(params),
    placeholderData: (prev) => prev,
  });
}
