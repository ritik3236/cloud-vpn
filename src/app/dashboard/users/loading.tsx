import { DataTableSkeleton, PageHeader } from '@/design-system';

/** This page waits on Clerk, not just the database, so the wait is worth drawing. */
export default function UsersLoading() {
  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Syncing with Clerk…" />
      <DataTableSkeleton
        columns={[
          { key: 'person', header: 'Person', cell: () => null },
          { key: 'status', header: 'Status', cell: () => null },
          { key: 'seen', header: 'Last sign-in', cell: () => null },
          { key: 'live', header: 'Live tunnels', numeric: true, cell: () => null },
          { key: 'configs', header: 'Configs', numeric: true, cell: () => null },
        ]}
      />
    </div>
  );
}
