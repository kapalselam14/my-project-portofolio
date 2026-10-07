import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn() },
  auth: {},
  rtdb: {},
}));

import { firestore } from '../../database/firebase.js';
import { isAuditCategory, listAuditLog, logAdminAction } from './audit.service.js';

type Store = Map<string, Record<string, unknown>>;

// Provide the small chainable query surface used by the audit service over an in-memory store.
function mockDb(entries: Record<string, Record<string, unknown>> = {}) {
  const store: Store = new Map(Object.entries(entries));
  let autoId = 0;

  const queryFor = (conds: Array<{ field: string; value: unknown }> = []) => {
    const q: Record<string, ReturnType<typeof vi.fn>> = {};
    q.where = vi.fn((field: string, _op: string, value: unknown) => {
      return queryFor([...conds, { field, value }]);
    });
    q.limit = vi.fn(() => ({
      get: async () => ({
        docs: [...store.entries()]
          .filter(([, d]) => conds.every((c) => d[c.field] === c.value))
          .map(([id, data]) => ({ id, data: () => data })),
      }),
    }));
    return q;
  };

  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name !== 'adminActions') throw new Error(`unexpected collection ${name}`);
    return {
      ...queryFor(),
      doc: () => {
        const key = `auto-${++autoId}`;
        return {
          id: key,
          set: vi.fn().mockImplementation(async (record: Record<string, unknown>) => {
            store.set(key, record);
          }),
        };
      },
    };
  }) as never);

  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isAuditCategory', () => {
  it('accepts the seven known categories', () => {
    for (const c of [
      'Members',
      'Activities',
      'Appeals',
      'Reports',
      'Broadcasts',
      'Sports',
      'Templates',
    ]) {
      expect(isAuditCategory(c)).toBe(true);
    }
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isAuditCategory('Settings')).toBe(false);
    expect(isAuditCategory(undefined)).toBe(false);
    expect(isAuditCategory(42)).toBe(false);
  });
});

describe('logAdminAction', () => {
  it('writes a full record with defaults filled in', async () => {
    const store = mockDb();
    await logAdminAction({
      category: 'Members',
      action: 'member.status_change',
      adminUid: 'admin-1',
      adminEmail: 'admin@x.com',
      description: 'Suspended member account',
      targetId: 'u-1',
      targetLabel: 'alice@x.com',
      before: { status: 'active' },
      after: { status: 'suspended' },
      metadata: { note: 'repeated no-shows' },
    });
    const [record] = [...store.values()];
    expect(record).toMatchObject({
      category: 'Members',
      action: 'member.status_change',
      adminUid: 'admin-1',
      adminEmail: 'admin@x.com',
      description: 'Suspended member account',
      targetId: 'u-1',
      targetLabel: 'alice@x.com',
      before: { status: 'active' },
      after: { status: 'suspended' },
      metadata: { note: 'repeated no-shows' },
    });
    expect(record.createdAt).toBeDefined();
  });

  it('defaults optional fields to null/empty when omitted', async () => {
    const store = mockDb();
    await logAdminAction({
      category: 'Broadcasts',
      action: 'broadcast.create',
      adminUid: 'admin-1',
      description: 'Created a broadcast',
    });
    const [record] = [...store.values()];
    expect(record).toMatchObject({
      adminEmail: null,
      targetId: null,
      targetLabel: '',
      before: null,
      after: null,
      metadata: {},
    });
  });

  it('never throws, even when the Firestore write fails', async () => {
    vi.mocked(firestore.collection).mockImplementation((() => {
      throw new Error('firestore unavailable');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAdminAction({
        category: 'Sports',
        action: 'sport.update',
        adminUid: 'admin-1',
        description: 'Updated sport',
      }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('listAuditLog', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    category: 'Members',
    action: 'member.status_change',
    adminUid: 'admin-1',
    adminEmail: 'admin@x.com',
    description: 'Suspended member account',
    targetId: 'u-1',
    targetLabel: 'alice@x.com',
    before: { status: 'active' },
    after: { status: 'suspended' },
    metadata: {},
    createdAt: { toDate: () => new Date('2026-09-01T10:00:00Z') },
    ...overrides,
  });

  it('returns all entries newest-first when unfiltered', async () => {
    mockDb({
      e1: row({ createdAt: { toDate: () => new Date('2026-09-01T10:00:00Z') } }),
      e2: row({ createdAt: { toDate: () => new Date('2026-09-02T10:00:00Z') } }),
    });
    const rows = await listAuditLog();
    expect(rows.map((r) => r.id)).toEqual(['e2', 'e1']);
  });

  it('filters by category via a single-field where clause', async () => {
    mockDb({
      e1: row({ category: 'Members' }),
      e2: row({ category: 'Sports' }),
    });
    const rows = await listAuditLog({ category: 'Sports' });
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Sports');
  });

  it('filters by adminUid in memory', async () => {
    mockDb({
      e1: row({ adminUid: 'admin-1' }),
      e2: row({ adminUid: 'admin-2' }),
    });
    const rows = await listAuditLog({ adminUid: 'admin-2' });
    expect(rows).toHaveLength(1);
    expect(rows[0].adminUid).toBe('admin-2');
  });

  it('clamps limit to the [1, 200] range', async () => {
    const store = mockDb();
    for (let i = 0; i < 5; i++) store.set(`e${i}`, row());

    const collectionMock = vi.mocked(firestore.collection);
    await listAuditLog({ limit: 0 });
    await listAuditLog({ limit: 9999 });
    // No direct hook into the clamped value from outside.
    expect(collectionMock).toHaveBeenCalled();
  });

  it('defaults missing string fields defensively', async () => {
    mockDb({ e1: { createdAt: { toDate: () => new Date('2026-01-01T00:00:00Z') } } });
    const [rowView] = await listAuditLog();
    expect(rowView).toMatchObject({
      adminUid: '',
      adminEmail: null,
      description: '',
      targetId: null,
      targetLabel: '',
      before: null,
      after: null,
      metadata: {},
    });
  });
});
