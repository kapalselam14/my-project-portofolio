// Tests for sports.fallback.
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
import { invalidateSportsCache, listSports } from './sports.service.js';

function mockEmptySports() {
  vi.mocked(firestore.collection).mockImplementation(((name: string) => {
    if (name === 'sports') {
      return {
        get: async () => ({ empty: true, docs: [] }),
        doc: (id: string) => ({
          id,
          get: async () => ({ exists: false }),
          update: vi.fn(),
        }),
      };
    }
    return {
      where: vi.fn().mockReturnValue({
        count: () => ({
          get: async () => ({ data: () => ({ count: 0 }) }),
        }),
      }),
    };
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSportsCache();
});

describe('listSports empty-collection fallback', () => {
  it('returns the static seed instead of [] and never crashes', async () => {
    mockEmptySports();
    const rows = await listSports();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ activityCount: 0, enabled: true });
    expect(rows.map((r) => r.name)).toContain('Football');
    const orders = rows.map((r) => r.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});
