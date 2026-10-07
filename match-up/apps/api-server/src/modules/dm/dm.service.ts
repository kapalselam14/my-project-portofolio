import { rtdb } from '../../database/firebase.js';
import {
  dmMessagesPath,
  dmThreadId,
  userDmEntryPath,
  userDmInboxPath,
} from '../../database/paths.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getPublicUserProfile, getUserByAuthUid } from '../users/users.service.js';

export type DmMessageWithId = {
  messageId: string;
  senderId: string;
  text: string;
  timestamp: number;
};

function assertPeer(viewerUid: string, peerUid: string): { me: string; peer: string } {
  const me = viewerUid.trim();
  const peer = peerUid.trim();
  if (!me) throw new Error('viewerUid is required');
  if (!peer) throw new Error('peer uid is required');
  if (me === peer) throw new Error('cannot message yourself');
  return { me, peer };
}

async function assertPeerExists(peer: string): Promise<void> {
  const user = await getUserByAuthUid(peer);
  if (!user) throw new Error('User not found');
}

/**
 * Resolves (no write) the canonical 1-on-1 thread for the viewer +
 * peer pair. Both directions map to the same `conversationId`, so
 * clients can derive it locally for RTDB watches.
 */
export async function resolveThread(
  viewerUid: string,
  peerUid: string,
): Promise<{ conversationId: string }> {
  const { me, peer } = assertPeer(viewerUid, peerUid);
  await assertPeerExists(peer);
  return { conversationId: dmThreadId(me, peer) };
}

export async function listDmMessages(
  viewerUid: string,
  peerUid: string,
  limit = 50,
): Promise<DmMessageWithId[]> {
  const { me, peer } = assertPeer(viewerUid, peerUid);
  await assertPeerExists(peer);

  const snapshot = await rtdb.ref(dmMessagesPath(me, peer)).get();
  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<string, Partial<DmMessageWithId>> | null;
  if (!data) return [];

  const messages: DmMessageWithId[] = [];
  for (const [messageId, value] of Object.entries(data)) {
    if (!value) continue;
    if (typeof value.senderId !== 'string') {
      throw new Error('Invalid DM: senderId must be a string');
    }
    if (typeof value.text !== 'string') {
      throw new Error('Invalid DM: text must be a string');
    }
    if (typeof value.timestamp !== 'number') {
      throw new Error('Invalid DM: timestamp must be a number');
    }
    messages.push({
      messageId,
      senderId: value.senderId,
      text: value.text,
      timestamp: value.timestamp,
    });
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages.slice(-Math.min(Math.max(limit, 1), 100));
}

export async function sendDmMessage(
  viewerUid: string,
  peerUid: string,
  text: string,
): Promise<{ messageId: string; conversationId: string }> {
  const { me, peer } = assertPeer(viewerUid, peerUid);
  const normalizedText = text.trim();
  if (!normalizedText) throw new Error('text is required');
  if (normalizedText.length > 2000) {
    throw new Error('text must be at most 2000 characters');
  }
  await assertPeerExists(peer);

  const conversationId = dmThreadId(me, peer);
  const messageRef = rtdb.ref(dmMessagesPath(me, peer));
  const newMessageRef = messageRef.push();
  const now = Date.now();
  await newMessageRef.set({
    senderId: me,
    text: normalizedText,
    timestamp: now,
  });

  // Maintain per-user inbox metadata (last message + unread) so
  // `GET /api/dm/conversations` is a single cheap read. Best-effort:
  // a metadata failure must not fail the send itself.
  try {
    await updateInboxEntries(me, peer, normalizedText, now);
  } catch {
    // Swallowed by design — the message is already persisted.
  }

  // Nudge the peer (fire-and-forget inside createNotification's own
  // push bridge — failures never fail the send).
  let senderName = 'Someone';
  try {
    const profile = await getPublicUserProfile(me);
    if (profile?.displayName) senderName = profile.displayName;
  } catch {
    // Fall through to the generic name.
  }
  await createNotification({
    recipientUid: peer,
    type: 'dm_message',
    title: `New message from ${senderName}`,
    body: dmPreviewBody(normalizedText),
    senderUid: me,
  }).catch(() => undefined);

  return { messageId: newMessageRef.key as string, conversationId };
}

/**
 * Push/inbox preview: never leak a raw Storage URL or maps link into a
 * notification body. Mirrors the mobile `ChatMessage.previewText` and
 * `parseSharedLocation` conventions (same wire format).
 */
export function dmPreviewBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('📍 Shared location:')) return '📍 Shared location';
  if (/^https?:\/\/\S+$/.test(trimmed)) return '📷 Photo';
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export type DmConversationView = {
  peerUid: string;
  displayName: string;
  photoUrl?: string;
  lastText: string;
  lastTimestamp: number;
  lastSenderId: string;
  unreadCount: number;
};

type DmInboxEntry = {
  peerUid: string;
  lastText: string;
  lastTimestamp: number;
  lastSenderId: string;
  unreadCount: number;
};

/**
 * Writes both sides' inbox entries after a send. RTDB transactions ensure
 * concurrent sends do not overwrite unread-count increments. The recipient's
 * unread count increases by one; the sender's count is preserved.
 * If two messages are sent concurrently, the last one to complete will
 * update the inbox with its metadata. This is acceptable for an MVP inbox;
 * the messages themselves are never lost.
 */
async function updateInboxEntries(
  senderUid: string,
  peerUid: string,
  text: string,
  now: number,
): Promise<void> {
  const peerRef = rtdb.ref(userDmEntryPath(peerUid, senderUid));

  await peerRef.transaction((current) => {
    const previous =
      current && typeof current === 'object' ? (current as Partial<DmInboxEntry>) : {};

    const previousUnread =
      typeof previous.unreadCount === 'number' ? Math.max(0, previous.unreadCount) : 0;

    const previousTimestamp =
      typeof previous.lastTimestamp === 'number' ? previous.lastTimestamp : 0;

    // Preserve newer metadata if concurrent sends complete out of order,
    // while still incrementing the recipient's unread count atomically.
    const isNewerMessage = now >= previousTimestamp;

    return {
      peerUid: senderUid,
      lastText: isNewerMessage
        ? text
        : typeof previous.lastText === 'string'
          ? previous.lastText
          : text,
      lastTimestamp: isNewerMessage ? now : previousTimestamp,
      lastSenderId: isNewerMessage
        ? senderUid
        : typeof previous.lastSenderId === 'string'
          ? previous.lastSenderId
          : senderUid,
      unreadCount: previousUnread + 1,
    } satisfies DmInboxEntry;
  });

  const senderRef = rtdb.ref(userDmEntryPath(senderUid, peerUid));

  await senderRef.transaction((current) => {
    const previous =
      current && typeof current === 'object' ? (current as Partial<DmInboxEntry>) : {};

    const previousUnread =
      typeof previous.unreadCount === 'number' ? Math.max(0, previous.unreadCount) : 0;

    const previousTimestamp =
      typeof previous.lastTimestamp === 'number' ? previous.lastTimestamp : 0;

    const isNewerMessage = now >= previousTimestamp;

    return {
      peerUid,
      lastText: isNewerMessage
        ? text
        : typeof previous.lastText === 'string'
          ? previous.lastText
          : text,
      lastTimestamp: isNewerMessage ? now : previousTimestamp,
      lastSenderId: isNewerMessage
        ? senderUid
        : typeof previous.lastSenderId === 'string'
          ? previous.lastSenderId
          : senderUid,
      // The sender's own message does not increase their unread count.
      unreadCount: previousUnread,
    } satisfies DmInboxEntry;
  });
}

/**
 * Inbox for the viewer: every thread with metadata, newest first,
 * enriched with peer display names/photos (best-effort — falls back
 * to raw uids when the profile lookup fails).
 */
export async function listDmConversations(viewerUid: string): Promise<DmConversationView[]> {
  const me = viewerUid.trim();
  if (!me) throw new Error('viewerUid is required');

  const snapshot = await rtdb.ref(userDmInboxPath(me)).get();
  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<string, Partial<DmInboxEntry>> | null;
  if (!data) return [];

  const views: DmConversationView[] = [];
  for (const [peerUid, entry] of Object.entries(data)) {
    if (!entry) continue;
    let displayName = peerUid;
    let photoUrl: string | undefined;
    try {
      const profile = await getPublicUserProfile(peerUid);
      if (profile?.displayName) displayName = profile.displayName;
      if (typeof profile?.photoUrl === 'string' && profile.photoUrl) {
        photoUrl = profile.photoUrl;
      }
    } catch {
      // Fall through to raw-uid rendering.
    }
    views.push({
      peerUid,
      displayName,
      ...(photoUrl !== undefined ? { photoUrl } : {}),
      lastText: typeof entry.lastText === 'string' ? entry.lastText : '',
      lastTimestamp: typeof entry.lastTimestamp === 'number' ? entry.lastTimestamp : 0,
      lastSenderId: typeof entry.lastSenderId === 'string' ? entry.lastSenderId : '',
      unreadCount: typeof entry.unreadCount === 'number' ? entry.unreadCount : 0,
    });
  }

  views.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return views;
}

/**
 * Clears the unread badge for one thread (called when the viewer
 * opens it). No-op when no metadata exists yet. Never throws for a
 * missing entry — opening a thread with zero history is valid.
 */
export async function markDmThreadRead(viewerUid: string, peerUid: string): Promise<void> {
  const me = viewerUid.trim();
  const peer = peerUid.trim();

  if (!me) throw new Error('viewerUid is required');
  if (!peer) throw new Error('peer uid is required');

  const ref = rtdb.ref(userDmEntryPath(me, peer));

  await ref.transaction((current) => {
    if (!current || typeof current !== 'object') {
      return current;
    }

    const previous = current as Partial<DmInboxEntry>;

    return {
      peerUid: typeof previous.peerUid === 'string' ? previous.peerUid : peer,
      lastText: typeof previous.lastText === 'string' ? previous.lastText : '',
      lastTimestamp: typeof previous.lastTimestamp === 'number' ? previous.lastTimestamp : 0,
      lastSenderId: typeof previous.lastSenderId === 'string' ? previous.lastSenderId : '',
      unreadCount: 0,
    } satisfies DmInboxEntry;
  });
}
