import type { SportConfig } from '../../../types/sports';

// Catalogue summary widgets: stat cards + mobile preview.

// Summary cards.
export function SummaryCard({
  label,
  value,
  sub,
  color = 'text-ink-900',
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card py-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

// Mobile preview.
export function MobilePreview({ sports }: { sports: SportConfig[] }) {
  const onboarding = sports.filter((s) => s.enabled && s.showInOnboarding);
  const filter = sports.filter((s) => s.enabled && s.showInFilter);

  return (
    <div className="panel p-5 space-y-5">
      <h2 className="text-base font-semibold text-ink-900">Mobile Preview</h2>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Onboarding sport picker ({onboarding.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {onboarding.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700"
            >
              <span>{s.emoji}</span>
              {s.name}
            </span>
          ))}
          {onboarding.length === 0 && (
            <span className="text-xs text-ink-400">No sports enabled</span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Discovery filter ({filter.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {filter.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
            >
              <span>{s.emoji}</span>
              {s.name}
            </span>
          ))}
          {filter.length === 0 && <span className="text-xs text-ink-400">No sports in filter</span>}
        </div>
      </div>

      <p className="rounded-xl border border-warning-200 bg-warning-100 px-4 py-3 text-xs text-warning-700">
        <span className="font-semibold">Note:</span> Changes take effect on the mobile app after the
        next app config sync. Sports with existing activities cannot be removed.
      </p>
    </div>
  );
}
