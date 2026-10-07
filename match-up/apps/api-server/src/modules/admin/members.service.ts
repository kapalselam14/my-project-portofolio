import { Timestamp } from 'firebase-admin/firestore';
import { auth, firestore } from '../../database/firebase.js';
import { countUserActivities, isUserStatus, type UserStatus } from '../users/users.service.js';
import { logAdminAction } from './audit.service.js';

export type AdminMemberView = {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  status: UserStatus;
  createdAt: string | null;
  sports: { sport: string; level: string }[];
  rating: number;
  activitiesCount?: number;
  hostedCount?: number;
};

export const ADMIN_MEMBERS_PAGE_LIMIT_DEFAULT = 20;
export const ADMIN_MEMBERS_PAGE_LIMIT_MAX = 1000;

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

function mapMemberRow(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): AdminMemberView | null {
  if (!data || typeof data.email !== 'string') return null;
  // Sports come straight from the profile; levels fall back to blank when unset.
  const preferred = Array.isArray(data.preferredSports)
    ? (data.preferredSports as unknown[]).filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      )
    : [];
  const levels =
    data.sportSkillLevels !== null &&
    typeof data.sportSkillLevels === 'object' &&
    !Array.isArray(data.sportSkillLevels)
      ? (data.sportSkillLevels as Record<string, unknown>)
      : {};
  // Weighted average across per-sport aggregates; 0 when never rated.
  let ratingSum = 0;
  let ratingCount = 0;
  const bySport =
    data.ratingBySport !== null &&
    typeof data.ratingBySport === 'object' &&
    !Array.isArray(data.ratingBySport)
      ? (data.ratingBySport as Record<string, unknown>)
      : {};
  for (const entry of Object.values(bySport)) {
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      const rec = entry as { average?: unknown; count?: unknown };
      if (typeof rec.average === 'number' && typeof rec.count === 'number' && rec.count > 0) {
        ratingSum += rec.average * rec.count;
        ratingCount += rec.count;
      }
    }
  }
  return {
    uid: id,
    email: data.email,
    ...(typeof data.displayName === 'string' ? { displayName: data.displayName } : {}),
    ...(typeof data.photoUrl === 'string' ? { photoUrl: data.photoUrl } : {}),
    status: isUserStatus(data.status) ? data.status : 'active',
    createdAt: toIso(data.createdAt),
    sports: preferred.map((sport) => ({
      sport,
      level: typeof levels[sport] === 'string' ? (levels[sport] as string) : '',
    })),
    rating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
  };
}

/** Paginated user list for the admin Members table (no counts — list stays cheap). */
export async function listMembers(limit: number): Promise<AdminMemberView[]> {
  // Enforce the page-size cap before reading and mapping admin-visible user fields.
  const take = Math.trunc(limit);
  if (!Number.isFinite(take) || take < 1 || take > ADMIN_MEMBERS_PAGE_LIMIT_MAX) {
    throw new Error(`limit must be between 1 and ${ADMIN_MEMBERS_PAGE_LIMIT_MAX}`);
  }
  const snap = await firestore.collection('users').limit(take).get();
  const views: AdminMemberView[] = [];
  for (const doc of snap.docs) {
    const view = mapMemberRow(doc.id, doc.data());
    if (view) views.push(view);
  }
  // Per-row participation counts (parallel aggregations; failures degrade to zero per user).
  const counts = await Promise.all(views.map((view) => countUserActivities(view.uid)));
  return views.map((view, i) => ({ ...view, ...counts[i] }));
}

export type MembersSummary = {
  total: number;
  active: number;
  suspended: number;
};

/** Collection-wide member totals for the admin header cards (aggregation only, no doc reads). */
export async function getMembersSummary(): Promise<MembersSummary> {
  // Docs without an explicit status behave as active (see mapMemberRow), so
  // active is derived as total minus suspended rather than counted directly.
  const [totalSnap, suspendedSnap] = await Promise.all([
    firestore.collection('users').count().get(),
    firestore.collection('users').where('status', '==', 'suspended').count().get(),
  ]);
  const total = totalSnap.data().count;
  const suspended = suspendedSnap.data().count;
  return { total, active: total - suspended, suspended };
}

/** Member detail with live participation counts (reuses the user module). */
export async function getMemberDetail(uid: string): Promise<AdminMemberView> {
  // Return one admin projection, including aggregate activity counts when available.
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    throw new Error('uid is required');
  }
  const snap = await firestore.collection('users').doc(normalizedUid).get();
  if (!snap.exists) {
    throw new Error('User not found');
  }
  const view = mapMemberRow(snap.id, snap.data());
  if (!view) {
    throw new Error('User not found');
  }
  const counts = await countUserActivities(normalizedUid);
  return { ...view, ...counts };
}

/** Change only the status field, revoke sessions on suspension, and record the admin action. */
export async function setMemberStatus(
  uid: string,
  status: unknown,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<AdminMemberView> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    throw new Error('uid is required');
  }
  if (!isUserStatus(status)) {
    throw new Error('status must be active or suspended');
  }
  const ref = firestore.collection('users').doc(normalizedUid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('User not found');
  }
  const before = snap.data();
  await ref.update({ status, updatedAt: Timestamp.now() });
  if (status === 'suspended') {
    // Revoke Firebase sessions at suspension time so the user loses API access immediately.
    try {
      await auth.revokeRefreshTokens(normalizedUid);
    } catch (error) {
      console.warn(`[members] revokeRefreshTokens failed for ${normalizedUid}:`, error);
    }
  }
  const view = await getMemberDetail(normalizedUid);
  await logAdminAction({
    category: 'Members',
    action: 'member.status_change',
    adminUid,
    adminEmail,
    description: `Set member status to ${status}`,
    targetId: normalizedUid,
    targetLabel: view.email,
    before: { status: before?.status ?? null },
    after: { status },
  });
  return view;
}

/** Remove the Auth account, user document, and email index, then record the admin action. */
export async function deleteMember(
  uid: string,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<void> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    throw new Error('uid is required');
  }
  const ref = firestore.collection('users').doc(normalizedUid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('User not found');
  }
  const before = snap.data();
  const email = before?.email;
  try {
    await auth.deleteUser(normalizedUid);
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== 'auth/user-not-found') {
      throw new Error('Could not delete auth account');
    }
  }
  await ref.delete();
  if (typeof email === 'string' && email.length > 0) {
    await firestore
      .collection('userEmails')
      .doc(email.toLowerCase())
      .delete()
      .catch(() => undefined);
  }
  await logAdminAction({
    category: 'Members',
    action: 'member.delete',
    adminUid,
    adminEmail,
    description: 'Deleted member account',
    targetId: normalizedUid,
    targetLabel: typeof email === 'string' ? email : normalizedUid,
    before: {
      email: before?.email ?? null,
      displayName: before?.displayName ?? null,
      status: before?.status ?? null,
    },
  });
}
