import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Stateful in-memory RTDB fake: supports ref().get/set/update/push/transaction
 * over a plain Map so inbox entry lifecycles can be asserted.
 */
function makeRtdb() {
  const store = new Map<string, unknown>();

  const ref = (path: string) => ({
    push: () => {
      const key = `msg-${store.size + 1}`;

      return {
        key,
        set: async (value: unknown) => {
          store.set(`${path}/${key}`, value);
        },
      };
    },

    get: async () => {
      // Aggregate direct children like a real RTDB parent read.
      if (store.has(path)) {
        return {
          exists: () => true,
          val: () => store.get(path),
        };
      }

      const prefix = `${path}/`;
      const children: Record<string, unknown> = {};
      let found = false;

      for (const [key, value] of store) {
        if (!key.startsWith(prefix)) continue;

        const childKey = key.slice(prefix.length);

        // Only include direct children.
        if (childKey.includes('/')) continue;

        children[childKey] = value;
        found = true;
      }

      return {
        exists: () => found,
        val: () => (found ? children : null),
      };
    },

    set: async (value: unknown) => {
      store.set(path, value);
    },

    update: async (value: Record<string, unknown>) => {
      const existing = store.get(path);

      store.set(path, {
        ...(existing && typeof existing === 'object' ? existing : {}),
        ...value,
      });
    },

    transaction: async (update: (current: unknown) => unknown) => {
      const current = store.get(path);
      const updated = update(current);

      // Returning undefined aborts a Firebase transaction.
      if (updated !== undefined) {
        if (updated === null) {
          store.delete(path);
        } else {
          store.set(path, updated);
        }
      }

      return {
        committed: updated !== undefined,
        snapshot: {
          exists: () => updated !== undefined && updated !== null,
          val: () => (updated === undefined ? current : updated),
        },
      };
    },
  });

  return { store, ref };
}

const rtdbState = vi.hoisted(() => ({
  current: null as null | ReturnType<typeof makeRtdb>,
}));

vi.mock('../../database/firebase.js', () => ({
  rtdb: {
    ref: (path: string) => rtdbState.current!.ref(path),
  },
  firestore: {
    collection: vi.fn(),
    doc: vi.fn(),
  },
  auth: {},
  messaging: {},
}));

vi.mock('../users/users.service.js', () => ({
  getUserByAuthUid: vi.fn(async (uid: string) => ({
    authUid: uid,
  })),

  getPublicUserProfile: vi.fn(async (uid: string) => ({
    displayName: `Name-${uid}`,
  })),
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: vi.fn(async () => ({
    notificationId: 'n-1',
  })),
}));

import { listDmConversations, markDmThreadRead, sendDmMessage } from './dm.service.js';

beforeEach(() => {
  rtdbState.current = makeRtdb();
  vi.clearAllMocks();
});

describe('DM inbox metadata', () => {
  it('send bumps peer unread and keeps sender count', async () => {
    await sendDmMessage('me-1', 'peer-1', 'hello');
    await sendDmMessage('me-1', 'peer-1', 'again');

    const { store } = rtdbState.current!;

    const peerEntry = store.get('userDMs/peer-1/me-1') as Record<string, unknown>;

    const senderEntry = store.get('userDMs/me-1/peer-1') as Record<string, unknown>;

    expect(peerEntry.unreadCount).toBe(2);
    expect(peerEntry.lastText).toBe('again');
    expect(senderEntry.unreadCount).toBe(0);
    expect(senderEntry.lastSenderId).toBe('me-1');
  });

  it('a reply bumps the other side back', async () => {
    await sendDmMessage('me-1', 'peer-1', 'hi');
    await sendDmMessage('peer-1', 'me-1', 'yo');

    const { store } = rtdbState.current!;

    expect((store.get('userDMs/me-1/peer-1') as Record<string, unknown>).unreadCount).toBe(1);

    expect((store.get('userDMs/peer-1/me-1') as Record<string, unknown>).unreadCount).toBe(1);
  });

  it('listDmConversations returns newest-first enriched rows', async () => {
    await sendDmMessage('me-1', 'peer-1', 'first');

    // Distinct milliseconds make the recency sort deterministic.
    await new Promise((resolve) => setTimeout(resolve, 5));

    await sendDmMessage('me-1', 'peer-2', 'second');

    const rows = await listDmConversations('me-1');

    expect(rows.map((row) => row.peerUid)).toEqual(['peer-2', 'peer-1']);

    expect(rows[0]).toMatchObject({
      displayName: 'Name-peer-2',
      lastText: 'second',
      unreadCount: 0,
    });
  });

  it('markDmThreadRead clears the badge and is a no-op when absent', async () => {
    await sendDmMessage('peer-1', 'me-1', 'hey');

    let rows = await listDmConversations('me-1');
    expect(rows[0].unreadCount).toBe(1);

    await markDmThreadRead('me-1', 'peer-1');

    rows = await listDmConversations('me-1');
    expect(rows[0].unreadCount).toBe(0);

    await expect(markDmThreadRead('me-1', 'nobody')).resolves.toBeUndefined();
  });

  it('empty inbox returns empty list', async () => {
    await expect(listDmConversations('lonely')).resolves.toEqual([]);
  });
});
