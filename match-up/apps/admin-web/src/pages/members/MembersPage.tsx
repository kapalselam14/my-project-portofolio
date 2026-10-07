import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMembers } from '../../hooks/useMembers';
import { fetchMembersSummary, type MembersSummary } from '../../services/membersService';
import {
  MembersPageSkeleton,
  PageError,
  EmptyState,
  EmptyIcons,
} from '../../components/ui/PageStates';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { downloadCsv } from '../../utils/csvExport';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/ui/Avatar';
import type { MemberStatus } from '../../types/members';

const STATUS_TABS = ['All', 'Active', 'Suspended'];
const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: MemberStatus }) {
  const cls: Record<MemberStatus, string> = { Active: 'badge-blue', Suspended: 'badge-red' };
  const dot: Record<MemberStatus, string> = { Active: 'bg-brand-700', Suspended: 'bg-danger-700' };
  return (
    <span className={cls[status]}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {status}
    </span>
  );
}

function StarRating({ value }: { value: number }) {
  // Use a warmer color for higher ratings while preserving the numeric score.
  const color =
    value >= 4.5 ? 'text-warning-500' : value >= 3.5 ? 'text-warning-600' : 'text-ink-400';
  return <span className={`text-sm font-semibold ${color}`}>★ {value.toFixed(1)}</span>;
}

export function MembersPage() {
  const { loading, error, members, reload, handleStatusChange, handleDelete } = useMembers();
  const { push: toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{
    type: 'suspend' | 'remove';
    id: string;
    name: string;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Collection-wide totals for the header cards (the full list is loaded; the table paginates client-side).
  const [summary, setSummary] = useState<MembersSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchMembersSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keyboard shortcut: '/' focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <MembersPageSkeleton />;
  if (error) return <PageError message={error} onRetry={reload} />;

  const filtered = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.sports.some((s) => s.sport.toLowerCase().includes(search.toLowerCase()));
    return matchSearch && (statusFilter === 'All' || m.status === statusFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filter changes
  function applyFilter(f: string) {
    setStatusFilter(f);
    setPage(1);
  }
  function applySearch(s: string) {
    setSearch(s);
    setPage(1);
  }

  function closeMenu() {
    setMenuOpenId(null);
  }

  function toggleSelect(id: string) {
    // Copy the Set before changing it so React receives a new state reference.
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
  function toggleAll() {
    // Select the current page's rows, or clear the selection when they are already selected.
    setSelectedIds(
      selectedIds.size === paginated.length ? new Set() : new Set(paginated.map((m) => m.id)),
    );
  }
  async function handleBulkStatus(next: MemberStatus) {
    // Settle every request so one failed member does not prevent results for the others.
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    const results = await Promise.allSettled(ids.map((id) => handleStatusChange(id, next)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    const ok = ids.length - failed;
    if (failed === 0) {
      toast(
        `${ok} member(s) ${next === 'Active' ? 'activated' : 'suspended'}.`,
        next === 'Active' ? 'success' : 'warning',
      );
    } else {
      setBulkError(
        `${failed} of ${ids.length} failed to ${next === 'Active' ? 'activate' : 'suspend'} — ${ok} succeeded.`,
      );
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
  }

  function handleBulkSuspend() {
    void handleBulkStatus('Suspended');
  }

  function handleBulkActivate() {
    void handleBulkStatus('Active');
  }
  function handleExport() {
    // Export all loaded members, regardless of the active search, status filter, or page.
    downloadCsv(
      members.map((m) => ({
        Name: m.name,
        Email: m.email,
        Role: m.role,
        Sports: m.sports.map((s) => s.sport).join(', '),
        Status: m.status,
        Rating: m.rating,
        Joined: m.joinedDate,
      })),
      'matchup-members.csv',
    );
    toast('Members exported as CSV.', 'info');
  }

  // Confirm dialog actions
  function requestSuspend(id: string, name: string) {
    setConfirm({ type: 'suspend', id, name });
  }
  function requestRemove(id: string, name: string) {
    setConfirm({ type: 'remove', id, name });
  }
  async function handleConfirm() {
    // Route the confirmed action to the matching mutation and surface any rejected request.
    if (!confirm) return;
    try {
      if (confirm.type === 'suspend') {
        await handleStatusChange(confirm.id, 'Suspended');
        toast(`${confirm.name} has been suspended.`, 'warning');
      } else {
        await handleDelete(confirm.id);
        toast(`${confirm.name} has been removed.`, 'info');
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Action failed.');
    }
    setConfirm(null);
    setMenuOpenId(null);
  }

  // Header cards describe the whole collection; the table below paginates client-side.
  // Falls back to page counts when the summary fetch fails (offline/CSP).
  const stats = [
    { label: 'Total Members', value: summary?.total ?? members.length, color: 'text-ink-900' },
    {
      label: 'Active',
      value: summary?.active ?? members.filter((m) => m.status === 'Active').length,
      color: 'text-brand-500',
    },
    {
      label: 'Suspended',
      value: summary?.suspended ?? members.filter((m) => m.status === 'Suspended').length,
      color: 'text-danger-500',
    },
  ];

  return (
    <div className="page-container space-y-5" onClick={closeMenu}>
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'suspend' ? `Suspend ${confirm?.name}?` : `Remove ${confirm?.name}?`
        }
        description={
          confirm?.type === 'suspend'
            ? 'This member will lose access until manually reactivated.'
            : 'This action cannot be undone. The member will be permanently removed.'
        }
        confirmLabel={confirm?.type === 'suspend' ? 'Suspend' : 'Remove'}
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Members Management</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Manage platform users, roles, and account status
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={handleExport} className="btn-outline rounded-lg px-3 py-1.5 text-sm">
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => applyFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === tab ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300 dark:hover:bg-ink-600'}`}
              >
                {tab}
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
              ref={searchRef}
              type="text"
              placeholder="Search members… (/)"
              value={search}
              onChange={(e) => applySearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ink-700 dark:text-ink-300 placeholder:text-ink-400 focus:outline-none sm:w-44"
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 dark:border-ink-700 bg-brand-50 dark:bg-brand-900/20 px-6 py-2.5">
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkSuspend}
              disabled={bulkBusy}
              className="text-xs font-semibold text-danger-500 hover:underline disabled:opacity-50"
            >
              Suspend selected
            </button>
            <button
              onClick={handleBulkActivate}
              disabled={bulkBusy}
              className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
            >
              Activate selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-semibold text-ink-500 dark:text-ink-400 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        {bulkError && (
          <div className="flex flex-wrap items-center gap-2 border-b border-danger-200 bg-danger-50 px-6 py-2.5 text-xs text-danger-700">
            <span className="flex-1">{bulkError}</span>
            <button onClick={() => setBulkError(null)} className="font-semibold underline">
              Dismiss
            </button>
            <button onClick={reload} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                <th className="tbl-th w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="tbl-th">Member</th>
                <th className="tbl-th">Sport</th>
                <th className="tbl-th">Role</th>
                <th className="tbl-th">Activities</th>
                <th className="tbl-th">Rating</th>
                <th className="tbl-th">Joined</th>
                <th className="tbl-th">Status</th>
                <th className="tbl-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {paginated.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-ink-50'}>
                  <td className="tbl-td">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="tbl-td">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={m.name}
                        photoUrl={m.photoUrl}
                        seed={m.avatarSeed}
                        className="h-8 w-8 rounded-full"
                      />
                      <div>
                        <Link
                          to={`/members/${m.id}`}
                          className="font-semibold text-brand-500 hover:underline"
                        >
                          {m.name}
                        </Link>
                        <p className="text-xs text-ink-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tbl-td">
                    <span className="rounded-md bg-ink-100 px-2 py-1 text-xs font-semibold text-ink-600">
                      {m.sports[0]?.sport ?? '—'}
                    </span>
                  </td>
                  <td className="tbl-td text-[13px] text-ink-700">{m.role}</td>
                  <td className="tbl-td">
                    <div className="text-[13px]">
                      <span className="font-medium text-ink-700">{m.activitiesJoined}</span>
                      <span className="text-ink-400"> joined</span>
                      {m.activitiesHosted > 0 && (
                        <>
                          <span className="text-ink-300 mx-1">·</span>
                          <span className="font-medium text-ink-700">{m.activitiesHosted}</span>
                          <span className="text-ink-400"> hosted</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="tbl-td">
                    <StarRating value={m.rating} />
                  </td>
                  <td className="tbl-td text-[13px] text-ink-600">{m.joinedDate}</td>
                  <td className="tbl-td">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="tbl-td">
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-100"
                      >
                        •••
                      </button>
                      {menuOpenId === m.id && (
                        <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-ink-200 bg-white py-1 shadow-panel">
                          {m.status !== 'Active' && (
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-700"
                              onClick={() => {
                                handleStatusChange(m.id, 'Active')
                                  .then(() => toast(`${m.name} activated.`, 'success'))
                                  .catch((err: unknown) =>
                                    setBulkError(
                                      err instanceof Error ? err.message : 'Activate failed.',
                                    ),
                                  );
                                setMenuOpenId(null);
                              }}
                            >
                              Activate
                            </button>
                          )}
                          {m.status !== 'Suspended' && (
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-warning-600 hover:bg-ink-50 dark:hover:bg-ink-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestSuspend(m.id, m.name);
                              }}
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            className="w-full px-4 py-2 text-left text-sm text-danger-500 hover:bg-ink-50 dark:hover:bg-ink-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestRemove(m.id, m.name);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-ink-200 dark:divide-ink-700 md:hidden">
          {paginated.map((m) => (
            <div key={m.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={m.name}
                    photoUrl={m.photoUrl}
                    seed={m.avatarSeed}
                    className="h-8 w-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{m.name}</p>
                    <p className="text-xs text-ink-400">{m.email}</p>
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-600">
                <span>
                  {m.role} · {m.sports[0]?.sport ?? '—'}
                </span>
                <StarRating value={m.rating} />
              </div>
            </div>
          ))}
        </div>

        {paginated.length === 0 && (
          <EmptyState
            icon={EmptyIcons[search ? 'search' : 'members']}
            title={
              search
                ? 'No members match your search.'
                : statusFilter !== 'All'
                  ? `No ${statusFilter.toLowerCase()} members.`
                  : 'No members yet.'
            }
            description={search ? 'Try a different name, email, or sport.' : undefined}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-700 px-6 py-3">
            <p className="text-xs text-ink-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 disabled:opacity-30"
              >
                Prev
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${page === i + 1 ? 'bg-brand-500 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
