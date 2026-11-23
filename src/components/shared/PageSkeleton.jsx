import { Skeleton } from "@/components/ui/skeleton";

// Layout-shaped loading state: header + a few cards. Use instead of a centered spinner.
export default function PageSkeleton({ rows = 3 }) {
  return (
    <div className="p-4 md:p-6 lg:p-8" role="status" aria-busy="true" aria-label="טוען">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
