import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import type { ActivityStatus } from '../activities/activities.service.js';
import { logAdminAction } from './audit.service.js';

export type AdminActivityView = {
  id: string;
  title: string;
  sportType: string;
  locationName: string;
  startTime: string | null;
  status: ActivityStatus;
  capacity: number;
  participantCount: number;
  hostId: string;
  hostDisplayName: string;
  createdAt: string | null;
  isPaid: boolean;
  fee?: number;
};

/** Admin-triageable statuses. `removed` = hidden from every feed. */
const ADMIN_STATUSES: readonly ActivityStatus[] = ['open', 'cancelled', 'completed', 'removed'];

export function isAdminActivityStatus(value: unknown): value is ActivityStatus {
  return typeof value === 'string' && (ADMIN_STATUSES as readonly string[]).includes(value);
}

export const ADMIN_ACTIVITIES_LIMIT_DEFAULT = 20;
export const ADMIN_ACTIVITIES_LIMIT_MAX = 1000;

function toIso(value: unknown): string | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return typeof value === 'string' ? value : null;
}

async function hostDisplayName(hostId: string): Promise<string> {
  try {
    const snap = await firestore.collection('users').doc(hostId).get();
    const name = snap.exists ? snap.data()?.displayName : undefined;
    return typeof name === 'string' && name.length > 0 ? name : '';
  } catch {
    return '';
  }
}

export type ActivitiesSummary = {
  total: number;
  open: number;
  full: number;
  cancelled: number;
  completed: number;
  removed: number;
};

/** Collection-wide activity totals for the admin header cards (aggregation only, no doc reads). */
export async function getActivitiesSummary(): Promise<ActivitiesSummary> {
  const statuses = ['open', 'full', 'cancelled', 'completed', 'removed'] as const;
  const [totalSnap, ...statusSnaps] = await Promise.all([
    firestore.collection('activities').count().get(),
    ...statuses.map((status) =>
      firestore.collection('activities').where('status', '==', status).count().get(),
    ),
  ]);
  const counts = statusSnaps.map((snap) => snap.data().count);
  return {
    total: totalSnap.data().count,
    open: counts[0] ?? 0,
    full: counts[1] ?? 0,
    cancelled: counts[2] ?? 0,
    completed: counts[3] ?? 0,
    removed: counts[4] ?? 0,
  };
}

/** Newest-first admin table. Host names resolved best-effort. */
export async function listAdminActivities(limit: number): Promise<AdminActivityView[]> {
  // Validate the requested window and map stored activity records into the admin list projection.
  const take = Math.trunc(limit);
  if (!Number.isFinite(take) || take < 1 || take > ADMIN_ACTIVITIES_LIMIT_MAX) {
    throw new Error(`limit must be between 1 and ${ADMIN_ACTIVITIES_LIMIT_MAX}`);
  }
  const snap = await firestore.collection('activities').limit(take).get();
  const rows = snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter((r) => typeof r.data.title === 'string')
    .sort((a, b) => {
      const at = toIso(a.data.createdAt) ?? '';
      const bt = toIso(b.data.createdAt) ?? '';
      return bt.localeCompare(at);
    });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.data.title as string,
      sportType: typeof r.data.sportType === 'string' ? r.data.sportType : '',
      locationName: typeof r.data.locationName === 'string' ? r.data.locationName : '',
      startTime: toIso(r.data.startTime),
      status: (r.data.status ?? 'open') as ActivityStatus,
      capacity: typeof r.data.capacity === 'number' ? r.data.capacity : 0,
      participantCount: typeof r.data.participantCount === 'number' ? r.data.participantCount : 0,
      hostId: typeof r.data.hostId === 'string' ? r.data.hostId : '',
      hostDisplayName: await hostDisplayName(
        typeof r.data.hostId === 'string' ? r.data.hostId : '',
      ),
      createdAt: toIso(r.data.createdAt),
      isPaid: r.data.isPaid === true,
      ...(typeof r.data.fee === 'number' && Number.isFinite(r.data.fee) && r.data.fee > 0
        ? { fee: r.data.fee as number }
        : {}),
    })),
  );
}

/** Admin status override — same write the host flow performs, without the host-ownership check. */
// Record the moderator identity with the status change so the audit trail is attributable.
export async function setAdminActivityStatus(
  activityId: string,
  status: unknown,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<void> {
  const normalizedId = activityId.trim();
  if (!normalizedId) {
    throw new Error('activityId is required');
  }
  if (!isAdminActivityStatus(status)) {
    throw new Error('status must be open, cancelled, completed, or removed');
  }
  const ref = firestore.collection('activities').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('Activity not found');
  }
  const before = snap.data();
  await ref.update({ status, updatedAt: Timestamp.now() });
  await logAdminAction({
    category: 'Activities',
    action: 'activity.status_change',
    adminUid,
    adminEmail,
    description: `Set activity status to ${status}`,
    targetId: normalizedId,
    targetLabel: typeof before?.title === 'string' ? before.title : normalizedId,
    before: { status: before?.status ?? null },
    after: { status },
  });
}

/** Deletes every doc in a subcollection in batches of 400 (under the 500-write batch ceiling, leaving headroom). */
async function deleteSubcollection(
  parentRef: FirebaseFirestore.DocumentReference,
  subcollection: string,
): Promise<number> {
  let removed = 0;
  for (;;) {
    const snap = await parentRef.collection(subcollection).limit(400).get();
    if (snap.empty) break;
    const batch = parentRef.firestore.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    removed += snap.size;
  }
  return removed;
}

/** Delete the activity and its `participants`/`joinRequests` rows, then record the admin action. */
export async function deleteAdminActivity(
  activityId: string,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<void> {
  const normalizedId = activityId.trim();
  if (!normalizedId) {
    throw new Error('activityId is required');
  }
  const ref = firestore.collection('activities').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('Activity not found');
  }
  const before = snap.data();
  const [removedParticipants, removedJoinRequests] = await Promise.all([
    deleteSubcollection(ref, 'participants'),
    deleteSubcollection(ref, 'joinRequests'),
  ]);
  await ref.delete();
  await logAdminAction({
    category: 'Activities',
    action: 'activity.delete',
    adminUid,
    adminEmail,
    description: 'Deleted activity',
    targetId: normalizedId,
    targetLabel: typeof before?.title === 'string' ? before.title : normalizedId,
    before: { title: before?.title ?? null, status: before?.status ?? null },
    after: { removedParticipants, removedJoinRequests },
  });
}
