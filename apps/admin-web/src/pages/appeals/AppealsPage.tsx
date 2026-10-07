import { useState, useEffect } from 'react';
import { useAppeals } from '../../hooks/useAppeals';
import { useToast } from '../../context/ToastContext';
import { PageSkeleton, PageError, EmptyState, EmptyIcons } from '../../components/ui/PageStates';
import { Avatar } from '../../components/ui/Avatar';
import type { Appeal, AppealStatus, AppealType } from '../../types/appeals';

// Status badge.

function StatusBadge({ status }: { status: AppealStatus }) {
  const map: Record<AppealStatus, string> = {
    Pending: 'badge-yellow',
    Approved: 'badge-green',
    Rejected: 'badge-red',
  };
  return <span className={map[status]}>{status}</span>;
}

// Type badge.

function TypeBadge({ type }: { type: AppealType }) {
  const map: Record<AppealType, string> = {
    Suspension: 'badge-red',
    'Activity Removal': 'badge-yellow',
    'Account Ban': 'badge-red',
    'Content Removal': 'badge-neutral',
  };
  return <span className={map[type]}>{type}</span>;
}

// Review modal.

function ReviewModal({
  appeal,
  onConfirm,
  onCancel,
}: {
  appeal: Appeal;
  onConfirm: (decision: 'approve' | 'reject', response: string) => void;
  onCancel: () => void;
}) {
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!response.trim()) {
      setError('A response to the user is required.');
      return;
    }
    onConfirm(decision, response.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-ink-800 p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">Review Appeal</h2>
          <button
            onClick={onCancel}
            className="text-ink-400 hover:text-ink-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* User + appeal summary */}
        <div className="mb-5 rounded-xl bg-ink-50 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={appeal.userName}
              photoUrl={appeal.userPhotoUrl}
              seed={appeal.userAvatarSeed}
              className="h-8 w-8 rounded-full"
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">{appeal.userName}</p>
              <p className="text-xs text-ink-500">{appeal.userEmail}</p>
            </div>
            <div className="ml-auto">
              <TypeBadge type={appeal.type} />
            </div>
          </div>
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide pt-1">
            Original action
          </p>
          <p className="text-sm text-ink-700">{appeal.originalAction}</p>
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide pt-1">
            User's statement
          </p>
          <p className="text-sm text-ink-700 italic">"{appeal.statement}"</p>
        </div>

        {/* Decision */}
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-ink-600">Decision</p>
          <div className="flex gap-2">
            {(['approve', 'reject'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDecision(d)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors border ${
                  decision === d
                    ? d === 'approve'
                      ? 'bg-success-500 text-white border-success-500'
                      : 'bg-danger-500 text-white border-danger-500'
                    : 'bg-white dark:bg-ink-700 text-ink-600 border-ink-200 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-600'
                }`}
              >
                {d === 'approve' ? '✓ Approve' : '✕ Reject'}
              </button>
            ))}
          </div>
        </div>

        {/* Response to user */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-ink-600">
            Response to user <span className="text-danger-500">*</span>
          </label>
          <textarea
            className="input min-h-[96px] resize-none text-sm"
            placeholder={
              decision === 'approve'
                ? 'Explain what action was reversed and any conditions…'
                : 'Explain the reasoning for rejection and any next steps…'
            }
            value={response}
            onChange={(e) => {
              setResponse(e.target.value);
              setError('');
            }}
            maxLength={500}
          />
          <div className="flex justify-between mt-0.5">
            {error ? <p className="text-xs text-danger-500">{error}</p> : <span />}
            <p className="text-[10px] text-ink-400">{response.length}/500</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${
              decision === 'approve'
                ? 'bg-success-500 hover:bg-success-600'
                : 'bg-danger-500 hover:bg-danger-600'
            }`}
          >
            {decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </button>
          <button onClick={onCancel} className="btn-outline rounded-xl px-5 py-2.5 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Appeal card.

function AppealCard({ appeal, onReview }: { appeal: Appeal; onReview: () => void }) {
  const isPending = appeal.status === 'Pending';

  return (
    <div
      className={`rounded-xl border px-4 py-4 space-y-3 transition-colors ${
        isPending
          ? 'border-ink-200 bg-white dark:border-ink-600 dark:bg-ink-800'
          : 'border-ink-100 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/50'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            name={appeal.userName}
            photoUrl={appeal.userPhotoUrl}
            seed={appeal.userAvatarSeed}
            className="h-8 w-8 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">{appeal.userName}</p>
            <p className="text-xs text-ink-400 truncate">{appeal.userEmail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TypeBadge type={appeal.type} />
          <StatusBadge status={appeal.status} />
        </div>
      </div>

      {/* Original action */}
      <div className="rounded-lg bg-ink-100 dark:bg-ink-700/50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 mb-0.5">
          Admin action appealed
        </p>
        <p className="text-xs text-ink-700 dark:text-ink-300">{appeal.originalAction}</p>
      </div>

      {/* User statement */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 mb-1">
          User's statement
        </p>
        <p className="text-sm text-ink-600 dark:text-ink-400 line-clamp-3 italic">
          "{appeal.statement}"
        </p>
      </div>

      {/* Admin response (resolved) */}
      {appeal.adminResponse && (
        <div className="rounded-lg border border-brand-100 dark:border-brand-900/40 bg-brand-50 dark:bg-brand-900/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400 mb-0.5">
            Admin response
          </p>
          <p className="text-xs text-brand-700 dark:text-brand-300">{appeal.adminResponse}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <p className="text-xs text-ink-400">
          Submitted{' '}
          {new Date(appeal.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          {appeal.resolvedAt && (
            <>
              {' '}
              · Resolved{' '}
              {new Date(appeal.resolvedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </>
          )}
        </p>
        {isPending && (
          <button onClick={onReview} className="btn-primary btn-sm">
            Review
          </button>
        )}
      </div>
    </div>
  );
}

// Page.

const STATUS_TABS: Array<AppealStatus | 'All'> = ['All', 'Pending', 'Approved', 'Rejected'];
const TYPE_OPTIONS: Array<AppealType | 'All'> = [
  'All',
  'Suspension',
  'Activity Removal',
  'Account Ban',
  'Content Removal',
];

export function AppealsPage() {
  const { loading, error, appeals, handleDecision, reload } = useAppeals();
  const { push: toast } = useToast();
  const [activeTab, setActiveTab] = useState<AppealStatus | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<AppealType | 'All'>('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Appeal | null>(null);

  // Keyboard shortcut: A = open first pending
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;
      if ((e.key === 'a' || e.key === 'A') && !modal) {
        const first = appeals.find((a) => a.status === 'Pending');
        if (first) setModal(first);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appeals, modal]);

  if (loading) return <PageSkeleton rows={3} />;
  if (error) return <PageError message={error} onRetry={reload} />;

  async function handleConfirm(decision: 'approve' | 'reject', response: string) {
    if (!modal) return;
    const userName = modal.userName;
    try {
      await handleDecision(modal.id, decision, response);
      toast(
        `Appeal ${decision === 'approve' ? 'approved' : 'rejected'} — response sent to ${userName}.`,
        decision === 'approve' ? 'success' : 'info',
      );
      setModal(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Decision failed.', 'error');
    }
  }

  const filtered = appeals.filter((a) => {
    const matchTab = activeTab === 'All' || a.status === activeTab;
    const matchType = typeFilter === 'All' || a.type === typeFilter;
    const matchSearch =
      a.userName.toLowerCase().includes(search.toLowerCase()) ||
      a.originalAction.toLowerCase().includes(search.toLowerCase()) ||
      a.statement.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchType && matchSearch;
  });

  const pendingCount = appeals.filter((a) => a.status === 'Pending').length;

  const stats = [
    { label: 'Total Appeals', value: appeals.length, color: 'text-ink-900' },
    { label: 'Pending', value: pendingCount, color: 'text-warning-600' },
    {
      label: 'Approved',
      value: appeals.filter((a) => a.status === 'Approved').length,
      color: 'text-success-600',
    },
    {
      label: 'Rejected',
      value: appeals.filter((a) => a.status === 'Rejected').length,
      color: 'text-danger-500',
    },
  ];

  return (
    <div className="page-container space-y-5">
      {modal && (
        <ReviewModal appeal={modal} onConfirm={handleConfirm} onCancel={() => setModal(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Appeals</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Review and respond to user appeals for suspensions, removals, and bans
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="badge-yellow">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning-700" />
              {pendingCount} awaiting review
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="panel overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-ink-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-brand-500 text-white'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300 dark:hover:bg-ink-600'
                }`}
              >
                {tab}
                {tab === 'Pending' && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-warning-500 px-1.5 text-[10px] text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-ink-50 dark:bg-ink-700/50 px-3 py-1.5 w-full sm:w-auto">
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
              placeholder="Search user, action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ink-700 dark:text-ink-300 placeholder:text-ink-400 focus:outline-none sm:w-44"
            />
          </div>
        </div>

        {/* Type filter row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-900/20 px-4 sm:px-6 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Type:
          </span>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-500 hover:bg-ink-200 dark:hover:bg-ink-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Keyboard hint */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 border-b border-ink-100 dark:border-ink-700 px-4 sm:px-6 py-2 text-xs text-ink-400">
            <span>Shortcut:</span>
            <kbd className="rounded bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 font-mono">A</kbd>
            <span>Open first pending appeal</span>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={EmptyIcons.search}
            title={activeTab === 'Pending' ? 'No pending appeals.' : 'No appeals found.'}
            description={search ? 'Try adjusting your search.' : undefined}
          />
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-ink-700">
            {filtered.map((a) => (
              <div key={a.id} className="px-4 sm:px-6 py-4">
                <AppealCard appeal={a} onReview={() => setModal(a)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
