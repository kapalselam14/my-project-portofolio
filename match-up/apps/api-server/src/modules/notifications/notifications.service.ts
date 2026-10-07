import { Timestamp } from 'firebase-admin/firestore';
import { firestore, messaging } from '../../database/firebase.js';
import { userNotificationDocPath, userNotificationsCollectionPath } from '../../database/paths.js';
import { deleteDevice, listDevices } from '../devices/devices.service.js';

export type NotificationType =
  | 'activity_reminder'
  | 'activity_interest'
  | 'activity_joined'
  | 'activity_updated'
  | 'activity_cancelled'
  | 'activity_completed'
  | 'activity_left'
  | 'participant_removed'
  | 'chat_message'
  | 'dm_message'
  | 'join_request'
  | 'system';

export type CreateNotificationInput = {
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  activityId?: string;
  senderUid?: string;
  // Who the notification is for when the same type reaches different roles
  // (e.g. `activity_joined` goes to the host on instant join and to the
  // joiner on approval) so clients can route the tap to the right screen.
  audience?: NotificationAudience;
};

export type NotificationAudience = 'host' | 'member';

export type NotificationRecord = {
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  readAt?: FirebaseFirestore.Timestamp;
  activityId?: string;
  senderUid?: string;
  audience?: NotificationAudience;
};

export type NotificationWithId = NotificationRecord & {
  notificationId: string;
};

/** Renders an admin-curated template (`notificationTemplates/{trigger}`). */
export async function renderTemplate(
  trigger: string,
  vars: Record<string, string>,
): Promise<{ title: string; body: string } | null> {
  // Template lookup is best-effort; callers retain their fallback copy when config is absent.
  try {
    const snap = await firestore.collection('notificationTemplates').doc(trigger).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || data.enabled === false) return null;
    const { title, body } = data;
    if (typeof title !== 'string' || typeof body !== 'string') {
      return null;
    }
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
    return { title: fill(title), body: fill(body) };
  } catch {
    return null;
  }
}

/** Best-effort display name for template variables (falls back to ''). */
export async function displayNameOf(uid: string): Promise<string> {
  try {
    const snap = await firestore.collection('users').doc(uid).get();
    const name = snap.exists ? snap.data()?.displayName : undefined;
    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

function assertNotificationType(type: unknown): asserts type is NotificationType {
  if (
    type !== 'activity_reminder' &&
    type !== 'activity_interest' &&
    type !== 'activity_joined' &&
    type !== 'activity_updated' &&
    type !== 'activity_cancelled' &&
    type !== 'activity_completed' &&
    type !== 'activity_left' &&
    type !== 'participant_removed' &&
    type !== 'chat_message' &&
    type !== 'dm_message' &&
    type !== 'join_request' &&
    type !== 'system'
  ) {
    throw new Error(
      'type must be activity_reminder, activity_interest, activity_joined, activity_updated, activity_cancelled, activity_completed, activity_left, participant_removed, chat_message, join_request, or system',
    );
  }
}

function mapNotificationDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): NotificationWithId {
  const data = doc.data();

  if (typeof data.recipientUid !== 'string') {
    throw new Error('Invalid notification record: recipientUid must be a string');
  }

  assertNotificationType(data.type);

  if (typeof data.title !== 'string') {
    throw new Error('Invalid notification record: title must be a string');
  }

  if (typeof data.body !== 'string') {
    throw new Error('Invalid notification record: body must be a string');
  }

  if (typeof data.isRead !== 'boolean') {
    throw new Error('Invalid notification record: isRead must be a boolean');
  }

  if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
    throw new Error('Invalid notification record: createdAt must be a Firestore Timestamp');
  }

  if (
    data.readAt !== undefined &&
    (!data.readAt || typeof data.readAt !== 'object' || !('toDate' in data.readAt))
  ) {
    throw new Error('Invalid notification record: readAt must be a Firestore Timestamp');
  }

  if (data.activityId !== undefined && typeof data.activityId !== 'string') {
    throw new Error('Invalid notification record: activityId must be a string');
  }

  if (data.senderUid !== undefined && typeof data.senderUid !== 'string') {
    throw new Error('Invalid notification record: senderUid must be a string');
  }

  if (data.audience !== undefined && data.audience !== 'host' && data.audience !== 'member') {
    throw new Error("Invalid notification record: audience must be 'host' or 'member'");
  }

  return {
    notificationId: doc.id,
    recipientUid: data.recipientUid,
    type: data.type,
    title: data.title,
    body: data.body,
    isRead: data.isRead,
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    ...(data.readAt !== undefined ? { readAt: data.readAt as FirebaseFirestore.Timestamp } : {}),
    ...(typeof data.activityId === 'string' ? { activityId: data.activityId } : {}),
    ...(typeof data.senderUid === 'string' ? { senderUid: data.senderUid } : {}),
    ...(data.audience === 'host' || data.audience === 'member' ? { audience: data.audience } : {}),
  };
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ notificationId: string }> {
  const recipientUid = input.recipientUid.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  const type = input.type;

  if (!recipientUid) {
    throw new Error('recipientUid is required');
  }

  assertNotificationType(type);

  if (!title) {
    throw new Error('title is required');
  }

  if (!body) {
    throw new Error('body is required');
  }

  const notificationRef = firestore.collection(userNotificationsCollectionPath(recipientUid)).doc();

  const record: NotificationRecord = {
    recipientUid,
    type,
    title,
    body,
    isRead: false,
    createdAt: Timestamp.now(),
    ...(typeof input.activityId === 'string' && input.activityId.trim()
      ? { activityId: input.activityId.trim() }
      : {}),
    ...(typeof input.senderUid === 'string' && input.senderUid.trim()
      ? { senderUid: input.senderUid.trim() }
      : {}),
    ...(input.audience === 'host' || input.audience === 'member'
      ? { audience: input.audience }
      : {}),
  };

  // Save the in-app notification first; push delivery is a non-blocking side effect.
  await notificationRef.set(record);

  // Bridge the in-app feed to the OS: deliver an FCM push without blocking the caller (chat sends stay fast).
  deliverPush({
    recipientUid,
    title,
    body,
    type,
    ...(typeof input.activityId === 'string' && input.activityId.trim()
      ? { activityId: input.activityId.trim() }
      : {}),
    ...(typeof input.senderUid === 'string' && input.senderUid.trim()
      ? { senderUid: input.senderUid.trim() }
      : {}),
    ...(input.audience === 'host' || input.audience === 'member'
      ? { audience: input.audience }
      : {}),
  }).catch(() => undefined);

  return {
    notificationId: notificationRef.id,
  };
}

/** Sends an FCM push for an already-persisted notification. */
export async function deliverPush(input: {
  recipientUid: string;
  title: string;
  body: string;
  type: NotificationType;
  activityId?: string;
  senderUid?: string;
  audience?: NotificationAudience;
}): Promise<{ delivered: number }> {
  try {
    const devices = await listDevices(input.recipientUid);
    const byToken = new Map<string, string>();
    for (const d of devices) {
      const token = d.fcmToken?.trim();
      if (token && !byToken.has(token)) byToken.set(token, d.deviceId);
    }
    if (byToken.size === 0) return { delivered: 0 };

    // Send once per distinct token, even if multiple device records share it.
    const tokens = [...byToken.keys()];
    const data: Record<string, string> = { type: input.type };
    if (input.activityId) data.activityId = input.activityId;
    if (input.senderUid) data.senderUid = input.senderUid;
    if (input.audience) data.audience = input.audience;

    const batch = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: input.title, body: input.body },
      data,
      android: {
        priority: 'high' as const,
        // Brand the shade row like every other app: monochrome status glyph (`drawable/ic_stat_matchup.xml`.
        notification: {
          icon: 'ic_stat_matchup',
          color: '#0B1F8A',
        },
      },
    });

    let delivered = batch.successCount;
    // Prune dead tokens one by one; each prune is independent.
    await Promise.all(
      batch.responses.map((r, i) => {
        if (r.success) return Promise.resolve();
        const code = r.error?.code ?? '';
        if (
          code !== 'messaging/registration-token-not-registered' &&
          code !== 'messaging/invalid-registration-token'
        ) {
          return Promise.resolve();
        }
        const deviceId = byToken.get(tokens[i]!);
        if (!deviceId) return Promise.resolve();
        return deleteDevice(input.recipientUid, deviceId).catch(() => undefined);
      }),
    );

    return { delivered };
  } catch {
    return { delivered: 0 };
  }
}

export async function listNotifications(uid: string): Promise<NotificationWithId[]> {
  const normalizedUid = uid.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const snap = await firestore
    .collection(userNotificationsCollectionPath(normalizedUid))
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(mapNotificationDoc);
}

/** Return unread entries from the user's notification list. */
export async function listUnread(uid: string): Promise<NotificationWithId[]> {
  const all = await listNotifications(uid);
  return all.filter((n) => !n.isRead);
}

/** Marks every unread notification read in batches of 500 (Firestore batch limit). */
export async function markAllRead(uid: string): Promise<{ marked: number }> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('uid is required');
  const unread = await listUnread(normalizedUid);
  if (unread.length === 0) return { marked: 0 };
  const now = Timestamp.now();
  let marked = 0;
  // Firestore batches cap writes at 500 operations, so large inboxes need multiple commits.
  for (let i = 0; i < unread.length; i += 500) {
    const batch = firestore.batch();
    for (const n of unread.slice(i, i + 500)) {
      batch.update(firestore.doc(userNotificationDocPath(normalizedUid, n.notificationId)), {
        isRead: true,
        readAt: now,
      });
    }
    await batch.commit();
    marked += Math.min(500, unread.length - i);
  }
  return { marked };
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  const normalizedUid = uid.trim();
  const normalizedNotificationId = notificationId.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  if (!normalizedNotificationId) {
    throw new Error('notificationId is required');
  }

  const notificationRef = firestore.doc(
    userNotificationDocPath(normalizedUid, normalizedNotificationId),
  );

  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(notificationRef);

    if (!snap.exists) {
      throw new Error('Notification not found');
    }

    transaction.update(notificationRef, {
      isRead: true,
      readAt: Timestamp.now(),
    });
  });
}
