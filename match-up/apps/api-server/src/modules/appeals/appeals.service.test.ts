// Use in-memory appeal, user, and activity stores to check decisions and their side effects.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1' }),
  renderTemplate: vi.fn().mockResolvedValue(null),
  displayNameOf: vi.fn().mockResolvedValue(''),
}));

vi.mock('../admin/audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { firestore } from '../../database/firebase.js';
import { logAdminAction } from '../admin/audit.service.js';
import { createNotification, renderTemplate } from '../notifications/notifications.service.js';
import { decideAppeal, listAppeals, listMyAppeals, submitAppeal } from './appeals.service.js';

type Store = Map<string, Record<string, unknown>>;

const appealRow = (overrides: Record<string, unknown> = {}) => ({
  appellantUid: 'u-1',
  type: 'suspension',
  statement: 'I did nothing wrong.',
  relatedId: null,
  status: 'pending',
  adminNote: null,
  createdAt: { toDate: () => new Date('2026-09-01T10:00:00Z') },
  decidedAt: null,
  decidedBy: null,
  ...overrides,
});

function mockDb(appeals: Record<string, Record<string, unknown>> = {}) {
  // Linked stores let approval tests observe the account or activity state changed by a decision.
  const appealStore: Store = new Map(Object.entries(appeals));
  const userStore: Store = new Map([
    ['u-1', { displayName: 'Athlete', email: 'a@x.com', status: 'suspended' }],
  ]);
  const activityStore: Store = new Map([['act-1', { status: 'removed' }]]);
  const matches = (
    data: Record<string, unknown>,
    conds: Array<{ field: string; value: unknown }>,
  ) => conds.every((c) => data[c.field] === c.value);

  const queryFor = (store: Store) => {
    const conds: Array<{ field: string; value: unknown }> = [];
    const q: Record<string, ReturnType<typeof vi.fn>> = {};
    q.where = vi.fn((field: string, _op: string, value: unknown) => {
      conds.push({ field, value });
      return q;
    });
    q.limit = vi.fn(() => ({
      get: async () => ({
        empty: [...store.values()].filter((d) => matches(d, conds)).length === 0,
        docs: [...store.entries()]
          .filter(([, d]) => matches(d, conds))
          .map(([id, data]) => ({ id, data: () => data })),
      }),
    }));
    q.get = vi.fn(async () => ({
      empty: true,
      docs: [...store.entries()].map(([id, data]) => ({
        id,
        data: () => data,
      })),
    }));
    return q;
  };

  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'appeals') {
      return {
        ...queryFor(appealStore),
        doc: (id?: string) => {
          const key = id ?? `auto-${appealStore.size + 1}`;
          return {
            id: key,
            get: async () => {
              const data = appealStore.get(key);
              return data === undefined
                ? { exists: false }
                : { exists: true, id: key, data: () => data };
            },
            set: vi.fn().mockImplementation(async (record: Record<string, unknown>) => {
              appealStore.set(key, record);
            }),
            update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
              appealStore.set(key, {
                ...(appealStore.get(key) ?? {}),
                ...patch,
              });
            }),
          };
        },
      };
    }
    if (name === 'users' || name === 'activities') {
      const target = name === 'users' ? userStore : activityStore;
      return {
        doc: (id: string) => ({
          get: async () => {
            const data = target.get(id);
            return data === undefined ? { exists: false } : { exists: true, id, data: () => data };
          },
          update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
            target.set(id, { ...(target.get(id) ?? {}), ...patch });
          }),
        }),
      };
    }
    throw new Error(`unexpected collection ${name}`);
  }) as never);
  return { appealStore, userStore, activityStore };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitAppeal', () => {
  it('creates a pending appeal with enrichment', async () => {
    mockDb();
    const row = await submitAppeal('u-1', {
      type: 'suspension',
      statement: '  Please review. ',
    });
    expect(row).toMatchObject({
      appellantUid: 'u-1',
      type: 'suspension',
      statement: 'Please review.',
      status: 'pending',
      userName: 'Athlete',
      originalAction: 'Account suspended',
    });
  });

  it('rejects duplicate pending appeals of the same type', async () => {
    mockDb({ 'ap-1': appealRow() });
    await expect(submitAppeal('u-1', { type: 'suspension', statement: 'Again' })).rejects.toThrow(
      'A pending appeal of this type already exists',
    );
  });

  it('validates type and statement', async () => {
    mockDb();
    await expect(submitAppeal('u-1', { type: 'nope', statement: 'x' })).rejects.toThrow(
      'type must be suspension',
    );
    await expect(submitAppeal('u-1', { type: 'suspension', statement: '  ' })).rejects.toThrow(
      'statement is required',
    );
  });
});

describe('decideAppeal', () => {
  it('approving a suspension reactivates the account', async () => {
    const { userStore } = mockDb({ 'ap-1': appealRow() });
    const row = await decideAppeal('ap-1', 'approved', 'admin-1', 'Sorry!');
    expect(row).toMatchObject({ status: 'approved', decidedBy: 'admin-1' });
    expect(userStore.get('u-1')).toMatchObject({ status: 'active' });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUid: 'u-1',
        type: 'system',
        title: 'Your appeal was approved',
      }),
    );
  });

  it('approving an account ban also reactivates the appellant', async () => {
    const { userStore } = mockDb({
      'ap-ban': appealRow({ type: 'account_ban' }),
    });

    await decideAppeal('ap-ban', 'approved', 'admin-1', null);

    expect(userStore.get('u-1')).toMatchObject({ status: 'active' });
  });

  it('approving an activity_removal reopens a removed activity', async () => {
    const { activityStore } = mockDb({
      'ap-1': appealRow({ type: 'activity_removal', relatedId: 'act-1' }),
    });
    await decideAppeal('ap-1', 'approved', 'admin-1', null);
    expect(activityStore.get('act-1')).toMatchObject({ status: 'open' });
  });

  it('prefers template copy over the built-in wording', async () => {
    mockDb({ 'ap-1': appealRow() });
    vi.mocked(renderTemplate).mockResolvedValueOnce({
      title: 'Templated title',
      body: 'Templated body',
    });
    await decideAppeal('ap-1', 'approved', 'admin-1', 'note');
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Templated title',
        body: 'Templated body',
      }),
    );
  });

  it('rejecting records the note without side effects', async () => {
    const { userStore } = mockDb({ 'ap-1': appealRow() });
    const row = await decideAppeal('ap-1', 'rejected', 'admin-1', 'Upheld');
    expect(row).toMatchObject({ status: 'rejected', adminNote: 'Upheld' });
    expect(userStore.get('u-1')).toMatchObject({ status: 'suspended' });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUid: 'u-1',
        title: 'Your appeal was reviewed',
      }),
    );
  });

  it('logs the decision', async () => {
    mockDb({ 'ap-1': appealRow() });
    await decideAppeal('ap-1', 'approved', 'admin-1', 'Sorry!');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Appeals',
        action: 'appeal.approve',
        adminUid: 'admin-1',
        targetId: 'ap-1',
        before: { status: 'pending' },
        after: { status: 'approved', adminNote: 'Sorry!' },
      }),
    );
  });

  it('refuses double decisions and missing rows', async () => {
    mockDb({ 'ap-1': appealRow({ status: 'approved' }) });
    await expect(decideAppeal('ap-1', 'approved', 'admin-1', null)).rejects.toThrow(
      'Appeal already decided',
    );
    await expect(decideAppeal('ghost', 'approved', 'admin-1', null)).rejects.toThrow(
      'Appeal not found',
    );
  });

  it('rejects blank appeal ids and unsupported decisions before reading Firestore', async () => {
    await expect(decideAppeal('  ', 'approved', 'admin-1', null)).rejects.toThrow(
      'appealId is required',
    );
    await expect(decideAppeal('ap-1', 'pending' as never, 'admin-1', null)).rejects.toThrow(
      'decision must be approved or rejected',
    );
  });

  it('keeps the decision saved when notification delivery fails', async () => {
    mockDb({ 'ap-1': appealRow() });
    vi.mocked(createNotification).mockRejectedValueOnce(new Error('push unavailable'));

    const row = await decideAppeal('ap-1', 'approved', 'admin-1', null);

    expect(row.status).toBe('approved');
    expect(logAdminAction).toHaveBeenCalledOnce();
  });
});

describe('lists', () => {
  it('listMyAppeals and listAppeals return enriched rows', async () => {
    mockDb({ 'ap-1': appealRow() });
    expect(await listMyAppeals('u-1')).toHaveLength(1);
    expect(await listAppeals('pending')).toHaveLength(1);
    expect(await listMyAppeals('other')).toHaveLength(0);
  });
});
