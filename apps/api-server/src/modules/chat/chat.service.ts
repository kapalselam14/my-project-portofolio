import { firestore, rtdb } from '../../database/firebase.js';
import {
  activityDocPath,
  activityMessagePath,
  activityMessageReactionsPath,
  activityMessagesPath,
  activityPollPath,
  activityPollVotesPath,
  activityPollsPath,
  activityReactionPath,
  activityReactionsPath,
} from '../../database/paths.js';
import { resolveEndMs } from '../activities/activity-lifecycle.service.js';
import { getActivityById, listMyActivities } from '../activities/activities.service.js';
import { getParticipants } from '../activities/activity-participants.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getPublicUserProfile } from '../users/users.service.js';
import type { ReactionEmoji } from './chat.schema.js';

/** Media message kinds. */
export type ChatMessageType = 'text' | 'system' | 'image' | 'location';

export type ChatMessageRecord = {
  senderId: string;
  text: string;
  type: ChatMessageType;
  timestamp: number;
};

export type ChatMessageWithId = ChatMessageRecord & {
  messageId: string;
};

/** Archive policy (best practice, Meetup/TeamSnap-style): chats stay readable forever. */
export const CHAT_ARCHIVE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Pure archive rule — unit-testable without Firestore. */
export function isChatArchived(input: {
  status: unknown;
  endMs: number | null;
  nowMs: number;
}): boolean {
  const { status, endMs, nowMs } = input;
  // Cancelled/removed games will never happen — close immediately.
  if (status === 'cancelled' || status === 'removed') return true;
  if (endMs === null || Number.isNaN(endMs)) return false;
  return endMs + CHAT_ARCHIVE_GRACE_MS <= nowMs;
}

/** Throws `Activity not found` / `Chat is archived` unless the thread accepts writes. */
export async function assertChatWritable(activityId: string): Promise<void> {
  const normalizedActivityId = activityId.trim();
  if (!normalizedActivityId) throw new Error('activityId is required');

  const snap = await firestore.doc(activityDocPath(normalizedActivityId)).get();
  if (!snap.exists) throw new Error('Activity not found');

  const data = snap.data();
  if (
    isChatArchived({
      status: data?.status,
      endMs: data ? resolveEndMs(data) : null,
      nowMs: Date.now(),
    })
  ) {
    throw new Error('Chat is archived');
  }
}

export async function sendMessage(
  activityId: string,
  senderId: string,
  text: string,
  messageType: ChatMessageType = 'text',
): Promise<{ messageId: string }> {
  const normalizedActivityId = activityId.trim();
  const normalizedSenderId = senderId.trim();
  const normalizedText = text.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');

  if (!normalizedSenderId) throw new Error('senderId is required');

  if (!normalizedText) {
    throw new Error('text is required');
  }

  if (
    messageType !== 'text' &&
    messageType !== 'system' &&
    messageType !== 'image' &&
    messageType !== 'location'
  ) {
    throw new Error('messageType must be text, system, image, or location');
  }

  await assertChatWritable(normalizedActivityId);

  const messageRef = rtdb.ref(activityMessagesPath(normalizedActivityId));
  const newMessageRef = messageRef.push();

  await newMessageRef.set({
    senderId: normalizedSenderId,
    text: normalizedText,
    type: messageType,
    timestamp: Date.now(),
  } satisfies ChatMessageRecord);

  // Nudge every other member (fire-and-forget — a notification failure must never fail the send).
  notifyGroupMembers(normalizedActivityId, normalizedSenderId, normalizedText).catch(
    () => undefined,
  );

  return {
    messageId: newMessageRef.key as string,
  };
}

/** Fans a `chat_message` notification out to all participants (plus the host) except the sender. */
export async function notifyGroupMembers(
  activityId: string,
  senderId: string,
  text: string,
): Promise<void> {
  try {
    const [activity, participants] = await Promise.all([
      getActivityById(activityId).catch(() => null),
      getParticipants(activityId).catch(() => []),
    ]);
    const uids = new Set<string>();
    for (const p of participants) {
      if (typeof p.uid === 'string' && p.uid && p.uid !== senderId) {
        uids.add(p.uid);
      }
    }
    const hostId = activity?.hostId;
    if (typeof hostId === 'string' && hostId && hostId !== senderId) {
      uids.add(hostId);
    }
    if (uids.size === 0) return;

    let senderName = 'Someone';
    try {
      const profile = await getPublicUserProfile(senderId);
      if (profile?.displayName) senderName = profile.displayName;
    } catch {
      // Fall through to the generic name.
    }
    const title = activity?.title
      ? `${senderName} in ${activity.title}`
      : `New message from ${senderName}`;

    await Promise.all(
      [...uids].map((uid) =>
        createNotification({
          recipientUid: uid,
          type: 'chat_message',
          title,
          body: chatPreviewBody(text),
          activityId,
          senderUid: senderId,
        }).catch(() => undefined),
      ),
    );
  } catch {
    // Swallowed by design — the message is already persisted.
  }
}

/** Validates a client-uploaded image URL and stores it as an `image` message (text = the URL). */
export async function sendImageMessage(
  activityId: string,
  senderId: string,
  imageUrl: string,
): Promise<{ messageId: string }> {
  const url = imageUrl.trim();
  if (!/^https:\/\/\S+$/i.test(url)) {
    throw new Error('imageUrl must be an https URL');
  }
  if (url.length > 2000) {
    throw new Error('imageUrl must be at most 2000 characters');
  }
  return sendMessage(activityId, senderId, url, 'image');
}

/** Builds the shareable maps link stored as a `location` message text. */
export function locationShareText(latitude: number, longitude: number): string {
  return `Shared location: https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Validates a shared coordinate pair and stores it as a `location` message (text = `locationShareText`). */
export async function sendLocationMessage(
  activityId: string,
  senderId: string,
  latitude: number,
  longitude: number,
): Promise<{ messageId: string }> {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('latitude must be a number between -90 and 90');
  }
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('longitude must be a number between -180 and 180');
  }
  return sendMessage(activityId, senderId, locationShareText(latitude, longitude), 'location');
}

export type ConversationPreview = {
  activityId: string;
  title: string;
  lastMessage: string | null;
  lastMessageAt: number | null;
  /** Per-user read receipts don't exist yet, so this is best-effort 0. */
  unreadCount: number;
};

/** Group inbox: every live activity the viewer hosts or joined, newest message first, with a text preview +. */
export async function listConversations(uid: string): Promise<ConversationPreview[]> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('uid is required');
  const [hosted, joined] = await Promise.all([
    listMyActivities(normalizedUid, 'hosted', 50, 0).catch(() => []),
    listMyActivities(normalizedUid, 'joined', 50, 0).catch(() => []),
  ]);
  const seen = new Map<string, (typeof hosted)[number]>();
  for (const a of [...hosted, ...joined]) {
    if (!seen.has(a.activityId)) seen.set(a.activityId, a);
  }
  const previews = await Promise.all(
    [...seen.values()].map(async (activity) => {
      let lastMessage: string | null = null;
      let lastMessageAt: number | null = null;
      try {
        const messages = await getMessages(activity.activityId);
        const last = messages[messages.length - 1];
        if (last) {
          lastMessage = chatPreviewBody(last.text);
          lastMessageAt = last.timestamp;
        }
      } catch {
        // Best-effort per thread (see above).
      }
      return {
        activityId: activity.activityId,
        title: activity.title,
        lastMessage,
        lastMessageAt,
        unreadCount: 0,
      } satisfies ConversationPreview;
    }),
  );
  previews.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  return previews;
}

/** Inbox preview: never leak a raw URL or maps link into the push. */
function chatPreviewBody(text: string): string {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    if (/maps\.google\.|openstreetmap\.|osm\.org/i.test(trimmed)) {
      return '📍 Shared a location';
    }
    return '📷 Sent a photo';
  }
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export async function getMessages(activityId: string): Promise<ChatMessageWithId[]> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');

  const snapshot = await rtdb.ref(activityMessagesPath(normalizedActivityId)).get();

  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<string, Partial<ChatMessageRecord>> | null;

  if (!data) return [];

  const messages: ChatMessageWithId[] = [];

  for (const [messageId, value] of Object.entries(data)) {
    if (!value) continue;

    // Skip malformed rows instead of throwing: one corrupt message must never 500 the whole thread.
    if (typeof value.senderId !== 'string' || value.senderId.trim() === '') continue;

    if (typeof value.text !== 'string' || value.text.trim() === '') continue;

    if (
      value.type !== 'text' &&
      value.type !== 'system' &&
      value.type !== 'image' &&
      value.type !== 'location'
    )
      continue;

    if (typeof value.timestamp !== 'number') continue;

    messages.push({
      messageId,
      senderId: value.senderId,
      text: value.text,
      type: value.type,
      timestamp: value.timestamp,
    });
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);

  return messages;
}

/** Reactions live beside messages, not inside them: `activityChats/{activityId}/reactions/{messageId}/{emoji}/{uid}. */
export type ReactionMap = Record<string, Record<string, string[]>>;

export async function toggleReaction(
  activityId: string,
  messageId: string,
  uid: string,
  emoji: ReactionEmoji,
): Promise<{ reacted: boolean }> {
  const normalizedActivityId = activityId.trim();
  const normalizedMessageId = messageId.trim();
  const normalizedUid = uid.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');
  if (!normalizedMessageId) throw new Error('messageId is required');
  if (!normalizedUid) throw new Error('uid is required');

  const messageSnap = await rtdb
    .ref(activityMessagePath(normalizedActivityId, normalizedMessageId))
    .get();
  if (!messageSnap.exists()) throw new Error('Message not found');

  await assertChatWritable(normalizedActivityId);

  const reactionRef = rtdb.ref(
    activityReactionPath(normalizedActivityId, normalizedMessageId, emoji, normalizedUid),
  );
  const existing = await reactionRef.get();

  if (existing.exists()) {
    await reactionRef.remove();
    return { reacted: false };
  }

  await reactionRef.set(Date.now());
  return { reacted: true };
}

export async function getReactions(activityId: string): Promise<ReactionMap> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');

  const snapshot = await rtdb.ref(activityReactionsPath(normalizedActivityId)).get();

  if (!snapshot.exists()) return {};

  const data = snapshot.val() as Record<string, Record<string, Record<string, unknown>>> | null;

  if (!data) return {};

  const reactions: ReactionMap = {};

  for (const [messageId, byEmoji] of Object.entries(data)) {
    if (!byEmoji || typeof byEmoji !== 'object') continue;
    for (const [emoji, byUid] of Object.entries(byEmoji)) {
      if (!byUid || typeof byUid !== 'object') continue;
      const uids = Object.keys(byUid).filter((uid) => typeof uid === 'string' && uid.length > 0);
      if (uids.length === 0) continue;
      (reactions[messageId] ??= {})[emoji] = uids;
    }
  }

  return reactions;
}

export async function getMessageReactions(
  activityId: string,
  messageId: string,
): Promise<Record<string, string[]>> {
  const all = await getReactions(activityId);
  return all[messageId.trim()] ?? {};
}

export type PollRecord = {
  question: string;
  options: string[];
  createdBy: string;
  createdAt: number;
  votes: Record<string, string[]>;
};

export type PollWithId = PollRecord & {
  pollId: string;
};

export async function createPoll(
  activityId: string,
  uid: string,
  question: string,
  options: string[],
): Promise<{ pollId: string }> {
  const normalizedActivityId = activityId.trim();
  const normalizedUid = uid.trim();
  const normalizedQuestion = question.trim();
  const normalizedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

  if (!normalizedActivityId) throw new Error('activityId is required');
  if (!normalizedUid) throw new Error('uid is required');
  if (!normalizedQuestion) throw new Error('question is required');
  if (normalizedOptions.length < 2) throw new Error('at least 2 options are required');

  await assertChatWritable(normalizedActivityId);

  const pollsRef = rtdb.ref(activityPollsPath(normalizedActivityId));
  const newPollRef = pollsRef.push();

  await newPollRef.set({
    question: normalizedQuestion,
    options: normalizedOptions.slice(0, 6),
    createdBy: normalizedUid,
    createdAt: Date.now(),
    votes: {},
  });

  return { pollId: newPollRef.key as string };
}

function normalizePollVotes(raw: unknown): Record<string, string[]> {
  const votes: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return votes;
  for (const [optionIndex, byUid] of Object.entries(raw as Record<string, unknown>)) {
    if (!byUid || typeof byUid !== 'object') continue;
    if (!/^\d+$/.test(optionIndex)) continue;
    const uids = Object.keys(byUid as Record<string, unknown>).filter(
      (uid) => typeof uid === 'string' && uid.length > 0,
    );
    if (uids.length === 0) continue;
    votes[optionIndex] = uids;
  }
  return votes;
}

export async function getPolls(activityId: string): Promise<PollWithId[]> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');

  const snapshot = await rtdb.ref(activityPollsPath(normalizedActivityId)).get();

  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<string, Record<string, unknown>> | null;

  if (!data) return [];

  const polls: PollWithId[] = [];

  for (const [pollId, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object') continue;
    if (typeof value.question !== 'string' || !Array.isArray(value.options)) continue;
    if (typeof value.createdBy !== 'string' || typeof value.createdAt !== 'number') continue;
    const options = (value.options as unknown[]).filter(
      (o): o is string => typeof o === 'string' && o.length > 0,
    );
    if (options.length < 2) continue;
    polls.push({
      pollId,
      question: value.question,
      options,
      createdBy: value.createdBy,
      createdAt: value.createdAt,
      votes: normalizePollVotes(value.votes),
    });
  }

  polls.sort((a, b) => a.createdAt - b.createdAt);

  return polls;
}

/** Single-choice vote: the member's uid is removed from every option, then added to [optionIndex]. */
export async function votePoll(
  activityId: string,
  pollId: string,
  uid: string,
  optionIndex: number,
): Promise<{ voted: boolean }> {
  const normalizedActivityId = activityId.trim();
  const normalizedPollId = pollId.trim();
  const normalizedUid = uid.trim();

  if (!normalizedActivityId) throw new Error('activityId is required');
  if (!normalizedPollId) throw new Error('pollId is required');
  if (!normalizedUid) throw new Error('uid is required');

  const pollSnap = await rtdb.ref(activityPollPath(normalizedActivityId, normalizedPollId)).get();
  if (!pollSnap.exists()) throw new Error('Poll not found');

  await assertChatWritable(normalizedActivityId);

  const poll = pollSnap.val() as { options?: unknown; votes?: unknown };
  const options = Array.isArray(poll?.options) ? poll.options : [];
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
    throw new Error('optionIndex is out of range');
  }

  const votesRef = rtdb.ref(activityPollVotesPath(normalizedActivityId, normalizedPollId));
  const votesSnap = await votesRef.get();
  const current = normalizePollVotes(votesSnap.exists() ? votesSnap.val() : {});

  const alreadyThere = (current[String(optionIndex)] ?? []).includes(normalizedUid);

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    updates[`${key}/${normalizedUid}`] = null;
  }
  if (!alreadyThere) {
    updates[`${optionIndex}/${normalizedUid}`] = Date.now();
  }
  await votesRef.update(updates);

  return { voted: !alreadyThere };
}
