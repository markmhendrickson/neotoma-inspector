import { post } from "../client";

export function correct(data: {
  entity_id: string;
  entity_type: string;
  field: string;
  value: unknown;
  idempotency_key: string;
}) {
  return post<Record<string, unknown>>("/correct", data);
}
