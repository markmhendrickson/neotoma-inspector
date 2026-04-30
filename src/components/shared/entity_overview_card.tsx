import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/shared/type_badge";
import { EntityLink } from "@/components/shared/entity_link";
import { FieldValue } from "@/components/shared/field_value";
import { LiveRelativeTime } from "@/components/shared/live_relative_time";
import { humanizeKey, absoluteDateTime, entityDisplayHeadline } from "@/lib/humanize";
import { pickPrimaryFields } from "@/lib/snapshot_ordering";
import type { EntitySnapshot, EntitySchema } from "@/types/api";

interface EntityOverviewCardProps {
  entity: EntitySnapshot;
  schema?: EntitySchema | null;
  /** Optional node for the "merged into" pill when applicable. */
  mergedInto?: React.ReactNode;
  /**
   * When false, omits the large title block (use when `PageShell` already
   * shows the same headline as `h1`).
   */
  showHeroTitle?: boolean;
  /**
   * When false, omits the colored type badge (e.g. when the page header already
   * shows the humanized entity type).
   */
  showTypeBadge?: boolean;
  /**
   * When set, primary-field chips whose value equals this string are hidden
   * so the overview does not repeat the page title (e.g. duplicate `title`).
   */
  dedupeHeadline?: string | null;
  /** Extra body below the primary-field summary (e.g. full snapshot list). */
  children?: React.ReactNode;
  /**
   * When true, skip the primary-field grid so `children` is the only body
   * (avoids duplicating fields already shown in the full list).
   */
  omitPrimaryFields?: boolean;
}

export function EntityOverviewCard({
  entity,
  schema,
  mergedInto,
  showHeroTitle = true,
  showTypeBadge = true,
  dedupeHeadline,
  children,
  omitPrimaryFields = false,
}: EntityOverviewCardProps) {
  const snapshot = (entity.snapshot && typeof entity.snapshot === "object"
    ? (entity.snapshot as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const schemaFieldOrder: string[] =
    schema?.schema_definition?.fields
      ? Object.keys(schema.schema_definition.fields)
      : schema?.field_names ?? [];

  const primaryKeysRaw =
    (entity.primary_fields && entity.primary_fields.length > 0
      ? entity.primary_fields
      : pickPrimaryFields(snapshot, schemaFieldOrder, 5)
    ).filter((k) => k in snapshot);

  const dedupe = dedupeHeadline?.trim();
  const primaryKeys = dedupe
    ? primaryKeysRaw.filter((k) => {
        const v = snapshot[k];
        if (v === undefined || v === null) return true;
        if (typeof v === "string" && v.trim() === dedupe) return false;
        if (typeof v === "number" || typeof v === "boolean") {
          if (String(v) === dedupe) return false;
        }
        return true;
      })
    : primaryKeysRaw;

  const displayName = entityDisplayHeadline({
    canonical_name: entity.canonical_name,
    snapshot,
    entity_type: entity.entity_type,
    entity_type_label: entity.entity_type_label ?? undefined,
    entity_id: entity.entity_id ?? entity.id,
    id: entity.id,
  });

  const schemaLabel =
    entity.entity_type_label ||
    (schema?.metadata && typeof schema.metadata === "object"
      ? ((schema.metadata as Record<string, unknown>).label as string | undefined)
      : undefined);

  const fieldType = (k: string): string | undefined => {
    const f = schema?.schema_definition?.fields?.[k] as { type?: string } | undefined;
    if (f?.type) return f.type;
    const summary = schema?.field_summary?.[k] as { type?: string } | undefined;
    return summary?.type;
  };

  const fieldLabel = (k: string): string => humanizeKey(k);

  const hasHeaderContent = showHeroTitle || showTypeBadge || mergedInto != null;

  return (
    <Card>
      {hasHeaderContent ? (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {showHeroTitle ? (
                <h2 className="text-xl font-semibold leading-tight break-words">
                  {displayName}
                </h2>
              ) : null}
              {showTypeBadge || mergedInto ? (
                <div
                  className={
                    showHeroTitle
                      ? "mt-1 flex items-center flex-wrap gap-2 text-sm text-muted-foreground"
                      : "flex items-center flex-wrap gap-2 text-sm text-muted-foreground"
                  }
                >
                  {showTypeBadge ? (
                    <TypeBadge type={entity.entity_type} label={schemaLabel} humanize />
                  ) : null}
                  {showTypeBadge && mergedInto ? <span>·</span> : null}
                  {mergedInto ? <span>{mergedInto}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          "space-y-4",
          !hasHeaderContent ? "pt-6" : undefined,
          omitPrimaryFields && children ? "pt-6" : undefined,
        )}
      >
        {!omitPrimaryFields ? (
          primaryKeys.length > 0 ? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {primaryKeys.map((k) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {fieldLabel(k)}
                  </dt>
                  <dd className="mt-0.5">
                    <FieldValue value={snapshot[k]} typeHint={fieldType(k)} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No primary fields yet. Head to All fields for the full snapshot.
            </p>
          )
        ) : null}
        {children ? (
          <div
            className={
              !omitPrimaryFields && primaryKeys.length > 0 ? "space-y-4 border-t pt-4" : "space-y-4"
            }
          >
            {children}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Inline stats for entity headers (observations, relationships, timestamps). */
export function EntityOverviewStatsRow({
  observationCount,
  relationshipCount,
  lastUpdated,
  createdAt,
}: {
  observationCount?: number;
  relationshipCount?: number;
  lastUpdated?: string | null;
  createdAt?: string | null;
}) {
  return (
    <>
      <Stat label="Observations" value={numberLabel(observationCount)} />
      <Stat label="Relationships" value={numberLabel(relationshipCount)} />
      <Stat
        label="Last updated"
        value={
          lastUpdated ? (
            <LiveRelativeTime iso={lastUpdated} title={false} className="font-medium" />
          ) : (
            "—"
          )
        }
        title={lastUpdated ? absoluteDateTime(lastUpdated) : undefined}
      />
      {createdAt ? (
        <Stat
          label="Created"
          value={<LiveRelativeTime iso={createdAt} title={false} className="font-medium" />}
          title={absoluteDateTime(createdAt)}
        />
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div className="flex items-baseline gap-2" title={title}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={typeof value === "string" ? "font-medium" : undefined}>{value}</span>
    </div>
  );
}

function numberLabel(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString();
}

/**
 * Named export used by `EntityOverviewCard` consumers that need a reusable
 * "merged into" pill.
 */
export function MergedIntoPill({ targetId }: { targetId: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>Merged into</span>
      <EntityLink id={targetId} />
    </span>
  );
}
