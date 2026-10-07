// Tests for list my activities.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    collection: vi.fn(),
    collectionGroup: vi.fn(),
    doc: vi.fn(),
  };
});

vi.mock('../../database/firebase.js', () => ({
  firestore: {
    collection: mocks.collection,
    collectionGroup: mocks.collectionGroup,
    doc: mocks.doc,
  },
  auth: {},
  rtdb: {},
}));

import { listMyActivities } from './activities.service.js';

const ts = { toDate: () => new Date('2026-09-01T00:00:00Z') };

const baseDoc = (overrides: Record<string, unknown> = {}) => ({
  hostId: 'host-1',
  title: 'Saturday Tennis',
  sportType: 'Tennis',
  description: 'casual',
  locationName: 'Domain',
  geohash: 'rckq31v',
  latitude: -36.86,
  longitude: 174.77,
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  capacity: 10,
  participantCount: 4,
  status: 'open',
  createdAt: ts,
  updatedAt: ts,
  ...overrides,
});

const snapDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  exists: true,
  data: () => data,
});

function mockUsersEmpty() {
  mocks.collection.mockImplementation((name: string) => {
    if (name === 'users') {
      return {
        doc: () => ({
          get: () => Promise.resolve({ exists: false }),
        }),
        where: () => ({
          limit: () => ({
            get: () => Promise.resolve({ empty: true, docs: [] }),
          }),
        }),
      };
    }
    return activityChain;
  });
}

let activityChain: {
  where: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  activityChain = {
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  mockUsersEmpty();
  mocks.collectionGroup.mockReturnValue({
    where: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    }),
  });
  mocks.doc.mockImplementation(() => ({
    get: () => Promise.resolve({ exists: false }),
  }));
});

describe('listMyActivities', () => {
  it('hosted excludes cancelled, completed and removed but keeps open and full', async () => {
    activityChain.get.mockResolvedValue({
      docs: [
        snapDoc('a-open', baseDoc({ status: 'open' })),
        snapDoc('a-full', baseDoc({ status: 'full' })),
        snapDoc('a-cancelled', baseDoc({ status: 'cancelled' })),
        snapDoc('a-completed', baseDoc({ status: 'completed' })),
        snapDoc('a-removed', baseDoc({ status: 'removed' })),
      ],
    });

    const out = await listMyActivities('host-1', 'hosted', 20);

    expect(out.map((a) => a.activityId).sort()).toEqual(['a-full', 'a-open']);
  });

  it('joined excludes a cancelled game the viewer participates in', async () => {
    mocks.collectionGroup.mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              ref: {
                path: 'activities/a-cancelled/participants/u-1',
                parent: {
                  parent: { id: 'a-cancelled' },
                },
              },
            },
            {
              ref: {
                path: 'activities/a-open/participants/u-1',
                parent: {
                  parent: { id: 'a-open' },
                },
              },
            },
          ],
        }),
      }),
    });
    mocks.doc.mockImplementation((path: string) => ({
      get: () => {
        const id = String(path).split('/')[1];
        const status = id === 'a-cancelled' ? 'cancelled' : 'open';
        return Promise.resolve({
          exists: true,
          id,
          data: () => baseDoc({ status }),
        });
      },
    }));

    const out = await listMyActivities('u-1', 'joined', 20);

    expect(out.map((a) => a.activityId)).toEqual(['a-open']);
  });

  it('joined still excludes rows hosted by the viewer', async () => {
    mocks.collectionGroup.mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              ref: {
                path: 'activities/a-own/participants/u-1',
                parent: {
                  parent: { id: 'a-own' },
                },
              },
            },
          ],
        }),
      }),
    });
    mocks.doc.mockImplementation(() => ({
      get: () =>
        Promise.resolve({
          exists: true,
          id: 'a-own',
          data: () => baseDoc({ hostId: 'u-1', status: 'open' }),
        }),
    }));

    const out = await listMyActivities('u-1', 'joined', 20);

    expect(out).toEqual([]);
  });
});
