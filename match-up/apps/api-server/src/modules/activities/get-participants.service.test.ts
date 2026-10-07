import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

vi.mock('../users/users.service.js', () => ({
  getPublicUserProfile: vi.fn(async () => null),
}));

import { firestore } from '../../database/firebase.js';
import { getParticipants } from './activity-participants.service.js';

const ts = { toDate: () => new Date('2026-09-10T08:00:00Z') };

function mockAll(activity: Record<string, unknown>) {
  vi.mocked(firestore.doc).mockImplementation((() => ({
    get: async () => ({ exists: true, data: () => activity }),
  })) as never);
  vi.mocked(firestore.collection).mockImplementation(((path: string) => ({
    get: async () => {
      if (path.endsWith('/participants')) {
        return {
          docs: [
            {
              id: 'host-1',
              data: () => ({ uid: 'host-1', joinedAt: ts }),
            },
            {
              id: 'u-2',
              data: () => ({ uid: 'u-2', joinedAt: ts }),
            },
          ],
        };
      }
      // attendance
      return { docs: [{ id: 'u-2', data: () => ({}) }] };
    },
  })) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getParticipants enrichment', () => {
  it('marks the host organizer and only attended rows checked in', async () => {
    mockAll({ hostId: 'host-1' });

    const rows = await getParticipants('a-1');

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.uid === 'host-1')).toMatchObject({
      isOrganizer: true,
      isCheckedIn: false,
    });
    expect(rows.find((r) => r.uid === 'u-2')).toMatchObject({
      isOrganizer: false,
      isCheckedIn: true,
    });
  });

  it('degrades when the activity doc is missing', async () => {
    vi.mocked(firestore.doc).mockImplementation((() => ({
      get: async () => ({ exists: false }),
    })) as never);
    vi.mocked(firestore.collection).mockImplementation(((path: string) => ({
      get: async () => {
        if (path.endsWith('/participants')) {
          return {
            docs: [
              {
                id: 'u-9',
                data: () => ({ uid: 'u-9', joinedAt: ts }),
              },
            ],
          };
        }
        return { docs: [] };
      },
    })) as never);

    const rows = await getParticipants('a-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isOrganizer: false, isCheckedIn: false });
  });
});
