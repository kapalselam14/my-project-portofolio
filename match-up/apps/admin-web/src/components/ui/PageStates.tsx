import type { ReactNode } from 'react';

// Skeleton primitive.

export function Skeleton({ className = '' }: { className?: string }) {
  // Add the shared pulse treatment while each placeholder supplies its own dimensions.
  return <div className={`animate-pulse rounded-lg bg-ink-200 dark:bg-ink-700 ${className}`} />;
}

// Page specific skeletons.

function SkRow({ cols }: { cols: string[] }) {
  // Render a table-like placeholder row from the widths expected by its page.
  return (
    <div className="flex items-center gap-4 border-b border-ink-100 dark:border-ink-700 px-6 py-4">
      {cols.map((w, i) => (
        <Skeleton key={i} className={`h-4 ${w}`} />
      ))}
    </div>
  );
}

export function MembersPageSkeleton() {
  // Mirror the member page's header, summary cards, filters, and table while loading.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-700 px-6 py-4">
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-16" />
            ))}
          </div>
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
        <div className="border-b border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-900/30 px-6 py-2.5 flex gap-4">
          {['w-48', 'w-24', 'w-20', 'w-28', 'w-20', 'w-24', 'w-28', 'w-20', 'w-8'].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <SkRow
            key={i}
            cols={['w-8', 'w-48', 'w-20', 'w-16', 'w-28', 'w-16', 'w-24', 'w-20', 'w-8']}
          />
        ))}
      </div>
    </div>
  );
}

export function ActivitiesPageSkeleton() {
  // Match the activity page's summary and tabular layout before its records arrive.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-700 px-6 py-4">
          <div className="flex gap-1.5">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-16" />
            ))}
          </div>
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
        {[...Array(7)].map((_, i) => (
          <SkRow
            key={i}
            cols={['w-52', 'w-20', 'w-32', 'w-20', 'w-20', 'w-24', 'w-20', 'w-20', 'w-8']}
          />
        ))}
      </div>
    </div>
  );
}

export function ReportsPageSkeleton() {
  // Reserve space for the report queue and its moderation summary panel.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="panel overflow-hidden">
          <div className="border-b border-ink-100 dark:border-ink-700 px-6 py-4 space-y-3">
            <div className="flex gap-1.5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-7 w-20" />
              ))}
            </div>
            <Skeleton className="h-8 rounded-full" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-ink-100 dark:border-ink-700 p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="panel p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BroadcastsPageSkeleton() {
  // Match the broadcast list's header, summary cards, and message rows.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-700 px-6 py-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-14" />
            ))}
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border-b border-ink-100 dark:border-ink-700 px-6 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  // Preserve the analytics dashboard's chart and KPI layout during its initial fetch.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}

export function SportsPageSkeleton() {
  // Represent the sports table and side preview while configuration is loading.
  return (
    <div className="page-container space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-700 px-6 py-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          {[...Array(8)].map((_, i) => (
            <SkRow key={i} cols={['w-8', 'w-48', 'w-20', 'w-16', 'w-8']} />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Generic fallback (still used for pages not yet custom) ───────────────────

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  // Generic loading layout for pages without a dedicated skeleton component.
  return (
    <div className="page-container space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

// Error state.

export function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  // Pair the fetch error with the retry operation supplied by the page.
  return (
    <div className="page-container flex flex-col items-center justify-center gap-4 py-24">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-900/30">
        <svg
          className="h-6 w-6 text-danger-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16v.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-ink-600 dark:text-ink-400">
        Failed to load: {message}
      </p>
      <button onClick={onRetry} className="btn-primary rounded-xl px-4 py-2 text-sm">
        Retry
      </button>
    </div>
  );
}

// Empty state.

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  // Optional props let this shared state serve both informational and actionable cases.
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-700 text-ink-400 dark:text-ink-500">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">{title}</p>
        {description && <p className="mt-0.5 text-xs text-ink-400">{description}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="btn-outline rounded-lg px-3 py-1.5 text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}

// Common empty state icons.

// Keep page-specific empty-state illustrations centralized and reusable.
// eslint-disable-next-line react-refresh/only-export-components
export const EmptyIcons = {
  members: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85" />
    </svg>
  ),
  activities: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v3M15 3v3" />
    </svg>
  ),
  reports: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v6m0 3v.5" />
    </svg>
  ),
  broadcasts: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  ),
  sports: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 000 20M2 12h20" />
    </svg>
  ),
  search: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
};
