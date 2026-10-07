/** Activities service — database-backed (Firestore `activities` via api-server). */
import { apiFetch } from './api';
import type { AdminActivity, ActivityStatus } from '../types/activities';

export type { AdminActivity, ActivityStatus };

interface AdminActivityView {
  id: string;
  title: string;
  sportType: string;
  locationName: string;
  startTime: string | null;
  status: 'open' | 'full' | 'cancelled' | 'completed' | 'removed';
  capacity: number;
  participantCount: number;
  hostId: string;
  hostDisplayName: string;
  hostPhotoUrl?: string;
  createdAt: string | null;
  isPaid?: boolean;
  fee?: number;
}

// Return display-ready date/time fields, using empty labels for missing or invalid backend values.
function formatDateTime(iso: string | null): {
  scheduledDate: string;
  startTime: string;
} {
  if (!iso) return { scheduledDate: '', startTime: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { scheduledDate: '', startTime: '' };
  return {
    scheduledDate: d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    startTime: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

// Adapt the backend's smaller activity view into the fields consumed by admin pages.
function toAdminActivity(view: AdminActivityView): AdminActivity {
  const { scheduledDate, startTime } = formatDateTime(view.startTime);
  const status: ActivityStatus =
    view.status === 'cancelled'
      ? 'Cancelled'
      : view.status === 'completed'
        ? 'Completed'
        : view.status === 'removed'
          ? 'Flagged'
          : view.participantCount >= view.capacity && view.capacity > 0
            ? 'Full'
            : 'Active';
  return {
    id: view.id,
    name: view.title,
    matchId: view.id.slice(0, 8).toUpperCase(),
    sport: view.sportType,
    skillLevel: 'All Levels',
    host: view.hostDisplayName || view.hostId.slice(0, 8),
    hostAvatarSeed: view.hostId,
    photoUrl: view.hostPhotoUrl,
    hostRating: 0,
    hostGamesCount: 0,
    location: view.locationName,
    scheduledDate,
    startTime,
    endTime: '',
    durationMinutes: 0,
    participants: view.participantCount,
    capacity: view.capacity,
    status,
    description: '',
    isPaid: view.isPaid === true,
    ...(typeof view.fee === 'number' ? { fee: view.fee } : {}),
    vibeTags: [],
  };
}

function toBackendStatus(status: ActivityStatus): string {
  // Translate display labels into the status vocabulary accepted by the API.
  switch (status) {
    case 'Active':
    case 'Full':
      return 'open';
    case 'Cancelled':
      return 'cancelled';
    case 'Completed':
      return 'completed';
    case 'Flagged':
      return 'removed';
  }
}

export async function fetchActivities(): Promise<AdminActivity[]> {
  // Normalize each wire record into the model shared by admin pages.
  // Ask for the full collection (API default is 20): the table paginates client-side.
  const res = await apiFetch<AdminActivityView[]>('/api/admin/activities?limit=1000');
  if (!res.ok) throw new Error(res.error.message);
  return res.data.map(toAdminActivity);
}

export interface ActivitiesSummary {
  total: number;
  open: number;
  full: number;
  cancelled: number;
  completed: number;
  removed: number;
}

// Collection-wide totals for the header cards (cheap counts; the list itself is fully loaded).
export async function fetchActivitiesSummary(): Promise<ActivitiesSummary> {
  const res = await apiFetch<ActivitiesSummary>('/api/admin/activities/summary');
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export async function updateActivityStatus(id: string, status: ActivityStatus): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/activities/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });
  if (!res.ok) throw new Error(res.error.message);
}

export async function deleteActivity(id: string): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/activities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(res.error.message);
}
