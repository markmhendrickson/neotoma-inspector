import { post } from "../client";

export type IssueBulkItemResult = {
  entity_id: string;
  ok: boolean;
  github_closed?: boolean;
  error?: string;
};

export type IssuesBulkResponse = {
  results: IssueBulkItemResult[];
};

export function bulkCloseIssues(entityIds: string[]) {
  return post<IssuesBulkResponse>("/issues/bulk_close", { entity_ids: entityIds });
}

export function bulkRemoveIssues(entityIds: string[]) {
  return post<IssuesBulkResponse>("/issues/bulk_remove", { entity_ids: entityIds });
}
