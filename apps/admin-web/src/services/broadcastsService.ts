/** Broadcasts service — database-backed (Firestore `broadcasts` via api-server). */
import { apiFetch } from './api';
import type { Broadcast, BroadcastAudience, BroadcastStatus } from '../types/broadcasts';

export type { Broadcast, BroadcastAudience, BroadcastStatus };

export interface CreateBroadcastPayload {
  title: string;
  message: string;
  audience: BroadcastAudience;
  /** ISO string — when set, schedules for later; otherwise sends immediately. */
  scheduledAt?: string;
}

interface BroadcastView {
  id: string;
  title: string;
  message: string;
  audience: BroadcastAudience;
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  createdBy: string;
  createdAt: string | null;
}

function formatSentAt(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Convert the backend status and nullable timestamps into the broadcast model used by the UI.
function toBroadcast(view: BroadcastView): Broadcast {
  const status: BroadcastStatus =
    view.status === 'sent' ? 'Sent' : view.status === 'scheduled' ? 'Scheduled' : 'Draft';
  return {
    id: view.id,
    title: view.title,
    message: view.message,
    audience: view.audience,
    status,
    sentAt: formatSentAt(view.sentAt),
    scheduledAt: view.scheduledAt ?? undefined,
    recipients: view.recipients,
  };
}

export async function fetchBroadcasts(): Promise<Broadcast[]> {
  const res = await apiFetch<BroadcastView[]>('/api/admin/broadcasts');
  if (!res.ok) throw new Error(res.error.message);
  return res.data.map(toBroadcast);
}

export async function createBroadcast(payload: CreateBroadcastPayload): Promise<Broadcast> {
  // Scheduled records remain scheduled; immediate sends use create followed by the send endpoint.
  const created = await apiFetch<BroadcastView>('/api/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!created.ok) throw new Error(created.error.message);
  if (payload.scheduledAt) return toBroadcast(created.data);
  // Send immediately: create-then-send keeps one backend code path.
  const sent = await apiFetch<BroadcastView>(
    `/api/admin/broadcasts/${encodeURIComponent(created.data.id)}/send`,
    { method: 'POST' },
  );
  if (!sent.ok) throw new Error(sent.error.message);
  return toBroadcast(sent.data);
}

export async function sendBroadcast(id: string): Promise<Broadcast> {
  const res = await apiFetch<BroadcastView>(
    `/api/admin/broadcasts/${encodeURIComponent(id)}/send`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(res.error.message);
  return toBroadcast(res.data);
}

export async function deleteBroadcast(id: string): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/broadcasts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(res.error.message);
}

export interface UpdateBroadcastPayload {
  title?: string;
  message?: string;
  audience?: BroadcastAudience;
  scheduledAt?: string | null;
}

export async function updateBroadcast(
  id: string,
  patch: UpdateBroadcastPayload,
): Promise<Broadcast> {
  const res = await apiFetch<BroadcastView>(`/api/admin/broadcasts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(res.error.message);
  return toBroadcast(res.data);
}
