import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMember, updateMemberStatus, deleteMember } from '../../services/membersService';
import type { Member } from '../../services/membersService';
import type { MemberStatus } from '../../types/members';
import { Avatar } from '../../components/ui/Avatar';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

function StatusBadge({ status }: { status: MemberStatus }) {
  // Use both a color and a dot so the member status remains easy to scan.
  const map: Record<MemberStatus, { cls: string; dot: string }> = {
    Active: { cls: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500' },
    Suspended: { cls: 'bg-danger-50 text-danger-700 border-danger-200', dot: 'bg-danger-500' },
  };
  const { cls, dot } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  // Keep labels and values aligned across the profile's compact detail lists.
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-ink-400">{label}</span>
      <span className="text-right text-xs font-medium text-ink-800">{value}</span>
    </div>
  );
}

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [confirm, setConfirm] = useState<'suspend' | 'activate' | 'remove' | null>(null);

  // Reuse this loader for initial page load and the retry action after an error.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMember(id ?? '');
      setMember(m);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load member';
      // Distinguish not-found from network errors instead of silently nulling.
      setError(msg);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Ignore stale results when navigating from one member id to another.
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await fetchMember(id ?? '');
        if (!cancelled) setMember(m);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load member');
          setMember(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runStatus(next: MemberStatus) {
    // Keep the displayed status unchanged until the backend accepts the action.
    if (!member) return;
    setActing(true);
    setActionError(null);
    try {
      await updateMemberStatus(member.id, next);
      setMember({ ...member, status: next });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  }

  async function runRemove() {
    // Return to the member list only after deletion succeeds.
    if (!member) return;
    setActing(true);
    setActionError(null);
    try {
      await deleteMember(member.id);
      navigate('/members');
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
        <p className="text-sm text-ink-500">Loading member…</p>
      </div>
    );
  }

  if (!member) {
    // Treat a not-found response as a terminal state; offer retry for other load failures.
    const notFound = error && /not.?found|404/i.test(error);
    return (
      <div className="page-container flex flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-ink-500">
          {notFound ? 'Member not found.' : `Failed to load member${error ? `: ${error}` : '.'}`}
        </p>
        {!notFound && (
          <button onClick={load} className="btn-primary rounded-lg px-4 py-2 text-sm">
            Retry
          </button>
        )}
        <button
          onClick={() => navigate('/members')}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Back to Members
        </button>
      </div>
    );
  }

  // Present the birth date with an approximate age for the admin profile view.
  const formatDob = (dob?: string) => {
    if (!dob) return null;
    const d = new Date(dob);
    const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${age} yrs)`;
  };

  // Omit this panel when the member has not provided any physical-profile fields.
  const hasPhysical = !!(member.dateOfBirth || member.heightCm || member.weightKg || member.goal);

  return (
    <div className="page-container space-y-4">
      {/* Back */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate('/members')}
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
          Members
        </button>
        <div className="flex flex-wrap gap-2">
          {member.status === 'Active' ? (
            <button
              onClick={() => setConfirm('suspend')}
              disabled={acting}
              className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold text-warning-600 disabled:opacity-50"
            >
              Suspend
            </button>
          ) : (
            <button
              onClick={() => setConfirm('activate')}
              disabled={acting}
              className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Activate
            </button>
          )}
          <button
            onClick={() => setConfirm('remove')}
            disabled={acting}
            className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-50 disabled:opacity-50"
          >
            Remove
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

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === 'suspend'
            ? `Suspend ${member.name}?`
            : confirm === 'activate'
              ? `Activate ${member.name}?`
              : `Remove ${member.name}?`
        }
        description={
          confirm === 'suspend'
            ? 'This member will lose access until manually reactivated.'
            : confirm === 'activate'
              ? 'This member will regain access immediately.'
              : 'This action cannot be undone.'
        }
        confirmLabel={
          confirm === 'suspend' ? 'Suspend' : confirm === 'activate' ? 'Activate' : 'Remove'
        }
        destructive={confirm !== 'activate'}
        onConfirm={() => {
          if (confirm === 'suspend') runStatus('Suspended');
          else if (confirm === 'activate') runStatus('Active');
          else if (confirm === 'remove') runRemove();
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* ── Main layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* LEFT — identity card */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
            {/* Banner */}
            <div className="h-16 bg-gradient-to-r from-brand-500 to-brand-400" />
            {/* Avatar + info */}
            <div className="px-5 pb-5">
              <div className="relative -mt-8 mb-3 flex items-end justify-between">
                <div className="h-[60px] w-[60px] overflow-hidden rounded-xl ring-4 ring-white shadow-sm">
                  <Avatar
                    name={member.name}
                    photoUrl={member.photoUrl}
                    seed={member.avatarSeed}
                    className="h-full w-full text-lg rounded-2xl"
                  />
                </div>
                <StatusBadge status={member.status} />
              </div>
              <h1 className="text-lg font-bold text-ink-900">{member.name}</h1>
              <p className="text-sm font-medium text-brand-500">{member.username}</p>
              {member.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  >
                    <path d="M7 1C4.791 1 3 2.791 3 5c0 3.5 4 8 4 8s4-4.5 4-8c0-2.209-1.791-4-4-4z" />
                    <circle cx="7" cy="5" r="1.5" />
                  </svg>
                  {member.location}
                </p>
              )}
            </div>

            {/* Stats inline */}
            <div className="grid grid-cols-3 divide-x divide-ink-100 border-t border-ink-100">
              {[
                {
                  label: 'Joined',
                  value: member.activitiesJoined.toString(),
                  color: 'text-brand-600',
                },
                {
                  label: 'Hosted',
                  value: member.activitiesHosted.toString(),
                  color: 'text-success-600',
                },
                {
                  label: 'Rating',
                  value: `★ ${member.rating.toFixed(1)}`,
                  color: 'text-warning-600',
                },
              ].map((s) => (
                <div key={s.label} className="py-3 text-center">
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1">
              Contact
            </p>
            <div>
              <InfoRow label="Email" value={member.email} />
              <InfoRow label="Phone" value={member.phone ?? '—'} />
              <InfoRow label="Role" value={member.role} />
              <InfoRow label="Joined" value={member.joinedDate} />
            </div>
          </div>

          {/* Physical profile */}
          {hasPhysical && (
            <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1">
                Physical Profile
              </p>
              <div>
                {member.dateOfBirth && (
                  <InfoRow label="Date of birth" value={formatDob(member.dateOfBirth) ?? '—'} />
                )}
                {member.heightCm && <InfoRow label="Height" value={`${member.heightCm} cm`} />}
                {member.weightKg && <InfoRow label="Weight" value={`${member.weightKg} kg`} />}
                {member.goal && <InfoRow label="Goal" value={member.goal} />}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — bio + sports */}
        <div className="space-y-4">
          {/* Bio */}
          {member.bio && (
            <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">Bio</p>
              <p className="text-sm leading-relaxed text-ink-700">{member.bio}</p>
            </div>
          )}

          {/* Sports */}
          {member.sports.length > 0 && (
            <div className="rounded-2xl border border-ink-200 bg-white shadow-card px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-3">
                My Sports
              </p>
              <div className="flex flex-wrap gap-2">
                {member.sports.map((s, i) => (
                  <span
                    key={s.sport}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      i === 0
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-600'
                    }`}
                  >
                    {s.sport}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        i === 0 ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'
                      }`}
                    >
                      {s.level}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Empty state if no content on right */}
          {!member.bio && member.sports.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-ink-50">
              <p className="text-sm text-ink-400">No additional profile information.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
