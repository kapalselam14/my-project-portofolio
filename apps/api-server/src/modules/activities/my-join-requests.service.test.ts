// Tests for my join requests.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

import { firestore } from '../../database/firebase.js';
import { listMyJoinRequests } from './activity-participants.service.js';

const row = (
  activityId: string,
  status: string,
  createdAt: unknown = { toDate: () => new Date('2026-09-01T10:00:00Z') },
) => ({
  data: () => ({ uid: 'me-1', activityId, status, createdAt }),
});

function mockGroup(rows: unknown[]) {
  const get = vi.fn().mockResolvedValue({ docs: rows });
  const where = vi.fn().mockReturnValue({ get });
  vi.mocked(firestore.collectionGroup).mockReturnValue({ where } as never);
  return where;
}

function mockActivityDoc(data: Record<string, unknown> | null) {
  vi.mocked(firestore.doc).mockImplementation((() => ({
    get: async () => (data === null ? { exists: false } : { exists: true, data: () => data }),
  })) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listMyJoinRequests', () => {
  it('returns enriched pending rows, skipping other statuses', async () => {
    mockGroup([row('a-1', 'pending'), row('a-2', 'approved')]);
    mockActivityDoc({
      title: 'Sunday Run',
      sportType: 'Running',
      locationName: 'Domain',
      startTime: '2026-09-10T08:00:00Z',
      coverImageUrl: 'https://cdn.example/cover.jpg',
    });

    const rows = await listMyJoinRequests('me-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      activityId: 'a-1',
      title: 'Sunday Run',
      sportType: 'Running',
      status: 'pending',
      coverImageUrl: 'https://cdn.example/cover.jpg',
    });
    expect(firestore.collectionGroup).toHaveBeenCalledWith('joinRequests');
  });

  it('survives a missing activity doc', async () => {
    mockGroup([row('gone', 'pending')]);
    mockActivityDoc(null);

    const rows = await listMyJoinRequests('me-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ activityId: 'gone', title: '' });
  });

  it('rejects blank uid', async () => {
    await expect(listMyJoinRequests('   ')).rejects.toThrow('uid is required');
  });

  it('orders soonest event first, dateless rows last', async () => {
    mockGroup([row('a-late', 'pending'), row('a-nodate', 'pending'), row('a-soon', 'pending')]);
    const starts: Record<string, string | null> = {
      'a-late': '2026-10-01T10:00:00Z',
      'a-nodate': null,
      'a-soon': '2026-09-20T10:00:00Z',
    };
    vi.mocked(firestore.doc).mockImplementation(((path: string) => ({
      get: async () => {
        const id = path.split('/').pop() as string;
        const startTime = starts[id];
        return {
          exists: true,
          data: () => ({
            title: id,
            sportType: 'Running',
            locationName: 'Park',
            ...(startTime !== null ? { startTime } : {}),
          }),
        };
      },
    })) as never);

    const rows = await listMyJoinRequests('me-1');

    expect(rows.map((r) => r.activityId)).toEqual(['a-soon', 'a-late', 'a-nodate']);
  });
});
