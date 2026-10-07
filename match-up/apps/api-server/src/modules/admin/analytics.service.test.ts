import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

import { firestore } from '../../database/firebase.js';
import { getAnalytics, getDashboard } from './analytics.service.js';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

/** Firestore stub: users: 10 total; 4 created in the last 7d (2 per bucketed day-pair), 6 older. */
function mockAnalyticsDb() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const isoDaysAgo = (n: number) => new Date(now - n * day).toISOString();

  const users = [
    ...[1, 2, 3, 4].map((i) => ({
      id: `new-${i}`,
      data: () => ({ createdAt: ts(isoDaysAgo(i)) }),
    })),
    ...[1, 2, 3, 4, 5, 6].map((i) => ({
      id: `old-${i}`,
      data: () => ({ createdAt: ts(isoDaysAgo(30 + i)) }),
    })),
  ];
  const activities = [
    ...[1, 2, 3].map((i) => ({
      id: `b-${i}`,
      data: () => ({
        sportType: 'Basketball',
        status: 'open',
        createdAt: ts(isoDaysAgo(2)),
      }),
    })),
    {
      id: 't-1',
      data: () => ({
        sportType: 'Tennis',
        status: 'open',
        createdAt: ts(isoDaysAgo(9)),
      }),
    },
    {
      id: 't-2',
      data: () => ({
        sportType: 'Tennis',
        status: 'cancelled',
        createdAt: ts(isoDaysAgo(1)),
      }),
    },
    {
      id: 't-3',
      data: () => ({
        sportType: 'Tennis',
        status: 'open',
        createdAt: ts(isoDaysAgo(1)),
      }),
    },
  ];
  const reports = [1, 2].map((i) => ({
    id: `r-${i}`,
    data: () => ({ status: 'pending', createdAt: ts(isoDaysAgo(1)) }),
  }));

  const table = (docs: { id: string; data: () => unknown }[]) => {
    const terminal = {
      get: async () => ({ docs }),
    };
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.count = vi.fn().mockReturnValue({
      get: async () => ({ data: () => ({ count: docs.length }) }),
    });
    chain.where = vi.fn().mockReturnValue({
      count: chain.count,
      where: vi.fn().mockReturnValue({ count: chain.count }),
      limit: vi.fn().mockReturnValue(terminal),
      get: terminal.get,
    });
    chain.limit = vi.fn().mockReturnValue(terminal);
    chain.get = vi.fn().mockImplementation(terminal.get);
    return chain;
  };

  const usersTable = table(users);
  const activitiesTable = table(activities);
  const reportsTable = table(reports);

  // Realistic counts: total vs range-filtered differ.
  usersTable.count.mockReturnValue({
    get: async () => ({ data: () => ({ count: 10 }) }),
  });
  activitiesTable.count.mockReturnValue({
    get: async () => ({ data: () => ({ count: 6 }) }),
  });

  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'users') return usersTable;
    if (name === 'activities') return activitiesTable;
    if (name === 'reports') return reportsTable;
    throw new Error(`unexpected collection ${name}`);
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAnalyticsDb();
});

describe('getAnalytics', () => {
  it('returns kpis, weekly buckets, and ranked sports', async () => {
    const view = await getAnalytics();
    expect(view.kpis.map((k) => k.label)).toEqual([
      'Total Users',
      'Signups (7d)',
      'Activities (7d)',
      'Pending Reports',
    ]);
    expect(view.weekly).toHaveLength(7);
    expect(view.weekly.reduce((sum, d) => sum + d.signups, 0)).toBeGreaterThan(0);
    expect(view.topSports[0]).toMatchObject({
      sport: 'Basketball',
      activities: 3,
      pct: 100,
    });
    expect(view.retention).toEqual([]);
    expect(view.health).toEqual([]);
    // Honest empty state: no fabricated series, documented note.
    expect(typeof view.note).toBe('string');
    expect(view.note).toContain('Retention');
  });
});

describe('getDashboard', () => {
  it('returns headline numbers', async () => {
    const view = await getDashboard();
    expect(view).toMatchObject({
      totalUsers: 10,
      pendingReports: 2,
    });
    expect(view.newUsersWeek).toBeGreaterThan(0);
    expect(view.topSports.length).toBeGreaterThan(0);
  });
});
