import { useState, useEffect } from 'react';
import { useReports } from '../../hooks/useReports';
import {
  ReportsPageSkeleton,
  PageError,
  EmptyState,
  EmptyIcons,
} from '../../components/ui/PageStates';
import { downloadCsv } from '../../utils/csvExport';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar } from '../../components/ui/Avatar';
import type { Report, ReportStatus } from '../../types/reports';
import type { ReportAction } from '../../services/reportsService';

// Status badge.

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, string> = {
    Pending: 'badge-red',
    Resolved: 'badge-green',
    Dismissed: 'badge-neutral',
  };
  return <span className={map[status]}>{status}</span>;
}

// Action modal — note confirm.

const RESOLVE_REASONS = [
  'User warned',
  'Activity removed',
  'User suspended',
  'Content edited by host',
  'Other',
];
const DISMISS_REASONS = [
  'Insufficient evidence',
  'False report',
  'Already resolved between parties',
  'Outside platform policy',
  'Other',
];

function ActionModal({
  report,
  action,
  onConfirm,
  onCancel,
}: {
  report: Report;
  action: ReportAction;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const isResolve = action === 'resolve';
  const reasons = isResolve ? RESOLVE_REASONS : DISMISS_REASONS;
  const [selectedReason, setSelectedReason] = useState(reasons[0]);
  const [extra, setExtra] = useState('');

  function handleConfirm() {
    const note = extra.trim() ? `${selectedReason} — ${extra.trim()}` : selectedReason;
    onConfirm(note);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">
            {isResolve ? 'Resolve Report' : 'Dismiss Report'}
          </h2>
          <button
            onClick={onCancel}
            className="text-ink-400 hover:text-ink-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Report summary */}
        <div className="mb-4 rounded-xl bg-ink-50 px-4 py-3 text-sm">
          <p className="text-ink-600">
            <span className="font-semibold text-ink-900">{report.reporter}</span>
            {' reported '}
            <span className="font-semibold text-ink-900">{report.target}</span>
            <span className="ml-1 rounded bg-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
              {report.targetType}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-500">"{report.reason}"</p>
        </div>

        {/* Reason */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-600">
              {isResolve ? 'Action taken' : 'Reason for dismissal'}
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-ink-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selectedReason === r ? 'border-brand-500 bg-brand-500' : 'border-ink-300'}`}
                  >
                    {selectedReason === r && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <input
                    type="radio"
                    className="sr-only"
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                  />
                  <span className="text-sm text-ink-700">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional extra note */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-600">
              Additional note <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <textarea
              className="input min-h-[72px] resize-none text-sm"
              placeholder="Add context for the record…"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${isResolve ? 'bg-brand-500 hover:bg-brand-600' : 'bg-ink-600 hover:bg-ink-700'}`}
            >
              {isResolve ? 'Confirm — Resolved' : 'Confirm — Dismiss'}
            </button>
            <button onClick={onCancel} className="btn-outline rounded-xl px-4 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Report card.

function ReportCard({
  report,
  onAction,
}: {
  report: Report;
  onAction: (action: ReportAction) => void;
}) {
  const isPending = report.status === 'Pending';

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 space-y-2 ${isPending ? 'border-ink-200 bg-white' : 'border-ink-100 bg-ink-50'}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Avatar
            name={report.reporter}
            photoUrl={report.reporterPhotoUrl}
            seed={report.reporterAvatarSeed}
            className="h-6 w-6 rounded-full"
          />
          <p className="text-[13px]">
            <span className="font-semibold text-ink-900">{report.reporter}</span>
            <span className="text-ink-400"> reported </span>
            <span className="font-semibold text-ink-900">{report.target}</span>
            <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
              {report.targetType}
            </span>
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* Reason + category */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
          {report.category}
        </span>
        <p className="text-[13px] text-ink-600">"{report.reason}"</p>
      </div>

      {/* Activity + date */}
      <p className="text-xs text-ink-400">
        {report.activityTitle} ({report.sport}) ·{' '}
        {new Date(report.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      {/* Admin note (for resolved/dismissed) */}
      {report.adminNote && (
        <div className="flex items-start gap-1.5 rounded-lg bg-ink-100 px-3 py-2">
          <svg
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <rect x="2" y="1" width="10" height="12" rx="1.5" />
            <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" />
          </svg>
          <p className="text-xs text-ink-600">
            <span className="font-semibold">Admin note:</span> {report.adminNote}
          </p>
        </div>
      )}

      {/* Actions — only for pending */}
      {isPending && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => onAction('resolve')} className="btn-primary btn-sm">
            Resolve
          </button>
          <button
            onClick={() => onAction('dismiss')}
            className="inline-flex items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// Page.

export function ReportsPage() {
  const { loading, error, reports, reload, handleAction } = useReports();
  const { push: toast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [sortNewest, setSortNewest] = useState(true);
  const [modal, setModal] = useState<{ report: Report; action: ReportAction } | null>(null);
  // Bulk action state (Task 11)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<ReportAction | null>(null);

  // Keyboard shortcuts: R = resolve first pending, D = dismiss first pending.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;
      const firstPending = reports.find((r) => r.status === 'Pending');
      if (!firstPending) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setModal({ report: firstPending, action: 'resolve' });
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setModal({ report: firstPending, action: 'dismiss' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reports]);

  if (loading) return <ReportsPageSkeleton />;
  if (error) return <PageError message={error} onRetry={reload} />;

  async function handleConfirm(note: string) {
    if (!modal) return;
    const { report, action } = modal;
    try {
      await handleAction(report.id, action, note);
      toast(
        action === 'resolve' ? 'Report resolved.' : 'Report dismissed.',
        action === 'resolve' ? 'success' : 'info',
      );
      setModal(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update report.', 'error');
    }
  }

  // Bulk actions
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }
  function toggleSelectAll() {
    const pendingIds = filtered.filter((r) => r.status === 'Pending').map((r) => r.id);
    setSelectedIds((prev) => (prev.size === pendingIds.length ? new Set() : new Set(pendingIds)));
  }
  async function executeBulkAction(action: ReportAction) {
    const ids = [...selectedIds];
    let succeeded = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await handleAction(id, action, 'Bulk action');
        succeeded += 1;
      } catch (err) {
        failed.push(id);
        toast(err instanceof Error ? err.message : `Failed to ${action} report.`, 'error');
      }
    }
    if (succeeded > 0) {
      toast(
        `${succeeded} report(s) ${action === 'resolve' ? 'resolved' : 'dismissed'}.`,
        action === 'resolve' ? 'success' : 'info',
      );
    }
    // Keep failed ids selected so they can be retried; clear the rest.
    setSelectedIds(new Set(failed));
    setBulkConfirm(null);
  }

  function handleExport() {
    downloadCsv(
      reports.map((r) => ({
        ID: r.id,
        Reporter: r.reporter,
        Target: r.target,
        Type: r.targetType,
        Category: r.category,
        Reason: r.reason,
        Activity: r.activityTitle,
        Status: r.status,
        AdminNote: r.adminNote ?? '',
        Date: r.createdAt,
      })),
      'matchup-reports.csv',
    );
    toast('Report log exported as CSV.', 'info');
  }

  const TABS: Array<ReportStatus | 'All'> = ['All', 'Pending', 'Resolved', 'Dismissed'];

  const filtered = reports
    .filter((r) => {
      const matchTab = activeTab === 'All' || r.status === activeTab;
      const matchSearch =
        r.reporter.toLowerCase().includes(search.toLowerCase()) ||
        r.target.toLowerCase().includes(search.toLowerCase()) ||
        r.reason.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    })
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortNewest ? diff : -diff;
    });

  const pendingCount = reports.filter((r) => r.status === 'Pending').length;

  return (
    <div className="page-container space-y-5">
      {modal && (
        <ActionModal
          report={modal.report}
          action={modal.action}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!bulkConfirm}
        title={
          bulkConfirm === 'resolve'
            ? `Resolve ${selectedIds.size} report(s)?`
            : `Dismiss ${selectedIds.size} report(s)?`
        }
        description="This will apply to every selected report and cannot be undone."
        confirmLabel={bulkConfirm === 'resolve' ? 'Resolve all' : 'Dismiss all'}
        destructive={bulkConfirm === 'dismiss'}
        onConfirm={() => {
          if (bulkConfirm) void executeBulkAction(bulkConfirm);
        }}
        onCancel={() => setBulkConfirm(null)}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Reports & Moderation</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Review flagged content and take moderation action
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={handleExport} className="btn-outline rounded-lg px-3 py-1.5 text-sm">
            Export Log
          </button>
          <button
            onClick={() => window.print()}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm"
            title="Print / Save as PDF"
          >
            Print
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Pending',
            value: reports.filter((r) => r.status === 'Pending').length,
            color: 'text-danger-500',
          },
          {
            label: 'Resolved',
            value: reports.filter((r) => r.status === 'Resolved').length,
            color: 'text-brand-500',
          },
          {
            label: 'Dismissed',
            value: reports.filter((r) => r.status === 'Dismissed').length,
            color: 'text-ink-600',
          },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* Queue */}
        <div className="panel overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-ink-200 dark:border-ink-700 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
                Moderation Queue
              </h2>
              {pendingCount > 0 && (
                <>
                  <span className="badge-red">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger-700" />
                    {pendingCount} pending
                  </span>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size ===
                          filtered.filter((r) => r.status === 'Pending').length &&
                        filtered.filter((r) => r.status === 'Pending').length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                    <span className="text-xs text-ink-400">All pending</span>
                  </label>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === tab ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-3 border-b border-ink-200 px-4 py-3 sm:px-6">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5">
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
                placeholder="Search reporter, target, reason…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-[13px] text-ink-700 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setSortNewest((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition-colors"
              title={sortNewest ? 'Showing newest first' : 'Showing oldest first'}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={sortNewest ? 'M6 2v8M3 7l3 3 3-3' : 'M6 10V2M3 5l3-3 3 3'} />
              </svg>
              {sortNewest ? 'Newest' : 'Oldest'}
            </button>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 border-b border-ink-100 dark:border-ink-700 bg-brand-50 dark:bg-brand-900/20 px-4 sm:px-6 py-2.5">
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setBulkConfirm('resolve')}
                className="text-xs font-semibold text-success-600 hover:underline"
              >
                Resolve all
              </button>
              <button
                onClick={() => setBulkConfirm('dismiss')}
                className="text-xs font-semibold text-ink-500 dark:text-ink-400 hover:underline"
              >
                Dismiss all
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-ink-400 hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Keyboard hint */}
          {reports.some((r) => r.status === 'Pending') && selectedIds.size === 0 && (
            <div className="flex items-center gap-2 border-b border-ink-100 dark:border-ink-700 px-4 sm:px-6 py-2 text-xs text-ink-400">
              <span>Shortcuts:</span>
              <kbd className="rounded bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 font-mono">R</kbd>
              <span>Resolve</span>
              <kbd className="rounded bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 font-mono">D</kbd>
              <span>Dismiss (first pending)</span>
            </div>
          )}

          {/* List */}
          <div className="divide-y divide-ink-200 dark:divide-ink-700">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-400">
                {activeTab === 'Pending' ? (
                  <EmptyState
                    icon={EmptyIcons.reports}
                    title="No pending reports"
                    description="All reports have been handled."
                  />
                ) : (
                  <EmptyState
                    icon={EmptyIcons.search}
                    title="No reports found."
                    description="Try adjusting your search or filter."
                  />
                )}
              </p>
            ) : (
              filtered.map((r) => (
                <div key={r.id} className="px-4 py-3 sm:px-6">
                  {r.status === 'Pending' ? (
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="mt-0.5 rounded cursor-pointer"
                      />
                      <div className="flex-1">
                        <ReportCard
                          report={r}
                          onAction={(action) => setModal({ report: r, action })}
                        />
                      </div>
                    </label>
                  ) : (
                    <ReportCard report={r} onAction={(action) => setModal({ report: r, action })} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar: category breakdown */}
        <div className="panel p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">By Category</h2>
          <div className="space-y-3">
            {(
              [
                'Harassment',
                'Policy Breach',
                'Fraud',
                'Spam',
                'Inappropriate Content',
                'Other',
              ] as const
            ).map((cat) => {
              const total = reports.length;
              const count = reports.filter((r) => r.category === cat).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-700">{cat}</span>
                    <span className="text-ink-400">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                    <div
                      className="h-full rounded-full bg-brand-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resolution rate */}
          <div className="mt-6 rounded-xl bg-ink-50 p-4">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
              Resolution rate
            </p>
            {(() => {
              const done = reports.filter((r) => r.status !== 'Pending').length;
              const pct = reports.length ? Math.round((done / reports.length) * 100) : 0;
              return (
                <>
                  <p className="text-2xl font-bold text-ink-900">{pct}%</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {done} of {reports.length} reports handled
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
