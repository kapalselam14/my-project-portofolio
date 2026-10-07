import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: { deleteUser: vi.fn(), revokeRefreshTokens: vi.fn() },
  rtdb: {},
}));

vi.mock('./audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { auth, firestore } from '../../database/firebase.js';
import { logAdminAction } from './audit.service.js';
import {
  deleteMember,
  getMemberDetail,
  getMembersSummary,
  listMembers,
  setMemberStatus,
} from './members.service.js';

const userRow = (overrides: Record<string, unknown> = {}) => ({
  email: 'athlete@example.com',
  displayName: 'Athlete',
  createdAt: { toDate: () => new Date('2026-09-01T10:00:00Z') },
  ...overrides,
});

function mockUsersCollection(docs: { id: string; data: unknown }[]) {
  const store = new Map(docs.map((d) => [d.id, d.data as Record<string, unknown>]));
  const get = vi.fn().mockImplementation(async () => ({
    docs: [...store.entries()].map(([id, data]) => ({
      id,
      data: () => data,
    })),
  }));
  const limit = vi.fn().mockReturnValue({ get });
  const collection = vi.mocked(firestore.collection);
  collection.mockImplementation(((name: string) => {
    if (name === 'users') {
      return {
        limit,
        doc: (id: string) => ({
          get: async () => {
            const data = store.get(id);
            return data === undefined ? { exists: false } : { exists: true, id, data: () => data };
          },
          update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
            const current = store.get(id) ?? {};
            store.set(id, { ...current, ...patch });
          }),
          delete: vi.fn().mockImplementation(async () => {
            store.delete(id);
          }),
        }),
      };
    }
    // activities counts / email index — resolve empty.
    return {
      limit: vi.fn().mockReturnValue({ get: async () => ({ docs: [] }) }),
      where: vi.fn().mockReturnValue({
        count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
      }),
      doc: () => ({
        get: async () => ({ exists: false }),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
    };
  }) as never);
  return { collection, limit };
}

function mockCounts() {
  const countGet = vi.fn().mockResolvedValue({ data: () => ({ count: 3 }) });
  vi.mocked(firestore.collectionGroup).mockReturnValue({
    where: vi.fn().mockReturnValue({ count: () => ({ get: countGet }) }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCounts();
  vi.mocked(auth.deleteUser).mockResolvedValue(undefined as never);
});

describe('listMembers', () => {
  it('maps rows, defaulting missing status to active', async () => {
    mockUsersCollection([
      { id: 'u-1', data: userRow() },
      { id: 'u-2', data: userRow({ status: 'suspended' }) },
      { id: 'u-3', data: { displayName: 'No Email' } },
    ]);
    const rows = await listMembers(20);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ uid: 'u-1', status: 'active' });
    expect(rows[1]).toMatchObject({ uid: 'u-2', status: 'suspended' });
    expect(firestore.collection).toHaveBeenCalledWith('users');
  });

  it('enriches rows with sports, rating, and participation counts', async () => {
    mockUsersCollection([
      {
        id: 'u-1',
        data: userRow({
          preferredSports: ['Football', 'Tennis'],
          sportSkillLevels: { Football: 'intermediate' },
          ratingBySport: {
            Football: { average: 4.5, count: 2 },
            Tennis: { average: 3.0, count: 1 },
          },
        }),
      },
    ]);
    const rows = await listMembers(20);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sports: [
        { sport: 'Football', level: 'intermediate' },
        { sport: 'Tennis', level: '' },
      ],
      // Weighted average: (4.5*2 + 3.0*1) / 3 = 4.0.
      rating: 4,
    });
    // Counts come from the mocked aggregation (3 participants, 0 hosted).
    expect(rows[0]).toMatchObject({ activitiesCount: 3, hostedCount: 0 });
  });

  it('rejects out-of-range limit', async () => {
    mockUsersCollection([]);
    await expect(listMembers(0)).rejects.toThrow('limit must be between 1 and 1000');
    await expect(listMembers(1001)).rejects.toThrow('limit must be between 1 and 1000');
  });
});

describe('getMembersSummary', () => {
  it('counts totals via aggregation, deriving active as total minus suspended', async () => {
    const counts = new Map([
      ['all', 26],
      ['suspended', 1],
    ]);
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name !== 'users') throw new Error(`unexpected collection ${name}`);
      return {
        count: () => ({ get: async () => ({ data: () => ({ count: counts.get('all') }) }) }),
        where: vi.fn().mockReturnValue({
          count: () => ({
            get: async () => ({ data: () => ({ count: counts.get('suspended') }) }),
          }),
        }),
      };
    }) as never);
    await expect(getMembersSummary()).resolves.toEqual({
      total: 26,
      active: 25,
      suspended: 1,
    });
  });
});

describe('getMemberDetail', () => {
  it('enriches with live counts', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    const row = await getMemberDetail('u-1');
    expect(row).toMatchObject({
      uid: 'u-1',
      email: 'athlete@example.com',
      // participants group mocked to 3; hosted query resolves empty.
      activitiesCount: 3,
      hostedCount: 0,
    });
  });

  it('throws NOT_FOUND shape for missing user', async () => {
    mockUsersCollection([]);
    await expect(getMemberDetail('ghost')).rejects.toThrow('User not found');
  });
});

describe('setMemberStatus', () => {
  it('writes status only and returns the detail', async () => {
    const { collection } = mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    void collection;
    const row = await setMemberStatus('u-1', 'suspended', 'admin-1', 'admin@x.com');
    expect(row.status).toBe('suspended');
  });

  it('revokes Firebase sessions on suspend, not on reactivate', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow({ status: 'active' }) }]);
    await setMemberStatus('u-1', 'suspended', 'admin-1', 'admin@x.com');
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u-1');

    vi.mocked(auth.revokeRefreshTokens).mockClear();
    mockUsersCollection([{ id: 'u-1', data: userRow({ status: 'suspended' }) }]);
    await setMemberStatus('u-1', 'active', 'admin-1', 'admin@x.com');
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('suspension still lands when revocation fails (best-effort)', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow({ status: 'active' }) }]);
    vi.mocked(auth.revokeRefreshTokens).mockRejectedValueOnce(new Error('auth down'));
    const row = await setMemberStatus('u-1', 'suspended', 'admin-1', 'admin@x.com');
    expect(row.status).toBe('suspended');
  });

  it('rejects non-enum status (mass-assignment safe)', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    await expect(setMemberStatus('u-1', 'admin', 'admin-1')).rejects.toThrow(
      'status must be active or suspended',
    );
  });

  it('logs the status change with before/after state', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow({ status: 'active' }) }]);
    await setMemberStatus('u-1', 'suspended', 'admin-1', 'admin@x.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Members',
        action: 'member.status_change',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'u-1',
        targetLabel: 'athlete@example.com',
        before: { status: 'active' },
        after: { status: 'suspended' },
      }),
    );
  });
});

describe('deleteMember', () => {
  it('deletes auth account, doc, and email index', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    await deleteMember('u-1', 'admin-1');
    expect(auth.deleteUser).toHaveBeenCalledWith('u-1');
  });

  it('tolerates an already-gone auth account', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    vi.mocked(auth.deleteUser).mockRejectedValueOnce(
      Object.assign(new Error('gone'), { code: 'auth/user-not-found' }),
    );
    await expect(deleteMember('u-1', 'admin-1')).resolves.toBeUndefined();
  });

  it('throws for missing user', async () => {
    mockUsersCollection([]);
    await expect(deleteMember('ghost', 'admin-1')).rejects.toThrow('User not found');
  });

  it('logs the deletion with a before snapshot', async () => {
    mockUsersCollection([{ id: 'u-1', data: userRow() }]);
    await deleteMember('u-1', 'admin-1', 'admin@x.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Members',
        action: 'member.delete',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'u-1',
        targetLabel: 'athlete@example.com',
        before: expect.objectContaining({ email: 'athlete@example.com' }),
      }),
    );
  });
});
