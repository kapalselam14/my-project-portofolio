import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn(), batch: vi.fn() },
  auth: {},
  rtdb: {},
}));

vi.mock('./audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { firestore } from '../../database/firebase.js';
import { logAdminAction } from './audit.service.js';
import { invalidateSportsCache, listSports, replaceSports, updateSport } from './sports.service.js';

function mockSports(docs: { id: string; data: Record<string, unknown> }[]) {
  const store = new Map(docs.map((d) => [d.id, d.data]));
  const batchOps: Array<{ op: string; id: string }> = [];
  const batch = {
    delete: vi.fn((ref: { id: string }) => {
      batchOps.push({ op: 'delete', id: ref.id });
    }),
    set: vi.fn((ref: { id: string }, record: Record<string, unknown>) => {
      batchOps.push({ op: 'set', id: ref.id });
      store.set(ref.id, { ...(store.get(ref.id) ?? {}), ...record });
    }),
    commit: vi.fn().mockImplementation(async () => {
      for (const { op, id } of batchOps.splice(0)) {
        if (op === 'delete') store.delete(id);
      }
    }),
  };
  vi.mocked(firestore.batch).mockReturnValue(batch as never);
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'sports') {
      return {
        get: async () => ({
          docs: [...store.entries()].map(([id, data]) => ({
            id,
            data: () => data,
            ref: { id },
          })),
        }),
        doc: (id: string) => ({
          id,
          get: async () => {
            const data = store.get(id);
            return data === undefined ? { exists: false } : { exists: true, id, data: () => data };
          },
          update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
            store.set(id, { ...(store.get(id) ?? {}), ...patch });
          }),
        }),
      };
    }
    // activities count() aggregation.
    return {
      where: vi.fn().mockReturnValue({
        count: () => ({
          get: async () => ({ data: () => ({ count: 7 }) }),
        }),
      }),
    };
  }) as never);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The service caches listSports() for 5 minutes — drop it so each test's mock Firestore is actually read.
  invalidateSportsCache();
});

describe('listSports', () => {
  it('merges config with live counts, sorted', async () => {
    mockSports([
      {
        id: 'tennis',
        data: { name: 'Tennis', emoji: '🎾', enabled: true, sortOrder: 2 },
      },
      {
        id: 'basketball',
        data: { name: 'Basketball', emoji: '🏀', enabled: true, sortOrder: 1 },
      },
    ]);
    const rows = await listSports();
    expect(rows.map((r) => r.id)).toEqual(['basketball', 'tennis']);
    expect(rows[0]).toMatchObject({ activityCount: 7, enabled: true });
  });
});

describe('updateSport', () => {
  it('writes flags only, ignoring id/name/counts', async () => {
    const store = mockSports([
      { id: 'golf', data: { name: 'Golf', emoji: '⛳', enabled: true, sortOrder: 10 } },
    ]);
    const row = await updateSport(
      'golf',
      { enabled: false, name: 'Hacked', activityCount: 999 },
      'admin-1',
    );
    expect(row.enabled).toBe(false);
    expect(row.name).toBe('Golf');
    expect(store.get('golf')).not.toHaveProperty('activityCount', 999);
  });

  it('rejects non-boolean flags and empty patches', async () => {
    mockSports([{ id: 'golf', data: { name: 'Golf', emoji: '⛳' } }]);
    await expect(updateSport('golf', { enabled: 'yes' }, 'admin-1')).rejects.toThrow(
      'enabled must be a boolean',
    );
    await expect(updateSport('golf', {}, 'admin-1')).rejects.toThrow(
      'No updatable sport flags provided',
    );
  });

  it('throws for missing sport', async () => {
    mockSports([]);
    await expect(updateSport('ghost', { enabled: false }, 'admin-1')).rejects.toThrow(
      'Sport not found',
    );
  });

  it('logs the flag change with before/after state', async () => {
    mockSports([{ id: 'golf', data: { name: 'Golf', emoji: '⛳', enabled: true, sortOrder: 10 } }]);
    await updateSport('golf', { enabled: false }, 'admin-1', 'admin@x.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Sports',
        action: 'sport.update',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'golf',
        after: { enabled: false },
      }),
    );
  });
});

describe('replaceSports', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: 'tennis',
    name: 'Tennis',
    emoji: '🎾',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 1,
    ...overrides,
  });

  it('upserts entries and deletes missing ids', async () => {
    mockSports([
      { id: 'tennis', data: { name: 'Tennis', emoji: '🎾' } },
      { id: 'stale', data: { name: 'Stale', emoji: '❌' } },
    ]);
    const rows = await replaceSports([entry()], 'admin-1');
    expect(rows.map((r) => r.id)).toEqual(['tennis']);
    expect(rows[0]).toMatchObject({ name: 'Tennis', activityCount: 7 });
  });

  it('rejects bad ids, dupes, and empty arrays', async () => {
    mockSports([]);
    await expect(replaceSports([], 'admin-1')).rejects.toThrow('sports must be a non-empty array');
    await expect(replaceSports([{ ...entry(), id: 'Tennis!' }], 'admin-1')).rejects.toThrow(
      'sports[0].id must be a lowercase alphanumeric key',
    );
    await expect(replaceSports([entry(), entry()], 'admin-1')).rejects.toThrow(
      'sports ids must be unique',
    );
  });

  it('logs a single summary entry for the whole bulk replace', async () => {
    mockSports([{ id: 'tennis', data: { name: 'Tennis', emoji: '🎾' } }]);
    await replaceSports([entry()], 'admin-1', 'admin@x.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Sports',
        action: 'sport.replace',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        metadata: { count: '1', ids: 'tennis' },
      }),
    );
    expect(logAdminAction).toHaveBeenCalledTimes(1);
  });
});

describe('listSports cache', () => {
  it('serves repeat reads without touching Firestore', async () => {
    mockSports([{ id: 'tennis', data: { name: 'Tennis', emoji: '🎾' } }]);
    await listSports();
    const calls = vi.mocked(firestore.collection).mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    await listSports();
    // No further collection reads — the second call is a cache hit.
    expect(vi.mocked(firestore.collection).mock.calls.length).toBe(calls);
  });

  it('refetches after a mutation invalidates', async () => {
    mockSports([{ id: 'golf', data: { name: 'Golf', emoji: '⛳', enabled: true } }]);
    expect((await listSports())[0]).toMatchObject({ enabled: true });

    const row = await updateSport('golf', { enabled: false }, 'admin-1');
    expect(row.enabled).toBe(false);
    expect((await listSports())[0]).toMatchObject({ enabled: false });
  });
});
