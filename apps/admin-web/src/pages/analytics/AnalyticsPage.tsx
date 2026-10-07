import { useAnalytics } from '../../hooks/useAnalytics';
import { AnalyticsPageSkeleton, PageError } from '../../components/ui/PageStates';
import { useTheme } from '../../context/ThemeContext';
import { downloadCsv } from '../../utils/csvExport';
import type { AnalyticsData, AnalyticsRange } from '../../services/analyticsService';

// ─── SVG line chart ───────────────────────────────────────────────────────────

function LineChart({
  data,
  keys,
  colors,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  colors: string[];
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const H = 180;
  const pad = { top: 10, bottom: 24, left: 4, right: 4 };
  const W = 600;
  const chartH = H - pad.top - pad.bottom;
  const n = data.length;

  const xOf = (i: number) => {
    if (n <= 1) return W / 2;
    return pad.left + (i / (n - 1)) * (W - pad.left - pad.right);
  };

  const series = keys.map((key) => ({
    key,
    values: data.map((item) => {
      const value = Number(item[key]);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    }),
  }));

  const sharedMax = Math.max(
    ...series.flatMap((item) => item.values),
    0,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="none"
      aria-label="Analytics chart"
      role="img"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + chartH * (1 - t);

        return (
          <line
            key={t}
            x1={pad.left}
            y1={y}
            x2={W - pad.right}
            y2={y}
            stroke={isDark ? '#334155' : '#e2e8f0'}
            strokeWidth="1"
          />
        );
      })}

      {series.map(({ key, values }, seriesIndex) => {
        const yOf = (value: number) =>
          sharedMax > 0
            ? pad.top + chartH - (value / sharedMax) * chartH
            : pad.top + chartH;

        const points = data
          .map((_, i) => `${xOf(i)},${yOf(values[i] ?? 0)}`)
          .join(' ');

        const color = colors[seriesIndex] ?? '#64748b';

        return (
          <g key={key}>
            {points && (
              <polyline
                points={points}
                fill="none"
                style={{ stroke: color }}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {data.map((_, i) => (
              <circle
                key={i}
                cx={xOf(i)}
                cy={yOf(values[i] ?? 0)}
                r="3.5"
                fill={isDark ? '#1e293b' : '#fff'}
                style={{ stroke: color }}
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })}

      {data.map((item, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - 4}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="11"
          fontFamily="Figtree, sans-serif"
        >
          {String(item.day ?? '')}
        </text>
      ))}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function exportAnalyticsCsv(
  data: AnalyticsData,
  range: AnalyticsRange,
): void {
  downloadCsv(
    data.weekly.map((weeklyPoint) => ({
      Day: weeklyPoint.day,
      Signups: weeklyPoint.signups,
      Activities: weeklyPoint.activities,
      Reports: weeklyPoint.reports,
      Range: range,
    })),
    `matchup-analytics-${range}.csv`,
  );
}

export function AnalyticsPage() {
  const { loading, error, data, range, setRange, reload } = useAnalytics();

  if (loading) return <AnalyticsPageSkeleton />;
  if (error) return <PageError message={error} onRetry={reload} />;
  if (!data) return null;

  const rangeOptions: { value: AnalyticsRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
  ];

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">
            Analytics
          </h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Platform performance metrics, growth trends, and user engagement
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as AnalyticsRange)
            }
            className="input w-auto rounded-lg py-1.5 text-sm"
            aria-label="Analytics date range"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => exportAnalyticsCsv(data, range)}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm"
          >
            Export
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="card py-4">
            <p className="text-xs font-medium text-ink-500">{kpi.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-ink-900">
              {kpi.value}
            </p>
            <span className="mt-1 text-xs font-semibold text-brand-400">
              {kpi.change}
            </span>
            <span className="text-xs text-ink-400"> vs last week</span>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Weekly line chart */}
        <div className="panel p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Weekly Engagement
              </h2>
              <p className="text-xs text-ink-600">
                Signups and activities by day
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Signups', color: 'var(--brand-graphic)' },
                { label: 'Activities', color: '#ff6b00' },
                { label: 'Reports', color: '#ef4444' },
              ].map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-1.5 text-xs text-ink-600"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <LineChart
            data={data.weekly.map((point) => ({
              day: point.day,
              signups: point.signups,
              activities: point.activities,
              reports: point.reports,
            }))}
            keys={['signups', 'activities', 'reports']}
            colors={['var(--brand-graphic)', '#ff6b00', '#ef4444']}
          />
        </div>

        {/* Top sports */}
        <div className="panel p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">
            Top Sports
          </h2>

          {data.topSports.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No sports data yet
            </p>
          ) : (
            <div className="space-y-3">
              {data.topSports.map((sport, index) => (
                <div key={sport.sport}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-ink-400">{index + 1}.</span>
                      <span className="font-semibold text-ink-800">
                        {sport.sport}
                      </span>
                    </span>
                    <span className="text-ink-500">
                      {sport.activities} activities
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-400"
                      style={{
                        width: `${Math.min(Math.max(sport.pct, 0), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Retention */}
        <div className="panel p-5">
          <h2 className="mb-1 text-base font-semibold text-ink-900">
            User Retention
          </h2>
          <p className="mb-4 text-xs text-ink-600">
            % of new users still active
          </p>

          {data.retention.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No data yet — events not collected
            </p>
          ) : (
            <div className="flex h-28 items-end justify-between gap-1.5">
              {data.retention.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-semibold text-ink-600">
                    {item.value}%
                  </span>
                  <div
                    className="w-full rounded-t-md bg-brand-400"
                    style={{
                      height: `${Math.min(Math.max(item.value, 0), 100)}%`,
                    }}
                  />
                  <span className="text-center text-[9px] leading-tight text-ink-400">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform health */}
        <div className="panel p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">
            Platform Health
          </h2>

          {data.health.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No data yet — events not collected
            </p>
          ) : (
            <div className="space-y-3">
              {data.health.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-ink-700">
                      {item.label}
                    </span>
                    <span className="font-bold text-ink-900">
                      {item.value}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(Math.max(item.value, 0), 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
