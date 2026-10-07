import { SlidePanel } from '../ui/SlidePanel';
import { Avatar } from '../ui/Avatar';
import type { Member, MemberStatus } from '../../types/members';

function StatusBadge({ status }: { status: MemberStatus }) {
  // Keep status colors and the dot indicator aligned for each member state.
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  // Reuse one label treatment for each group of member details.
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">
      {children}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  // Align field names and values consistently in the compact information lists.
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-ink-100 last:border-0">
      <span className="shrink-0 text-xs text-ink-400">{label}</span>
      <span className="text-right text-xs font-medium text-ink-800">{value}</span>
    </div>
  );
}

export function MemberDetailPanel({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  if (!member) return null;

  // Convert an optional birth date into a readable date and approximate age.
  const formatDob = (dob?: string) => {
    if (!dob) return null;
    const d = new Date(dob);
    const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${age} yrs)`;
  };

  // Hide the physical profile section when there are no fields to display.
  const hasPhysical = !!(member.dateOfBirth || member.heightCm || member.weightKg || member.goal);

  return (
    <SlidePanel
      open={!!member}
      onClose={onClose}
      title={member.name}
      subtitle={`${member.username} · ${member.role}`}
      width={480}
    >
      {/* ── Hero block ─────────────────────────────────────────────── */}
      <div className="-mx-6 -mt-5 mb-6 bg-gradient-to-b from-brand-50 to-white px-6 pt-6 pb-5 border-b border-ink-100">
        <div className="flex items-end gap-5">
          {/* Avatar — larger, prominent */}
          <div className="relative shrink-0">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl ring-2 ring-brand-400 ring-offset-2">
              <Avatar
                name={member.name}
                photoUrl={member.photoUrl}
                seed={member.avatarSeed}
                className="h-full w-full text-lg rounded-2xl"
              />
            </div>
          </div>

          {/* Name + meta */}
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="text-xl font-bold leading-tight text-ink-900">{member.name}</p>
            <p className="mt-0.5 text-sm font-medium text-brand-500">{member.username}</p>
            {member.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
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
            <div className="mt-2">
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-7">
        {/* ── Stats row — mirrors _StatsRow in mobile ─────────────── */}
        <div>
          {/* Joined, hosted, and rating metrics give a compact activity summary. */}
          <SectionLabel>Activity Stats</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
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
                value: `${member.rating.toFixed(1)}`,
                color: 'text-warning-600',
                prefix: '★',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-ink-200 bg-ink-50 py-3.5 text-center"
              >
                <p className={`text-xl font-bold ${s.color}`}>
                  {s.prefix && <span className="mr-0.5 text-sm">{s.prefix}</span>}
                  {s.value}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bio ─────────────────────────────────────────────────── */}
        {member.bio && (
          <div>
            {/* Bio is optional, so only render this section when supplied. */}
            <SectionLabel>Bio</SectionLabel>
            <p className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
              {member.bio}
            </p>
          </div>
        )}

        {/* ── Sports — mirrors "My Sports" chips ──────────────────── */}
        {member.sports.length > 0 && (
          <div>
            {/* Show each sport's level and visually highlight the first sport. */}
            <SectionLabel>My Sports</SectionLabel>
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

        {/* ── Contact — admin-only ─────────────────────────────────── */}
        <div>
          {/* Contact and account fields are grouped for quick administrative reference. */}
          <SectionLabel>Contact</SectionLabel>
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="px-4">
              <InfoRow label="Email" value={member.email} />
              <InfoRow label="Phone" value={member.phone ?? '—'} />
              <InfoRow label="Role" value={member.role} />
              <InfoRow label="Joined" value={member.joinedDate} />
            </div>
          </div>
        </div>

        {/* ── Physical profile — admin-only, only if data exists ────── */}
        {hasPhysical && (
          <div>
            {/* Render only physical profile attributes the member has provided. */}
            <SectionLabel>Physical Profile</SectionLabel>
            <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
              <div className="px-4">
                {member.dateOfBirth && (
                  <InfoRow label="Date of birth" value={formatDob(member.dateOfBirth) ?? '—'} />
                )}
                {member.heightCm && <InfoRow label="Height" value={`${member.heightCm} cm`} />}
                {member.weightKg && <InfoRow label="Weight" value={`${member.weightKg} kg`} />}
                {member.goal && <InfoRow label="Goal" value={member.goal} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
