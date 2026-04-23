import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { TypeBadge } from "@/components/shared/type_badge";
import {
  humanizeEntityType,
  humanizeRelationshipType,
  shortId,
} from "@/lib/humanize";
import type {
  EntityRelationshipsResponse,
  RelatedEntityExpansion,
  RelationshipSnapshot,
} from "@/types/api";

interface RelationshipPanelProps {
  entityId: string;
  data: EntityRelationshipsResponse | undefined;
  developerView?: boolean;
}

type DirectedRow = {
  rel: RelationshipSnapshot;
  direction: "outgoing" | "incoming";
  otherId: string;
  otherName: string | null;
  otherType: string | null;
  otherTypeLabel: string | null;
};

function titleFromRelatedSnapshot(expansion: RelatedEntityExpansion | undefined): string | null {
  const snap = expansion?.snapshot;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return null;
  const o = snap as Record<string, unknown>;
  for (const k of ["title", "name", "subject", "summary", "label", "headline", "topic"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function RelationshipPanel({ entityId, data, developerView }: RelationshipPanelProps) {
  const rows = useMemo<DirectedRow[]>(() => {
    if (!data) return [];
    const resolve = (id: string | undefined | null): RelatedEntityExpansion | undefined => {
      if (!id) return undefined;
      return data.related_entities?.[id];
    };
    const out = (data.outgoing ?? []).map<DirectedRow>((rel) => {
      const otherId = rel.target_entity_id;
      const expansion = resolve(otherId);
      return {
        rel,
        direction: "outgoing",
        otherId,
        otherName:
          rel.target_entity_name?.trim() ||
          expansion?.canonical_name?.trim() ||
          titleFromRelatedSnapshot(expansion) ||
          null,
        otherType:
          rel.target_entity_type ?? expansion?.entity_type ?? null,
        otherTypeLabel:
          rel.target_entity_type_label ?? expansion?.entity_type_label ?? null,
      };
    });
    const inc = (data.incoming ?? []).map<DirectedRow>((rel) => {
      const otherId = rel.source_entity_id;
      const expansion = resolve(otherId);
      return {
        rel,
        direction: "incoming",
        otherId,
        otherName:
          rel.source_entity_name?.trim() ||
          expansion?.canonical_name?.trim() ||
          titleFromRelatedSnapshot(expansion) ||
          null,
        otherType:
          rel.source_entity_type ?? expansion?.entity_type ?? null,
        otherTypeLabel:
          rel.source_entity_type_label ?? expansion?.entity_type_label ?? null,
      };
    });
    return [...out, ...inc];
  }, [data]);

  const groups = useMemo(() => {
    const byType = new Map<string, DirectedRow[]>();
    for (const row of rows) {
      const key = row.rel.relationship_type || "UNKNOWN";
      const list = byType.get(key) ?? [];
      list.push(row);
      byType.set(key, list);
    }
    return Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No relationships yet.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map(([relType, list]) => (
        <section key={relType}>
          <h3 className="mb-2 text-sm font-semibold">
            {humanizeRelationshipType(relType)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {list.length}
            </span>
          </h3>
          <ul className="divide-y rounded border">
            {list.map((row) => (
              <RelationshipRow
                key={row.rel.relationship_key}
                row={row}
                selfId={entityId}
                developerView={developerView}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RelationshipRow({
  row,
  selfId,
  developerView,
}: {
  row: DirectedRow;
  selfId: string;
  developerView?: boolean;
}) {
  const otherLabel =
    row.otherName ||
    (row.otherId ? shortId(row.otherId, 10) : "Unknown entity");
  const otherTypeHuman = row.otherType
    ? humanizeEntityType(row.otherType, row.otherTypeLabel)
    : null;

  const DirectionIcon = row.direction === "outgoing" ? ArrowRight : ArrowLeft;

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <DirectionIcon
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {row.otherId ? (
          <Link
            to={`/entities/${encodeURIComponent(row.otherId)}`}
            className="truncate text-sm font-medium text-primary hover:underline"
            title={row.otherId}
          >
            {otherLabel}
          </Link>
        ) : (
          <span className="truncate text-sm font-medium">{otherLabel}</span>
        )}
        {row.otherType ? (
          <TypeBadge
            type={row.otherType}
            label={row.otherTypeLabel ?? undefined}
            humanize
            className="shrink-0"
          />
        ) : null}
        {otherTypeHuman ? (
          <span className="sr-only">{otherTypeHuman}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        {typeof row.rel.observation_count === "number" ? (
          <span title="Observation count">
            {row.rel.observation_count} obs
          </span>
        ) : null}
        {developerView ? (
          <span className="font-mono" title={row.rel.relationship_key}>
            {shortId(row.rel.relationship_key, 10)}
          </span>
        ) : null}
        {developerView ? (
          <span className="font-mono" title={selfId}>
            self {shortId(selfId, 6)}
          </span>
        ) : null}
      </div>
    </li>
  );
}
