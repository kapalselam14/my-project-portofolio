import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { logAdminAction } from '../admin/audit.service.js';
import { createNotification, renderTemplate } from '../notifications/notifications.service.js';

// Moderation appeals: one pending appeal per user+type; approval auto-reverses the action.

export type AppealType = 'suspension' | 'activity_removal' | 'account_ban' | 'content_removal';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export type AppealView = {
  id: string;
  appellantUid: string;
  userName: string;
  userEmail: string;
  type: AppealType;
  originalAction: string;
  statement: string;
  relatedId: string | null;
  status: AppealStatus;
  adminNote: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
};

const APPEAL_TYPES: readonly AppealType[] = [
  'suspension',
  'activity_removal',
  'account_ban',
  'content_removal',
];

export function isAppealType(value: unknown): value is AppealType {
  return typeof value === 'string' && (APPEAL_TYPES as readonly string[]).includes(value);
}

const ORIGINAL_ACTION: Record<AppealType, string> = {
  suspension: 'Account suspended',
  activity_removal: 'Activity removed',
  account_ban: 'Account banned',
  content_removal: 'Content removed',
};

export const APPEAL_STATEMENT_MAX = 2000;

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

async function enrich(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): Promise<AppealView | null> {
  if (
    !data ||
    typeof data.appellantUid !== 'string' ||
    !isAppealType(data.type) ||
    typeof data.statement !== 'string'
  ) {
    return null;
  }
  let userName = data.appellantUid;
  let userEmail = '';
  try {
    const userSnap = await firestore.collection('users').doc(data.appellantUid).get();
    const user = userSnap.exists ? userSnap.data() : undefined;
    if (typeof user?.displayName === 'string' && user.displayName.length > 0) {
      userName = user.displayName;
    }
    if (typeof user?.email === 'string') userEmail = user.email;
  } catch {
    // Best-effort enrichment.
  }
  const status: AppealStatus =
    data.status === 'approved' ? 'approved' : data.status === 'rejected' ? 'rejected' : 'pending';
  return {
    id,
    appellantUid: data.appellantUid,
    userName,
    userEmail,
    type: data.type,
    originalAction: ORIGINAL_ACTION[data.type],
    statement: data.statement,
    relatedId: typeof data.relatedId === 'string' ? data.relatedId : null,
    status,
    adminNote: typeof data.adminNote === 'string' ? data.adminNote : null,
    createdAt: toIso(data.createdAt),
    decidedAt: toIso(data.decidedAt),
    decidedBy: typeof data.decidedBy === 'string' ? data.decidedBy : null,
  };
}

export type SubmitAppealInput = {
  type?: unknown;
  statement?: unknown;
  relatedId?: unknown;
};

/** Files an appeal. */
export async function submitAppeal(
  appellantUid: string,
  input: SubmitAppealInput,
): Promise<AppealView> {
  const uid = appellantUid.trim();
  if (!uid) throw new Error('uid is required');
  if (!isAppealType(input.type)) {
    throw new Error('type must be suspension, activity_removal, account_ban, or content_removal');
  }
  const statement = typeof input.statement === 'string' ? input.statement.trim() : '';
  if (!statement) throw new Error('statement is required');
  if (statement.length > APPEAL_STATEMENT_MAX) {
    throw new Error(`statement must be at most ${APPEAL_STATEMENT_MAX} characters`);
  }
  const relatedId =
    input.relatedId === undefined || input.relatedId === null ? null : String(input.relatedId);
  const dupes = await firestore
    .collection('appeals')
    .where('appellantUid', '==', uid)
    .where('type', '==', input.type)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!dupes.empty) {
    // One pending appeal per type — prevents queue flooding while a case is open.
    throw new Error('A pending appeal of this type already exists');
  }
  const ref = firestore.collection('appeals').doc();
  await ref.set({
    appellantUid: uid,
    type: input.type,
    statement,
    relatedId,
    status: 'pending',
    adminNote: null,
    createdAt: Timestamp.now(),
    decidedAt: null,
    decidedBy: null,
  });
  const snap = await ref.get();
  const view = await enrich(ref.id, snap.data());
  if (!view) throw new Error('Could not read created appeal');
  return view;
}

export async function listMyAppeals(uid: string): Promise<AppealView[]> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('uid is required');
  const snap = await firestore
    .collection('appeals')
    .where('appellantUid', '==', normalizedUid)
    .limit(100)
    .get();
  const rows: AppealView[] = [];
  for (const doc of snap.docs) {
    const view = await enrich(doc.id, doc.data());
    if (view) rows.push(view);
  }
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return rows;
}

export async function listAppeals(status: AppealStatus): Promise<AppealView[]> {
  const snap = await firestore.collection('appeals').where('status', '==', status).limit(100).get();
  const rows: AppealView[] = [];
  for (const doc of snap.docs) {
    const view = await enrich(doc.id, doc.data());
    if (view) rows.push(view);
  }
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return rows;
}

export function isAppealStatus(value: unknown): value is AppealStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

export type AppealDecision = 'approved' | 'rejected';

/** Triages an appeal. */
export async function decideAppeal(
  id: string,
  decision: AppealDecision,
  adminUid: string,
  note: unknown,
): Promise<AppealView> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('appealId is required');
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('decision must be approved or rejected');
  }
  const adminNote = note === undefined || note === null ? null : String(note);
  const ref = firestore.collection('appeals').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Appeal not found');
  const data = snap.data();
  if (!data || !isAppealType(data.type) || typeof data.appellantUid !== 'string') {
    throw new Error('Appeal not found');
  }
  if (data.status !== 'pending') {
    // Decided appeals are immutable — re-deciding would corrupt the audit trail.
    throw new Error('Appeal already decided');
  }
  const now = Timestamp.now();
  await ref.update({
    status: decision,
    adminNote,
    decidedAt: now,
    decidedBy: adminUid,
  });
  if (decision === 'approved') {
    // Approval reverses the action (reactivate user / reopen activity) — moderation stays undoable.
    if (data.type === 'suspension' || data.type === 'account_ban') {
      await firestore
        .collection('users')
        .doc(data.appellantUid)
        .update({ status: 'active', updatedAt: now })
        .catch(() => undefined);
    } else if (data.type === 'activity_removal' && typeof data.relatedId === 'string') {
      const activityRef = firestore.collection('activities').doc(data.relatedId);
      const activitySnap = await activityRef.get().catch(() => null);
      if (activitySnap?.exists && activitySnap.data()?.status === 'removed') {
        await activityRef.update({ status: 'open', updatedAt: now }).catch(() => undefined);
      }
    }
  }
  const updated = await ref.get();
  const view = await enrich(ref.id, updated.data());
  if (!view) throw new Error('Appeal not found');
  await logAdminAction({
    category: 'Appeals',
    action: decision === 'approved' ? 'appeal.approve' : 'appeal.reject',
    adminUid,
    // adminEmail is not threaded through this call site today.
    description: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${data.type} appeal`,
    targetId: normalizedId,
    targetLabel: view.userName,
    before: { status: 'pending' },
    after: { status: decision, adminNote },
  });
  // Decision notice — best-effort, never fails triage.
  const decided = decision === 'approved' ? 'approved' : 'rejected';
  const noteText = view.adminNote ?? '';
  const fallback =
    decided === 'approved'
      ? {
          title: 'Your appeal was approved',
          body: 'Good news — the moderation action on your account was reversed.',
        }
      : {
          title: 'Your appeal was reviewed',
          body:
            'After review, your appeal was not approved.' +
            (noteText ? ` Note from our team: ${noteText}` : ''),
        };
  try {
    const template = await renderTemplate(
      decided === 'approved' ? 'moderation.appeal_approved' : 'moderation.appeal_rejected',
      { adminNote: noteText, supportEmail: '' },
    );
    await createNotification({
      recipientUid: view.appellantUid,
      type: 'system',
      title: template?.title ?? fallback.title,
      body: template?.body ?? fallback.body,
    });
  } catch {
    // Best-effort.
  }
  return view;
}
