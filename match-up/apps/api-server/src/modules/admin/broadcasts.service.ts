import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { createNotification } from '../notifications/notifications.service.js';
import { logAdminAction } from './audit.service.js';

export type BroadcastAudience = 'All Users' | 'Hosts Only' | 'Players Only' | 'Inactive Users';

export type BroadcastStatus = 'draft' | 'scheduled' | 'sent';

export type BroadcastView = {
  id: string;
  title: string;
  message: string;
  audience: BroadcastAudience;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  createdBy: string;
  createdAt: string | null;
};

const AUDIENCES: readonly BroadcastAudience[] = [
  'All Users',
  'Hosts Only',
  'Players Only',
  'Inactive Users',
];

export function isBroadcastAudience(value: unknown): value is BroadcastAudience {
  return typeof value === 'string' && (AUDIENCES as readonly string[]).includes(value);
}

/** Fan-out safety cap: one send notifies at most this many users. */
export const BROADCAST_RECIPIENT_CAP = 500;
/** Inactive = account created more than this long ago. */
const INACTIVE_AFTER_DAYS = 30;

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

function mapBroadcast(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): BroadcastView | null {
  if (
    !data ||
    typeof data.title !== 'string' ||
    typeof data.message !== 'string' ||
    !isBroadcastAudience(data.audience)
  ) {
    return null;
  }
  const status: BroadcastStatus =
    data.status === 'sent' ? 'sent' : data.status === 'scheduled' ? 'scheduled' : 'draft';
  return {
    id,
    title: data.title,
    message: data.message,
    audience: data.audience,
    status,
    scheduledAt: toIso(data.scheduledAt),
    sentAt: toIso(data.sentAt),
    recipients: typeof data.recipients === 'number' ? data.recipients : 0,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: toIso(data.createdAt),
  };
}

export async function listBroadcasts(): Promise<BroadcastView[]> {
  // Return broadcasts newest-first using the admin-facing status and timestamp model.
  const snap = await firestore.collection('broadcasts').get();
  const rows: BroadcastView[] = [];
  for (const doc of snap.docs) {
    const view = mapBroadcast(doc.id, doc.data());
    if (view) rows.push(view);
  }
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return rows;
}

export type CreateBroadcastInput = {
  title?: unknown;
  message?: unknown;
  audience?: unknown;
  scheduledAt?: unknown;
};

// Validate content, audience, and scheduling before writing the draft or scheduled record.
export async function createBroadcast(
  input: CreateBroadcastInput,
  createdBy: string,
): Promise<BroadcastView> {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!title) throw new Error('title is required');
  if (!message) throw new Error('message is required');
  if (!isBroadcastAudience(input.audience)) {
    throw new Error('audience must be All Users, Hosts Only, Players Only, or Inactive Users');
  }
  const scheduledAt =
    input.scheduledAt === undefined || input.scheduledAt === null
      ? null
      : String(input.scheduledAt);
  if (scheduledAt !== null && Number.isNaN(Date.parse(scheduledAt))) {
    throw new Error('scheduledAt must be an ISO date string');
  }
  const ref = firestore.collection('broadcasts').doc();
  const record = {
    title,
    message,
    audience: input.audience,
    status: scheduledAt ? 'scheduled' : 'draft',
    scheduledAt,
    sentAt: null,
    recipients: 0,
    createdBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await ref.set(record);
  const snap = await ref.get();
  const view = mapBroadcast(ref.id, snap.data());
  if (!view) throw new Error('Could not read created broadcast');
  await logAdminAction({
    category: 'Broadcasts',
    action: 'broadcast.create',
    adminUid: createdBy,
    description: `Created broadcast "${title}"`,
    targetId: ref.id,
    targetLabel: title,
    after: { title, message, audience: input.audience, status: record.status },
  });
  return view;
}

export type UpdateBroadcastInput = {
  title?: unknown;
  message?: unknown;
  audience?: unknown;
  scheduledAt?: unknown;
};

/** Update draft/scheduled fields; sent broadcasts remain immutable history. */
export async function updateBroadcast(
  id: string,
  input: UpdateBroadcastInput,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<BroadcastView> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('broadcastId is required');
  const ref = firestore.collection('broadcasts').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Broadcast not found');
  const current = mapBroadcast(ref.id, snap.data());
  if (!current) throw new Error('Broadcast not found');
  if (current.status === 'sent') {
    throw new Error('Sent broadcasts cannot be edited');
  }
  const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('title is required');
    patch.title = title;
  }
  if (input.message !== undefined) {
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message) throw new Error('message is required');
    patch.message = message;
  }
  if (input.audience !== undefined) {
    if (!isBroadcastAudience(input.audience)) {
      throw new Error('audience must be All Users, Hosts Only, Players Only, or Inactive Users');
    }
    patch.audience = input.audience;
  }
  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt !== null) {
      const s = String(input.scheduledAt);
      if (Number.isNaN(Date.parse(s))) {
        throw new Error('scheduledAt must be an ISO date string');
      }
      patch.scheduledAt = s;
      patch.status = 'scheduled';
    } else {
      patch.scheduledAt = null;
      patch.status = 'draft';
    }
  }
  await ref.update(patch);
  const updated = await ref.get();
  const view = mapBroadcast(ref.id, updated.data());
  if (!view) throw new Error('Could not read updated broadcast');
  await logAdminAction({
    category: 'Broadcasts',
    action: 'broadcast.update',
    adminUid,
    adminEmail,
    description: `Updated broadcast "${current.title}"`,
    targetId: normalizedId,
    targetLabel: current.title,
    before: { title: current.title, message: current.message, audience: current.audience },
    after: { title: view.title, message: view.message, audience: view.audience },
  });
  return view;
}

/** Sent broadcasts remain as immutable delivery history. */
export async function deleteBroadcast(
  id: string,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<void> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('broadcastId is required');
  const ref = firestore.collection('broadcasts').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Broadcast not found');
  const current = mapBroadcast(ref.id, snap.data());
  if (current?.status === 'sent') {
    throw new Error('Sent broadcasts cannot be deleted');
  }
  await ref.delete();
  await logAdminAction({
    category: 'Broadcasts',
    action: 'broadcast.delete',
    adminUid,
    adminEmail,
    description: `Deleted broadcast "${current?.title ?? normalizedId}"`,
    targetId: normalizedId,
    targetLabel: current?.title ?? normalizedId,
    before: current ? { title: current.title, status: current.status } : null,
  });
}

/** Resolve recipient uids for an audience, bounded by the safety cap. */
async function resolveRecipients(audience: BroadcastAudience): Promise<string[]> {
  if (audience === 'Hosts Only') {
    const snap = await firestore
      .collection('activities')
      .limit(BROADCAST_RECIPIENT_CAP * 2)
      .get();
    const hosts = new Set<string>();
    for (const doc of snap.docs) {
      const hostId = doc.data()?.hostId;
      if (typeof hostId === 'string' && hostId.length > 0) {
        hosts.add(hostId);
        if (hosts.size >= BROADCAST_RECIPIENT_CAP) break;
      }
    }
    return [...hosts];
  }
  const snap = await firestore.collection('users').limit(BROADCAST_RECIPIENT_CAP).get();
  const cutoff = Date.now() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const uids: string[] = [];
  const hostIds = new Set<string>();
  if (audience === 'Players Only') {
    const acts = await firestore
      .collection('activities')
      .limit(BROADCAST_RECIPIENT_CAP * 2)
      .get();
    for (const doc of acts.docs) {
      const hostId = doc.data()?.hostId;
      if (typeof hostId === 'string') hostIds.add(hostId);
    }
  }
  for (const doc of snap.docs) {
    const data = doc.data();
    if (audience === 'Players Only' && hostIds.has(doc.id)) continue;
    if (audience === 'Inactive Users') {
      const created = toIso(data?.createdAt);
      if (!created || Date.parse(created) >= cutoff) continue;
    }
    uids.push(doc.id);
    if (uids.length >= BROADCAST_RECIPIENT_CAP) break;
  }
  return uids;
}

/** Attempt each due scheduled row through [sendBroadcast], allowing other rows to proceed on failure. */
export async function sweepDueBroadcasts(
  now: Date = new Date(),
  sentBy = 'scheduler',
): Promise<{ checked: number; sent: number }> {
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await firestore.collection('broadcasts').where('status', '==', 'scheduled').get();
  } catch {
    return { checked: 0, sent: 0 };
  }
  let checked = 0;
  const due: string[] = [];
  for (const doc of snap.docs) {
    checked += 1;
    const scheduledAt = toIso(doc.data()?.scheduledAt);
    if (scheduledAt === null) continue;
    if (Date.parse(scheduledAt) <= now.getTime()) due.push(doc.id);
  }
  let sent = 0;
  for (const id of due) {
    try {
      await sendBroadcast(id, sentBy);
      sent += 1;
    } catch {
      // Best-effort per broadcast (see above).
    }
  }
  return { checked, sent };
}

/** One-way transition from draft/scheduled to sent, with notifications fanned out to the audience. */
export async function sendBroadcast(
  id: string,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<BroadcastView> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('broadcastId is required');
  const ref = firestore.collection('broadcasts').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Broadcast not found');
  const current = mapBroadcast(ref.id, snap.data());
  if (!current) throw new Error('Broadcast not found');
  if (current.status === 'sent') {
    throw new Error('Broadcast already sent');
  }
  const recipients = await resolveRecipients(current.audience);
  let delivered = 0;
  for (const uid of recipients) {
    try {
      await createNotification({
        recipientUid: uid,
        type: 'system',
        title: current.title,
        body: current.message,
      });
      delivered += 1;
    } catch {
      // Best-effort per recipient.
    }
  }
  await ref.update({
    status: 'sent',
    sentAt: Timestamp.now(),
    recipients: delivered,
    updatedAt: Timestamp.now(),
  });
  const updated = await ref.get();
  const view = mapBroadcast(ref.id, updated.data());
  if (!view) throw new Error('Could not read sent broadcast');
  await logAdminAction({
    category: 'Broadcasts',
    action: 'broadcast.send',
    adminUid,
    adminEmail,
    description: `Sent broadcast "${current.title}"`,
    targetId: normalizedId,
    targetLabel: current.title,
    before: { status: current.status },
    after: { status: 'sent', recipients: delivered },
  });
  return view;
}
