import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchActivities,
  updateActivityStatus,
  deleteActivity,
} from '../../services/activitiesService';
import type { AdminActivity } from '../../services/activitiesService';
import type { ActivityStatus } from '../../types/activities';
import { Avatar } from '../../components/ui/Avatar';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

function StatusBadge({ status }: { status: ActivityStatus }) {
  // Map lifecycle states to semantic badge colors shared with the activity list.
  const map: Record<ActivityStatus, string> = {
    Active: 'bg-brand-50  text-brand-700  border-brand-200',
    Full: 'bg-warning-100 text-warning-700 border-warning-200',
    Completed: 'bg-ink-100   text-ink-600    border-ink-200',
    Cancelled: 'bg-danger-50 text-danger-700 border-danger-200',
    Flagged: 'bg-danger-50 text-danger-700 border-danger-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}
    >
      {status}
    </span>
  );
}

function MetaItem({
  icon,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
}) {
  // Pair a compact icon with a primary value and optional supporting detail.
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900 leading-tight">{primary}</p>
        {secondary && <p className="text-xs text-ink-400 mt-0.5">{secondary}</p>}
      </div>
    </div>
  );
}

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push: toast } = useToast();
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'complete' | 'remove' | null>(null);

  // Resolve details from the admin collection because this API has no single-record endpoint.
  function load() {
    setLoading(true);
    setError(null);
    // No admin detail endpoint — resolve from the admin list.
    fetchActivities()
      .then((rows) => {
        setActivity(rows.find((a) => a.id === id) ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
        setActivity(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    // Ignore a response if the route changes or the page unmounts before the request completes.
    let cancelled = false;
    setLoading(true);
    setError(null);
    // No admin detail endpoint — resolve from the admin list.
    fetchActivities()
      .then((rows) => {
        if (!cancelled) setActivity(rows.find((a) => a.id === id) ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load activity');
          setActivity(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runStatus(next: ActivityStatus) {
    // Persist moderation first; only then reflect the new status in the detail view.
    if (!activity) return;
    setActing(true);
    setActionError(null);
    try {
      await updateActivityStatus(activity.id, next);
      setActivity({ ...activity, status: next });
      toast(`Activity ${next.toLowerCase()}.`, 'info');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  async function runDelete() {
    // Navigate back to the list only after the delete is confirmed by the backend.
    if (!activity) return;
    setActing(true);
    setActionError(null);
    try {
      await deleteActivity(activity.id);
      toast('Activity removed.', 'info');
      navigate('/activities');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Remove failed.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  if (loading) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-ink-500">Loading activity…</p>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="page-container flex flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-ink-500">
          {error ? `Failed to load activity: ${error}` : 'Activity not found.'}
        </p>
        {error && (
          <button onClick={load} className="btn-primary rounded-lg px-4 py-2 text-sm">
            Retry
          </button>
        )}
        <button
          onClick={() => navigate('/activities')}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Back to Activities
        </button>
      </div>
    );
  }

  // Clamp capacity usage for the progress bar and derive the full-state label from it.
  const pct = Math.min((activity.participants / activity.capacity) * 100, 100);
  const isFull = pct >= 100;

  return (
    <div className="page-container space-y-4">
      {/* Back */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate('/activities')}
          className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-700 transition-colors"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8.5 2.5L4 7l4.5 4.5" />
          </svg>
          Activities
        </button>
        <div className="flex flex-wrap gap-2">
          {activity.status !== 'Cancelled' && (
            <button
              onClick={() => setConfirm('cancel')}
              disabled={acting}
              className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold text-warning-600 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {activity.status !== 'Completed' && activity.status !== 'Cancelled' && (
            <button
              onClick={() => setConfirm('complete')}
              disabled={acting}
              className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Mark Completed
            </button>
          )}
          <button
            onClick={() => setConfirm('remove')}
            disabled={acting}
            className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-2.5 text-xs text-danger-700">
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-semibold underline">
            Dismiss
          </button>
          <button onClick={load} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* One dialog handles all three actions, with copy and severity chosen from its state. */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === 'cancel'
            ? `Cancel ${activity.name}?`
            : confirm === 'complete'
              ? `Mark ${activity.name} completed?`
              : `Delete ${activity.name}?`
        }
        description={
          confirm === 'cancel'
            ? 'Participants will be notified that this activity has been cancelled.'
            : confirm === 'complete'
              ? 'This will mark the activity as completed.'
              : 'This action cannot be undone.'
        }
        confirmLabel={
          confirm === 'cancel'
            ? 'Cancel Activity'
            : confirm === 'complete'
              ? 'Mark Completed'
              : 'Delete'
        }
        destructive={confirm !== 'complete'}
        onConfirm={() => {
          if (confirm === 'cancel') runStatus('Cancelled');
          else if (confirm === 'complete') runStatus('Completed');
          else if (confirm === 'remove') runDelete();
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* ── Main layout: hero left, details right ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT column */}
        <div className="space-y-4">
          {/* Hero card */}
          <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
            {/* Cover */}
            <div className="h-[120px] bg-gradient-to-r from-brand-600 to-brand-400 flex items-end px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  {activity.sport}
                </span>
                <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  ⚡ {activity.skillLevel}
                </span>
              </div>
            </div>

            {/* Title row */}
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div>
                <h1 className="text-xl font-bold text-ink-900 leading-tight">{activity.name}</h1>
                <p className="mt-0.5 text-xs font-mono text-ink-400">{activity.matchId}</p>
              </div>
              <StatusBadge status={activity.status} />
            </div>

            {/* Stats inline row */}
            <div className="grid grid-cols-4 divide-x divide-ink-100 border-t border-ink-100">
              {[
                { label: 'Participants', value: `${activity.participants}/${activity.capacity}` },
                {
                  label: 'Duration',
                  value:
                    activity.durationMinutes >= 60
                      ? `${activity.durationMinutes / 60}h`
                      : `${activity.durationMinutes}m`,
                },
                { label: 'Fee', value: activity.isPaid ? `$${activity.fee}` : 'Free' },
                { label: 'Status', value: activity.status },
              ].map((s) => (
                <div key={s.label} className="py-3 px-4 text-center">
                  <p className="text-base font-bold text-ink-900">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* About + Vibe in one card */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">
                About
              </p>
              <p className="text-sm leading-relaxed text-ink-700">{activity.description}</p>
            </div>
            {activity.vibeTags.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">
                  Vibe
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activity.vibeTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="space-y-4">
          {/* Host */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-3">Host</p>
            <div className="flex items-center gap-3">
              <Avatar
                name={activity.host}
                photoUrl={activity.photoUrl}
                seed={activity.hostAvatarSeed}
                className="h-11 w-11 rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink-900 text-sm leading-tight">{activity.host}</p>
                <p className="text-xs text-ink-400 mt-0.5">Host</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-success-600">
                  ★ {activity.hostRating.toFixed(1)}
                </p>
                <p className="text-xs text-ink-400">{activity.hostGamesCount} games</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Details</p>
            <MetaItem
              icon={
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <rect x="1" y="3" width="16" height="14" rx="2" />
                  <path d="M1 7h16M5 1v4M13 1v4" />
                </svg>
              }
              primary={activity.scheduledDate}
              secondary={`${activity.startTime} – ${activity.endTime}`}
            />
            <MetaItem
              icon={
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="M9 1C5.686 1 3 3.686 3 7c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" />
                  <circle cx="9" cy="7" r="2" />
                </svg>
              }
              primary={activity.location}
              secondary={
                activity.addressLine ??
                (activity.distanceKm ? `${activity.distanceKm} km away` : undefined)
              }
            />
          </div>

          {/* Participants */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-3">
              Participants
            </p>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold text-ink-900">{activity.participants}</span>
              <span className="text-sm text-ink-400">/ {activity.capacity} spots</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: isFull ? '#f59e0b' : 'var(--brand-graphic)' }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-400">
              {isFull
                ? 'Activity is full'
                : `${activity.capacity - activity.participants} spot${activity.capacity - activity.participants !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
