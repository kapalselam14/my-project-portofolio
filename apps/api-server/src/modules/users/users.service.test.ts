import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => {
  return {
    auth: {},
    firestore: {
      collection: vi.fn(),
      collectionGroup: vi.fn(),
      doc: vi.fn(),
    },
  };
});

import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { countUserActivities, getPublicUserProfile, getUserByAuthUid } from './users.service.js';

function mockUserDoc() {
  const userGet = vi.fn().mockResolvedValue({
    id: 'user-1',
    exists: true,
    data: () => ({ email: 'user@example.com', createdAt: Timestamp.now() }),
  });
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'users') return { doc: () => ({ get: userGet }) };
    throw new Error(`unexpected collection: ${name}`);
  }) as never);
}

function mockCounts(joined: number, hosted: number) {
  const joinedGet = vi.fn().mockResolvedValue({ data: () => ({ count: joined }) });
  const hostedGet = vi.fn().mockResolvedValue({ data: () => ({ count: hosted }) });
  vi.mocked(firestore.collectionGroup).mockReturnValue({
    where: () => ({ count: () => ({ get: joinedGet }) }),
  } as never);
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'users') {
      return {
        doc: () => ({
          get: async () => ({
            id: 'user-1',
            exists: true,
            data: () => ({ email: 'user@example.com', createdAt: Timestamp.now() }),
          }),
        }),
      };
    }
    if (name === 'activities') {
      return { where: () => ({ count: () => ({ get: hostedGet }) }) };
    }
    throw new Error(`unexpected collection: ${name}`);
  }) as never);
  return { joinedGet, hostedGet };
}

describe('user activity counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserByAuthUid attaches joined and hosted counts', async () => {
    mockCounts(3, 2);

    const user = await getUserByAuthUid('user-1');

    expect(user?.activitiesCount).toBe(3);
    expect(user?.hostedCount).toBe(2);
    expect(firestore.collectionGroup).toHaveBeenCalledWith('participants');
  });

  it('countUserActivities falls back to zeros when aggregation fails', async () => {
    mockUserDoc();
    vi.mocked(firestore.collectionGroup).mockImplementation(() => {
      throw new Error('index missing');
    });

    await expect(countUserActivities('user-1')).resolves.toEqual({
      activitiesCount: 0,
      hostedCount: 0,
    });
  });

  it('getUserByAuthUid returns null without counting when the user is missing', async () => {
    vi.mocked(firestore.collection).mockReturnValue({
      doc: () => ({ get: async () => ({ exists: false }) }),
    } as never);

    await expect(getUserByAuthUid('missing')).resolves.toBeNull();
    expect(firestore.collectionGroup).not.toHaveBeenCalled();
  });

  it('getPublicUserProfile passes counts through', async () => {
    mockCounts(1, 0);

    const profile = await getPublicUserProfile('user-1');

    expect(profile?.activitiesCount).toBe(1);
    expect(profile?.hostedCount).toBe(0);
  });

  it('getPublicUserProfile exposes dateOfBirth and heightCm', async () => {
    const userGet = vi.fn().mockResolvedValue({
      id: 'user-1',
      exists: true,
      data: () => ({
        email: 'user@example.com',
        createdAt: Timestamp.now(),
        dateOfBirth: '2000-01-15',
        heightCm: 178,
      }),
    });
    const joinedGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) });
    const hostedGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) });
    vi.mocked(firestore.collectionGroup).mockReturnValue({
      where: () => ({ count: () => ({ get: joinedGet }) }),
    } as never);
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'users') return { doc: () => ({ get: userGet }) };
      if (name === 'activities') {
        return { where: () => ({ count: () => ({ get: hostedGet }) }) };
      }
      throw new Error(`unexpected collection: ${name}`);
    }) as never);

    const profile = await getPublicUserProfile('user-1');

    expect(profile?.dateOfBirth).toBe('2000-01-15');
    expect(profile?.heightCm).toBe(178);
  });
});

describe('getPublicUserProfile displayName fallback', () => {
  function mockUidMissThenNameHit() {
    const userGet = vi.fn().mockResolvedValue({ exists: false });
    const rowGet = vi.fn().mockResolvedValue({
      docs: [
        {
          id: 'uid-james',
          exists: true,
          data: () => ({
            email: 'james@example.com',
            displayName: 'James Wilson',
            createdAt: Timestamp.now(),
          }),
        },
      ],
      empty: false,
    });
    const limit = vi.fn().mockReturnValue({ get: rowGet });
    const where = vi.fn().mockReturnValue({ limit });
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'users') {
        return { doc: () => ({ get: userGet }), where };
      }
      throw new Error(`unexpected collection: ${name}`);
    }) as never);
    // Counts for the fallback path (joined via collection group, hosted via activities collection.
    const joinedGet = vi.fn().mockResolvedValue({ data: () => ({ count: 2 }) });
    const hostedGet = vi.fn().mockResolvedValue({ data: () => ({ count: 1 }) });
    vi.mocked(firestore.collectionGroup).mockReturnValue({
      where: () => ({ count: () => ({ get: joinedGet }) }),
    } as never);
    const prevImpl = vi.mocked(firestore.collection).getMockImplementation();
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'activities') {
        return { where: () => ({ count: () => ({ get: hostedGet }) }) };
      }
      return prevImpl!(name);
    }) as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a display name when the uid misses', async () => {
    mockUidMissThenNameHit();

    const profile = await getPublicUserProfile('James Wilson');

    expect(profile?.displayName).toBe('James Wilson');
    expect(profile?.activitiesCount).toBe(2);
  });

  it('returns null when neither uid nor name matches', async () => {
    const userGet = vi.fn().mockResolvedValue({ exists: false });
    const rowGet = vi.fn().mockResolvedValue({ docs: [], empty: true });
    const limit = vi.fn().mockReturnValue({ get: rowGet });
    const where = vi.fn().mockReturnValue({ limit });
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'users') {
        return { doc: () => ({ get: userGet }), where };
      }
      throw new Error(`unexpected collection: ${name}`);
    }) as never);

    await expect(getPublicUserProfile('Ghost Person')).resolves.toBeNull();
  });
});
