import {
  flexRender,
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  className?: string;
  emptyLabel?: string;
}

/**
 * Shared sortable/extensible data-table built on TanStack Table.
 *
 * Mirrors `frontend/src/components/ui/data-table.tsx`. Promoted from
 * `inspector/src/components/shared/data_table.tsx` as part of the design-system
 * surface unification (M4). Both copies must be kept in sync; see
 * `docs/ui/design_system/dependencies.yaml`.
 */
export function DataTable<TData>({
  columns,
  data,
  className,
  emptyLabel = "No data",
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn("rounded-md border", className)}>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-muted/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left font-medium text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
