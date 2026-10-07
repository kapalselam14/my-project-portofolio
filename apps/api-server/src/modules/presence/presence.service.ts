import { rtdb } from '../../database/firebase.js';
import { presencePath } from '../../database/paths.js';

export type PresenceState = 'online' | 'offline';

export type PresenceRecord = {
  state: PresenceState;
  lastChanged: number;
};

export async function setPresence(uid: string, state: PresenceState): Promise<void> {
  const normalizedUid = uid.trim();

  if (!normalizedUid) throw new Error('uid is required');

  const record: PresenceRecord = {
    state,
    // Store epoch milliseconds so clients can compare presence freshness without parsing a date.
    lastChanged: Date.now(),
  };

  await rtdb.ref(presencePath(normalizedUid)).set(record);
}

export async function getPresence(uid: string): Promise<PresenceRecord | null> {
  const normalizedUid = uid.trim();

  if (!normalizedUid) throw new Error('uid is required');

  const snapshot = await rtdb.ref(presencePath(normalizedUid)).get();

  if (!snapshot.exists()) return null;

  const data = snapshot.val() as Partial<PresenceRecord> | null;

  if (!data) return null;
  if (data.state !== 'online' && data.state !== 'offline')
    throw new Error('Invalid presence record: state must be online or offline');
  if (typeof data.lastChanged !== 'number')
    throw new Error('Invalid presence record: lastChanged must be a number');

  return {
    state: data.state,
    lastChanged: data.lastChanged,
  };
}
