import { SlidePanel } from '../ui/SlidePanel';
import { Avatar } from '../ui/Avatar';
import type { AdminActivity, ActivityStatus } from '../../types/activities';

function StatusBadge({ status }: { status: ActivityStatus }) {
  // Match each activity state to the same semantic color used across admin views.
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  // Shared heading style keeps the panel's content groups visually consistent.
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">
      {children}
    </p>
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
  // Pair an icon and primary value with optional supporting detail.
  return (
    <div className="flex items-start gap-3 py-3 border-b border-ink-100 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{primary}</p>
        {secondary && <p className="mt-0.5 text-xs text-ink-500">{secondary}</p>}
      </div>
    </div>
  );
}

export function ActivityDetailPanel({
  activity,
  onClose,
}: {
  activity: AdminActivity | null;
  onClose: () => void;
}) {
  if (!activity) return null;

  // Clamp the occupancy bar so it never extends beyond the available capacity.
  const pct = Math.min((activity.participants / activity.capacity) * 100, 100);
  const isFull = pct >= 100;

  return (
    <SlidePanel
      open={!!activity}
      onClose={onClose}
      title={activity.name}
      subtitle={`${activity.matchId}`}
      width={520}
    >
      {/* ── Hero block ─────────────────────────────────────────────── */}
      <div className="-mx-6 -mt-5 mb-6 border-b border-ink-100 bg-gradient-to-b from-ink-50 to-white px-6 pt-5 pb-5">
        {/* Sport, skill, status, and price summarize the activity at a glance. */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="rounded-full bg-ink-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-700">
            {activity.sport}
          </span>
          <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">
            ⚡ {activity.skillLevel}
          </span>
          <StatusBadge status={activity.status} />
          {activity.isPaid ? (
            <span className="rounded-full border border-warning-200 bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-700">
              Paid · ${activity.fee}
            </span>
          ) : (
            <span className="rounded-full border border-success-100 bg-success-100 px-2.5 py-0.5 text-xs font-semibold text-success-700">
              Free
            </span>
          )}
        </div>

        {/* Host card — mirrors _HostCard */}
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3.5 py-3">
          <Avatar
            name={activity.host}
            photoUrl={activity.photoUrl}
            seed={activity.hostAvatarSeed}
            className="h-9 w-9 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink-900 leading-tight">{activity.host}</p>
            <p className="text-xs text-ink-400">Host</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-warning-400 text-sm">★</span>
            <span className="text-sm font-bold text-success-700">
              {activity.hostRating.toFixed(1)}
            </span>
            <span className="text-xs text-ink-400">({activity.hostGamesCount})</span>
          </div>
        </div>
      </div>

      <div className="space-y-7">
        {/* ── Details — mirrors _MetaCard ─────────────────────────── */}
        <div>
          {/* Schedule, location, and price are grouped as practical activity details. */}
          <SectionLabel>Details</SectionLabel>
          <div className="rounded-xl border border-ink-200 bg-white px-4">
            <MetaItem
              icon={
                <svg
                  width="14"
                  height="14"
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
              primary={`${activity.scheduledDate} · ${activity.startTime} – ${activity.endTime}`}
              secondary={`Duration ${activity.durationMinutes >= 60 ? `~${activity.durationMinutes / 60}h` : `${activity.durationMinutes}m`}`}
            />
            <MetaItem
              icon={
                <svg
                  width="14"
                  height="14"
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
            <MetaItem
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <circle cx="9" cy="9" r="8" />
                  <path d="M9 5v4l2.5 2" />
                </svg>
              }
              primary={activity.isPaid ? `Paid — $${activity.fee} per person` : 'Free to join'}
            />
          </div>
        </div>

        {/* ── About ───────────────────────────────────────────────── */}
        <div>
          {/* The host description adds context beyond the structured metadata. */}
          <SectionLabel>About this Activity</SectionLabel>
          <p className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-sm leading-relaxed text-ink-700">
            {activity.description}
          </p>
        </div>

        {/* ── Participants ─────────────────────────────────────────── */}
        <div>
          {/* Show current enrollment and remaining capacity beside the progress bar. */}
          <SectionLabel>Participants</SectionLabel>
          <div className="rounded-xl border border-ink-200 bg-white px-4 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-ink-900">{activity.participants}</span>
              <span className="text-sm text-ink-400">/ {activity.capacity} spots</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isFull ? '#f59e0b' : 'var(--brand-graphic)',
                }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">
              {isFull
                ? 'Activity is full'
                : `${activity.capacity - activity.participants} spot${activity.capacity - activity.participants !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>

        {/* ── Vibe tags ───────────────────────────────────────────── */}
        {activity.vibeTags.length > 0 && (
          <div>
            <SectionLabel>Vibe</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {activity.vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
