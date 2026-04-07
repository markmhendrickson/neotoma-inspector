import { get, post } from "../client";
import type { Source, StoreRequest, StoreResponse } from "@/types/api";

export function listSources(params?: { search?: string; mime_type?: string; source_type?: string; limit?: number; offset?: number }) {
  return get<{ sources: Source[] }>("/sources", params as Record<string, string | number>);
}

export function getSourceById(id: string) {
  return get<Source>(`/sources/${encodeURIComponent(id)}`);
}

export function getFileUrl(filePath: string, expiresIn?: number) {
  return get<{ url: string }>("/get_file_url", { file_path: filePath, ...(expiresIn ? { expires_in: expiresIn } : {}) });
}

export function store(data: StoreRequest) {
  return post<StoreResponse>("/store", data);
}

export function storeUnstructured(data: { file_content: string; mime_type: string; idempotency_key?: string; original_filename?: string }) {
  return post<StoreResponse["unstructured"]>("/store/unstructured", data);
}
