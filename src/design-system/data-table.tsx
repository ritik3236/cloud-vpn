import { cn } from '@/lib/cn';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

/**
 * One column config drives the header AND the body. Hand-writing cells next to a generated
 * header is how a table ends up showing the right labels over the wrong data when a column is
 * added or reordered — nothing throws, so nobody notices.
 */
export type Column<T> = {
  key: string;
  header: string;
  /** Right-aligns and sets tabular figures, so digits stack for vertical comparison. */
  numeric?: boolean;
  headClassName?: string;
  cell: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'h-9 text-xs font-medium text-muted-foreground',
                  column.numeric && 'text-right',
                  column.headClassName,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn('py-2.5 align-middle', column.numeric && 'tabular text-right')}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Mirrors the real table — same columns, same row height — so nothing shifts on load. */
export function DataTableSkeleton<T>({ columns, rows = 4 }: { columns: Column<T>[]; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} className="h-9 text-xs font-medium text-muted-foreground">
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column.key} className="py-2.5">
                  <div className="h-4 w-full max-w-28 animate-pulse rounded bg-muted" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
