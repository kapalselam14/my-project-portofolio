import { useState } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { downloadCsv } from '../../utils/csvExport';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../../components/ui/Avatar';
import type { KpiData, ModerationItem, ActivityRow, TrendPoint } from '../../types/dashboard';

function exportCsv(activities: ActivityRow[]) {
  downloadCsv(
    activities.map((a) => ({
      Name: a.name,
      ID: a.matchId,
      Sport: a.sport,
      Host: a.host,
      Participants: a.participants,
      Capacity: a.capacity,
      Status: a.status,
      Date: a.scheduledDate,
    })),
    'matchup-activities.csv',
  );
}

// Loading skeleton.

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-200 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="page-container space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

// Icons.

function IconUsers() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="5.5" r="3" />
      <path d="M1 16c0-3.314 2.686-5 6-5s6 1.686 6 5" />
      <path d="M12 3a3 3 0 010 5" />
      <path d="M17 16c0-2.5-1.5-4-3-4.5" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3" width="16" height="14" rx="2" />
      <path d="M1 7h16" />
      <path d="M5 1v4M13 1v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1a5 5 0 015 5c0 5 2 6 2 6H2s2-1 2-6a5 5 0 015-5z" />
      <path d="M7.27 15.5a2 2 0 003.46 0" />
    </svg>
  );
}
function IconAirplay() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 14H2a1 1 0 01-1-1V3a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1h-3" />
      <path d="M9 10l-4 7h8l-4-7z" />
    </svg>
  );
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  'Total Users': <IconUsers />,
  'Active Activities': <IconCalendar />,
  'Pending Reports': <IconBell />,
  'New Users (7d)': <IconAirplay />,
};

// KPI Card.

function KpiCard({ kpi }: { kpi: KpiData }) {
  // Empty spark data renders a flat bar instead of dividing by zero.
  const maxBar = kpi.sparkBars.length > 0 ? Math.max(...kpi.sparkBars) : 0;
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-ink-600 leading-snug pr-2">{kpi.title}</span>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-100 text-brand-500">
          {KPI_ICONS[kpi.title] ?? <IconUsers />}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none text-ink-900 sm:text-3xl">{kpi.value}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-xs font-semibold ${kpi.dir === 'up' ? 'text-brand-400' : 'text-danger-500'}`}
            >
              {kpi.change}
            </span>
            <span className="text-xs text-ink-400">vs last week</span>
          </div>
        </div>
        {/* Sparkline */}
        <div className="flex h-8 shrink-0 items-end gap-[2px]">
          {kpi.sparkBars.map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-sm"
              style={{
                height: `${maxBar > 0 ? Math.round((h / maxBar) * 32) : 2}px`,
                backgroundColor: kpi.sparkColor,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Trend chart (responsive SVG).

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  if (!trend.length) return null;

  const maxVal = Math.max(1, ...trend.flatMap((t) => [t.activities, t.signups]));
  const H = 180;
  const pad = { top: 10, bottom: 24, left: 4, right: 4 };
  const chartH = H - pad.top - pad.bottom;
  const n = trend.length;

  // Compute X positions as percentages (use viewBox-relative coords)
  const W = 600;
  const xOf = (i: number) => pad.left + (i / (n - 1)) * (W - pad.left - pad.right);
  const yOf = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

  const actPts = trend.map((t, i) => `${xOf(i)},${yOf(t.activities)}`).join(' ');
  const barW = Math.max(4, Math.floor((W - pad.left - pad.right) / n) - 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="none"
      aria-label="Activity & Signups Trend"
    >
      {/* Grid lines */}
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

      {/* Signup bars (sky) */}
      {trend.map((pt, i) => {
        const bh = (pt.signups / maxVal) * chartH;
        const x = xOf(i) - barW / 2;
        return (
          <rect
            key={i}
            x={x}
            y={pad.top + chartH - bh}
            width={barW}
            height={bh}
            fill="#ff6b00"
            opacity="0.75"
            rx="2"
          />
        );
      })}

      {/* Activities polyline (navy) */}
      <polyline
        points={actPts}
        fill="none"
        style={{ stroke: 'var(--brand-graphic)' }}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {trend.map((pt, i) => (
        <circle
          key={i}
          cx={xOf(i)}
          cy={yOf(pt.activities)}
          r="4"
          fill={isDark ? '#1e293b' : '#fff'}
          style={{ stroke: 'var(--brand-graphic)' }}
          strokeWidth="2"
        />
      ))}

      {/* X labels */}
      {trend.map((pt, i) => (
        <text
          key={pt.day}
          x={xOf(i)}
          y={H - 4}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="11"
          fontFamily="Figtree, sans-serif"
        >
          {pt.day}
        </text>
      ))}
    </svg>
  );
}

// Moderation card.

function ModCard({
  item,
  onAction,
}: {
  item: ModerationItem;
  onAction: (action: 'resolve' | 'dismiss', note?: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'resolve' | 'dismiss' | null>(null);
  const [note, setNote] = useState('');

  function request(action: 'resolve' | 'dismiss') {
    // Collect a moderator note/reason before resolve/dismiss and forward it to moderationAction (POST.
    setPendingAction(action);
    setNote('');
    setNoteOpen(true);
  }

  function confirm() {
    if (!pendingAction) return;
    onAction(pendingAction, note.trim() ? note.trim() : undefined);
    setNoteOpen(false);
    setPendingAction(null);
    setNote('');
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px]">
          <span className="font-semibold text-ink-900">{item.reporter}</span>{' '}
          <span className="text-ink-400">reported</span>{' '}
          <span className="font-semibold text-ink-900">{item.target}</span>
          <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
            {item.targetType}
          </span>
        </p>
      </div>
      <p className="text-[13px] text-ink-600">"{item.reason}"</p>
      <p className="text-xs text-ink-400">
        {item.activityTitle} ({item.sport})
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => request('resolve')} className="btn-primary btn-sm">
          Resolve
        </button>
        <button
          onClick={() => request('dismiss')}
          className="inline-flex items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition-colors"
        >
          Dismiss
        </button>
      </div>
      {noteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-panel">
            <h3 className="text-sm font-semibold text-ink-900">
              {pendingAction === 'resolve' ? 'Resolve report' : 'Dismiss report'} — add a note
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Optional reason recorded with the moderation action.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason / note (optional)…"
              className="input mt-3 min-h-[80px] resize-none text-sm"
              maxLength={500}
            />
            <div className="mt-3 flex gap-2">
              <button onClick={confirm} className="btn-primary flex-1 rounded-xl py-2 text-sm">
                {pendingAction === 'resolve' ? 'Resolve' : 'Dismiss'}
              </button>
              <button
                onClick={() => {
                  setNoteOpen(false);
                  setPendingAction(null);
                }}
                className="btn-outline rounded-xl px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Status badge.

function StatusBadge({ status }: { status: ActivityRow['status'] }) {
  const styles: Record<ActivityRow['status'], { cls: string; dot: string }> = {
    Active: { cls: 'badge-blue', dot: 'bg-brand-700' },
    Full: { cls: 'badge-yellow', dot: 'bg-warning-700' },
    Completed: { cls: 'badge-neutral', dot: 'bg-ink-500' },
    Flagged: { cls: 'badge-red', dot: 'bg-danger-700' },
  };
  const { cls, dot } = styles[status];
  return (
    <span className={cls}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// ─── Activities table — responsive (card on mobile, table on md+) ─────────────

function ActivitiesTable({
  rows,
  search,
  onSearch,
}: {
  rows: ActivityRow[];
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-ink-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Active Sports Matches</h2>
          <p className="mt-0.5 text-xs text-ink-600">Moderator oversight list</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5 w-full sm:w-auto">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="6" cy="6" r="4" />
            <path d="M11 11l-2.5-2.5" />
          </svg>
          <input
            type="text"
            placeholder="Filter events..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-ink-700 placeholder:text-ink-400 focus:outline-none sm:w-36"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50">
              <th className="tbl-th w-[30%]">Activity Details</th>
              <th className="tbl-th w-[10%]">Sport</th>
              <th className="tbl-th w-[15%]">Host</th>
              <th className="tbl-th w-[18%]">Capacity</th>
              <th className="tbl-th w-[12%]">Status</th>
              <th className="tbl-th w-[15%]">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200">
            {rows.map((row, i) => (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-ink-50'}>
                <td className="tbl-td">
                  <p className="font-semibold text-ink-900 leading-snug">{row.name}</p>
                  <p className="mt-0.5 text-xs text-ink-400">ID: {row.matchId}</p>
                </td>
                <td className="tbl-td">
                  <span className="inline-flex items-center rounded-md bg-ink-100 px-2 py-1 text-xs font-semibold text-ink-600">
                    {row.sport}
                  </span>
                </td>
                <td className="tbl-td">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={row.host}
                      photoUrl={row.photoUrl}
                      seed={row.hostAvatarSeed}
                      className="h-6 w-6 shrink-0 rounded-full"
                    />
                    <span className="text-[13px] font-medium text-ink-700 truncate">
                      {row.host}
                    </span>
                  </div>
                </td>
                <td className="tbl-td">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-700">
                      {row.participants}/{row.capacity}
                    </span>
                    <span className="text-ink-400">
                      {row.participants >= row.capacity ? 'Full' : 'Joining'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((row.participants / row.capacity) * 100, 100)}%`,
                        backgroundColor: row.participants >= row.capacity ? '#f59e0b' : 'var(--brand-graphic)',
                      }}
                    />
                  </div>
                </td>
                <td className="tbl-td">
                  <StatusBadge status={row.status} />
                </td>
                <td className="tbl-td text-[13px] text-ink-700">{row.scheduledDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y divide-ink-200 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink-900">{row.name}</p>
                <p className="text-xs text-ink-400">
                  {row.matchId} · {row.sport}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-ink-600">
              <span className="flex items-center gap-1.5">
                <Avatar
                  name={row.host}
                  photoUrl={row.photoUrl}
                  seed={row.hostAvatarSeed}
                  className="h-5 w-5 rounded-full"
                />
                {row.host}
              </span>
              <span>{row.scheduledDate}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">
                {row.participants}/{row.capacity}
              </span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((row.participants / row.capacity) * 100, 100)}%`,
                    backgroundColor: row.participants >= row.capacity ? '#f59e0b' : 'var(--brand-graphic)',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-400">No activities match your search.</p>
      )}
    </div>
  );
}

// Dashboard page.

export function DashboardPage() {
  const { loading, error, data, reload, handleModAction } = useDashboard();
  const [search, setSearch] = useState('');

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-sm text-danger-500">Failed to load dashboard: {error}</p>
        <button onClick={reload} className="btn-primary px-4 py-2 text-sm rounded-xl">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const filteredActivities = data.activities.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sport.toLowerCase().includes(search.toLowerCase()) ||
      r.host.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-container space-y-5">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Dashboard Overview</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Real-time monitoring of sports communities, matching metrics, and report status
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => exportCsv(data.activities)}
            className="btn-primary flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M7 1v8M4 6l3 3 3-3" />
              <path d="M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
            </svg>
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k) => (
          <KpiCard key={k.title} kpi={k} />
        ))}
      </div>

      {/* ── Middle: trend chart + moderation queue ──────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* Chart panel */}
        <div className="panel p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Activity & Signups Trend</h2>
              <p className="mt-0.5 text-xs text-ink-600">Daily platform engagement metrics</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                Created Activities
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <span className="inline-block h-2 w-2 rounded-full bg-[#ff6b00]" />
                New User Signups
              </span>
            </div>
          </div>
          <TrendChart trend={data.trend} />
        </div>

        {/* Moderation panel */}
        <div className="panel p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Pending Moderation Queue</h2>
              <p className="mt-0.5 text-xs text-ink-600">Flagged posts and policy violations</p>
            </div>
            {data.moderationQueue.length > 0 && (
              <span className="badge-red shrink-0">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger-700" />
                {data.moderationQueue.length} New
              </span>
            )}
          </div>
          <div className="space-y-3">
            {data.moderationQueue.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">No pending reports 🎉</p>
            ) : (
              data.moderationQueue.map((item) => (
                <ModCard
                  key={item.id}
                  item={item}
                  onAction={(action, note) => handleModAction(item.id, action, note)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Activities table ─────────────────────────────────────── */}
      <ActivitiesTable rows={filteredActivities} search={search} onSearch={setSearch} />
    </div>
  );
}
