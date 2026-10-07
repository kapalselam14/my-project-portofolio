import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { activityDocPath } from '../../database/paths.js';
import { getParticipants } from './activity-participants.service.js';
import { createNotification } from '../notifications/notifications.service.js';

/** Expiry sweeper for activities. The sweep never blocks a read — callers must NOT await it. */
export async function sweepExpiredActivities(options?: {
  nowMs?: number;
  limit?: number;
}): Promise<{ completed: number }> {
  // Complete elapsed activities in bounded batches so a background sweep stays predictable.
  const nowMs = options?.nowMs ?? Date.now();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  const snap = await firestore
    .collection('activities')
    .where('status', '==', 'open')
    .limit(limit)
    .get();

  let completed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const endMs = resolveEndMs(data);
    if (endMs === null || endMs > nowMs) continue;

    try {
      const flipped = await tryComplete(doc.id);
      if (!flipped) continue;
      completed += 1;
      await notifyCompleted(
        doc.id,
        typeof data.title === 'string' && data.title ? data.title : 'Your activity',
        typeof data.hostId === 'string' ? data.hostId : null,
      );
    } catch {
      // One bad row (malformed doc, torn write) must not abort the sweep.
      continue;
    }
  }

  return { completed };
}

/** Resolves the effective end of an activity in epoch ms. Returns null when neither is parseable. */
export function resolveEndMs(data: FirebaseFirestore.DocumentData): number | null {
  // Prefer an explicit end time, then fall back to the start time plus stored duration.
  const endRaw = data.endTime;
  if (typeof endRaw === 'string') {
    const ms = Date.parse(endRaw);
    if (!Number.isNaN(ms)) return ms;
  }
  const startRaw = data.startTime;
  if (typeof startRaw === 'string') {
    const ms = Date.parse(startRaw);
    if (!Number.isNaN(ms)) return ms + 2 * 60 * 60 * 1000;
  }
  return null;
}

/** Flips one activity to `completed` iff it is still `open`. Transactional so parallel sweepers never double-complete. */
async function tryComplete(activityId: string): Promise<boolean> {
  let flipped = false;
  await firestore.runTransaction(async (transaction) => {
    const ref = firestore.doc(activityDocPath(activityId));
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    if (snap.data()?.status !== 'open') return;
    transaction.update(ref, {
      status: 'completed',
      updatedAt: Timestamp.now(),
    });
    flipped = true;
  });
  return flipped;
}

async function notifyCompleted(
  activityId: string,
  title: string,
  hostId: string | null,
): Promise<void> {
  const recipients = new Set<string>();
  try {
    const roster = await getParticipants(activityId);
    for (const p of roster) {
      if (typeof p.uid === 'string' && p.uid) recipients.add(p.uid);
    }
  } catch {
    // Roster read failure degrades to host-only notification rather than dropping the nudge entirely.
  }
  if (hostId) recipients.add(hostId);
  if (recipients.size === 0) return;

  const body = `“${title}” has ended. Tap to rate your game.`;
  // Completion feeds the ratings loop — the nudge asks every participant to rate.
  await Promise.all(
    [...recipients].map((uid) =>
      createNotification({
        recipientUid: uid,
        type: 'activity_completed',
        title: 'Activity completed',
        body,
        activityId,
      }).catch(() => undefined),
    ),
  );
}
