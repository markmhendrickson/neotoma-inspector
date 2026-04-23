import type { Source } from "@/types/api";
import { truncateId } from "@/lib/utils";

export function sourceTitle(source: Source): string {
  if (source.original_filename?.trim()) return source.original_filename.trim();
  const inferred = firstStringValue(source.provenance, ["title", "name", "file_name", "filename"]);
  if (inferred) return inferred;
  return `Source ${truncateId(source.id, 10)}`;
}

export function sourceDetail(source: Source): string {
  const summary = firstStringValue(source.provenance, [
    "summary",
    "description",
    "content",
    "conversation_title",
    "prompt",
  ]);
  if (summary) return truncate(summary, 140);

  const type = source.source_type || "source";
  const mime = source.mime_type || "unknown format";
  return `${humanize(type)} · ${mime}`;
}

export function sourceKindLabel(source: Source): string {
  const type = source.source_type ? humanize(source.source_type) : "Source";
  return source.mime_type ? `${type} · ${source.mime_type}` : type;
}

function firstStringValue(
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const compact = value.replace(/\s+/g, " ").trim();
      if (compact) return compact;
    }
  }
  return undefined;
}

function humanize(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
