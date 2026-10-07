// Tests for broadcasts.service.
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
import { logAdminAction } from './audit.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import {
  createBroadcast,
  deleteBroadcast,
  listBroadcasts,
  sendBroadcast,
  updateBroadcast,
} from './broadcasts.service.js';

type Store = Map<string, Record<string, unknown>>;

function mockBroadcasts(seed: Record<string, Record<string, unknown>> = {}) {
  const store: Store = new Map(Object.entries(seed));
  const users: Store = new Map([
    ['u-1', { createdAt: { toDate: () => new Date('2026-01-01T00:00:00Z') } }],
    ['u-2', { createdAt: { toDate: () => new Date('2026-09-01T00:00:00Z') } }],
  ]);
  const activities: Store = new Map([['a-1', { hostId: 'u-1' }]]);
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'broadcasts') {
      return {
        get: async () => ({
          docs: [...store.entries()].map(([id, data]) => ({
            id,
            data: () => data,
          })),
        }),
        doc: (id?: string) => {
          const key = id ?? `auto-${store.size + 1}`;
          return {
            id: key,
            get: async () => {
              const data = store.get(key);
              return data === undefined
                ? { exists: false }
                : { exists: true, id: key, data: () => data };
            },
            set: vi.fn().mockImplementation(async (record: Record<string, unknown>) => {
              store.set(key, record);
            }),
            update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
              store.set(key, { ...(store.get(key) ?? {}), ...patch });
            }),
            delete: vi.fn().mockImplementation(async () => {
              store.delete(key);
            }),
          };
        },
      };
    }
    if (name === 'users' || name === 'activities') {
      const target = name === 'users' ? users : activities;
      return {
        limit: vi.fn().mockReturnValue({
          get: async () => ({
            docs: [...target.entries()].map(([id, data]) => ({
              id,
              data: () => data,
            })),
          }),
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

describe('createBroadcast', () => {
  it('creates a draft without scheduledAt, scheduled with it', async () => {
    mockBroadcasts();
    const draft = await createBroadcast(
      { title: 'Hi', message: 'Hello', audience: 'All Users' },
      'admin-1',
    );
    expect(draft.status).toBe('draft');
    const scheduled = await createBroadcast(
      {
        title: 'Later',
        message: 'Soon',
        audience: 'All Users',
        scheduledAt: '2026-10-01T00:00:00Z',
      },
      'admin-1',
    );
    expect(scheduled.status).toBe('scheduled');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Broadcasts',
        action: 'broadcast.create',
        adminUid: 'admin-1',
      }),
    );
  });

  it('rejects bad audience and blank title', async () => {
    mockBroadcasts();
    await expect(
      createBroadcast({ title: 'x', message: 'y', audience: 'Nobody' }, 'a'),
    ).rejects.toThrow('audience must be All Users');
    await expect(
      createBroadcast({ title: '  ', message: 'y', audience: 'All Users' }, 'a'),
    ).rejects.toThrow('title is required');
  });
});

describe('updateBroadcast', () => {
  it('patches content fields only', async () => {
    const store = mockBroadcasts({
      'b-1': {
        title: 'Old',
        message: 'Old msg',
        audience: 'All Users',
        status: 'draft',
      },
    });
    const row = await updateBroadcast(
      'b-1',
      { title: 'New', status: 'sent', recipients: 999 },
      'admin-1',
      'admin@x.com',
    );
    expect(row.title).toBe('New');
    expect(row.status).toBe('draft');
    expect(row.recipients).toBe(0);
    expect(store.get('b-1')).toMatchObject({ title: 'New' });
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Broadcasts',
        action: 'broadcast.update',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'b-1',
      }),
    );
  });

  it('refuses to edit sent broadcasts', async () => {
    mockBroadcasts({
      'b-1': { title: 'T', message: 'M', audience: 'All Users', status: 'sent' },
    });
    await expect(updateBroadcast('b-1', { title: 'X' }, 'admin-1')).rejects.toThrow(
      'Sent broadcasts cannot be edited',
    );
  });
});

describe('sendBroadcast', () => {
  it('fans out system notifications and records the count', async () => {
    mockBroadcasts({
      'b-1': { title: 'Hi', message: 'Hello all', audience: 'All Users', status: 'draft' },
    });
    const row = await sendBroadcast('b-1', 'admin-1', 'admin@x.com');
    expect(row.status).toBe('sent');
    expect(row.recipients).toBe(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system', title: 'Hi' }),
    );
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Broadcasts',
        action: 'broadcast.send',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'b-1',
        after: { status: 'sent', recipients: 2 },
      }),
    );
  });

  it('targets hosts only from activity hostIds', async () => {
    mockBroadcasts({
      'b-1': { title: 'H', message: 'M', audience: 'Hosts Only', status: 'draft' },
    });
    const row = await sendBroadcast('b-1', 'admin-1');
    expect(row.recipients).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUid: 'u-1' }),
    );
  });

  it('refuses double send', async () => {
    mockBroadcasts({
      'b-1': { title: 'H', message: 'M', audience: 'All Users', status: 'sent' },
    });
    await expect(sendBroadcast('b-1', 'admin-1')).rejects.toThrow('Broadcast already sent');
  });
});

describe('listBroadcasts + deleteBroadcast', () => {
  it('lists newest first and deletes drafts', async () => {
    mockBroadcasts({
      'b-1': { title: 'T', message: 'M', audience: 'All Users', status: 'draft' },
    });
    expect(await listBroadcasts()).toHaveLength(1);
    await deleteBroadcast('b-1', 'admin-1', 'admin@x.com');
    expect(await listBroadcasts()).toHaveLength(0);
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Broadcasts',
        action: 'broadcast.delete',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'b-1',
      }),
    );
  });

  it('refuses to delete sent broadcasts', async () => {
    mockBroadcasts({
      'b-1': { title: 'T', message: 'M', audience: 'All Users', status: 'sent' },
    });
    await expect(deleteBroadcast('b-1', 'admin-1')).rejects.toThrow(
      'Sent broadcasts cannot be deleted',
    );
  });
});
