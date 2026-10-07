import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1' }),
}));

vi.mock('./audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { firestore } from '../../database/firebase.js';
import { sweepDueBroadcasts } from './broadcasts.service.js';

type Store = Map<string, Record<string, unknown>>;

// Model scheduled rows in memory so due filtering and repeated-run behavior can be verified.
function mockSweepDb(seed: Record<string, Record<string, unknown>>) {
  const store: Store = new Map(Object.entries(seed));
  const docProxy = (id: string) => ({
    id,
    get: async () => {
      const data = store.get(id);
      return data === undefined ? { exists: false } : { exists: true, id, data: () => data };
    },
    set: vi.fn(async (record: Record<string, unknown>) => {
      store.set(id, record);
    }),
    update: vi.fn(async (patch: Record<string, unknown>) => {
      store.set(id, { ...(store.get(id) ?? {}), ...patch });
    }),
    delete: vi.fn(async () => {
      store.delete(id);
    }),
  });
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'broadcasts') {
      return {
        get: async () => ({
          docs: [...store.entries()].map(([id, data]) => ({
            id,
            data: () => data,
          })),
        }),
        where: vi.fn().mockReturnValue({
          get: async () => ({
            docs: [...store.entries()]
              .filter(([, data]) => data.status === 'scheduled')
              .map(([id, data]) => ({ id, data: () => data })),
          }),
        }),
        doc: docProxy,
      };
    }
    // Recipient resolution — no users, so sends deliver to nobody.
    if (name === 'users' || name === 'activities') {
      return {
        limit: vi.fn().mockReturnValue({
          get: async () => ({ docs: [] }),
        }),
      };
    }
    throw new Error(`unexpected collection ${name}`);
  }) as never);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sweepDueBroadcasts', () => {
  it('sends due scheduled broadcasts and skips future ones', async () => {
    const store = mockSweepDb({
      'due-1': {
        title: 'Now',
        message: 'Send me',
        audience: 'All Users',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
        sentAt: null,
        recipients: 0,
        createdBy: 'admin-1',
        createdAt: new Date().toISOString(),
      },
      'future-1': {
        title: 'Later',
        message: 'Not yet',
        audience: 'All Users',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        sentAt: null,
        recipients: 0,
        createdBy: 'admin-1',
        createdAt: new Date().toISOString(),
      },
      'draft-1': {
        title: 'Draft',
        message: 'Manual',
        audience: 'All Users',
        status: 'draft',
        scheduledAt: null,
        sentAt: null,
        recipients: 0,
        createdBy: 'admin-1',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await sweepDueBroadcasts(new Date());

    expect(result).toEqual({ checked: 2, sent: 1 });
    expect(store.get('due-1')!.status).toBe('sent');
    expect(store.get('future-1')!.status).toBe('scheduled');
    expect(store.get('draft-1')!.status).toBe('draft');
  });

  it('is idempotent — a second sweep sends nothing', async () => {
    mockSweepDb({
      'due-1': {
        title: 'Now',
        message: 'Send me',
        audience: 'All Users',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
        sentAt: null,
        recipients: 0,
        createdBy: 'admin-1',
        createdAt: new Date().toISOString(),
      },
    });

    await sweepDueBroadcasts(new Date());
    const second = await sweepDueBroadcasts(new Date());

    expect(second).toEqual({ checked: 0, sent: 0 });
  });
});
