import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  runTransaction: vi.fn(),
  getParticipants: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  firestore: {
    collection: mocks.collection,
    doc: mocks.doc,
    runTransaction: mocks.runTransaction,
  },
  auth: {},
  rtdb: {},
}));

vi.mock('./activity-participants.service.js', () => ({
  getParticipants: mocks.getParticipants,
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: mocks.createNotification,
}));

import { resolveEndMs, sweepExpiredActivities } from './activity-lifecycle.service.js';

const NOW = new Date('2026-09-10T12:00:00Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const H = 60 * 60 * 1000;

const docOf = (data: Record<string, unknown>, id = 'a-1') => ({
  id,
  data: () => data,
});

function mockOpenScan(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  const get = vi.fn().mockResolvedValue({
    docs: rows.map((r) => docOf(r.data, r.id)),
  });
  const limit = vi.fn().mockReturnValue({ get });
  const where = vi.fn().mockReturnValue({ limit });
  mocks.collection.mockReturnValue({ where });
}

function mockTransaction(status: string) {
  const update = vi.fn();
  mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      get: async () => ({ exists: true, data: () => ({ status }) }),
      update,
    });
  });
  return update;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.doc.mockReturnValue({ id: 'ref' });
  mocks.getParticipants.mockResolvedValue([
    { participantId: 'p-1', uid: 'u-1' },
    { participantId: 'p-2', uid: 'u-2' },
  ]);
  mocks.createNotification.mockResolvedValue({ notificationId: 'n-1' });
});

describe('resolveEndMs', () => {
  it('prefers endTime when parseable', () => {
    expect(resolveEndMs({ endTime: iso(NOW - H) })).toBe(NOW - H);
  });

  it('falls back to startTime + 2h when endTime is missing', () => {
    expect(resolveEndMs({ startTime: iso(NOW - 3 * H) })).toBe(NOW - H);
  });

  it('returns null when nothing is parseable', () => {
    expect(resolveEndMs({})).toBeNull();
    expect(resolveEndMs({ endTime: 'not-a-date', startTime: 'junk' })).toBeNull();
  });
});

describe('sweepExpiredActivities', () => {
  it('completes a past-due open activity and notifies roster + host', async () => {
    mockOpenScan([
      {
        id: 'a-1',
        data: {
          title: 'Morning Run',
          hostId: 'h-1',
          status: 'open',
          startTime: iso(NOW - 3 * H),
          endTime: iso(NOW - H),
        },
      },
    ]);
    const update = mockTransaction('open');

    const res = await sweepExpiredActivities({ nowMs: NOW });

    expect(res).toEqual({ completed: 1 });
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'completed' }),
    );
    // Roster (2) + host (1) each get a review nudge.
    expect(mocks.createNotification).toHaveBeenCalledTimes(3);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'activity_completed',
        activityId: 'a-1',
      }),
    );
  });

  it('skips activities still in the future', async () => {
    mockOpenScan([
      {
        id: 'a-2',
        data: {
          title: 'Future Game',
          hostId: 'h-1',
          status: 'open',
          startTime: iso(NOW + H),
          endTime: iso(NOW + 3 * H),
        },
      },
    ]);

    const res = await sweepExpiredActivities({ nowMs: NOW });

    expect(res).toEqual({ completed: 0 });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it('does not re-notify when a concurrent writer already flipped it', async () => {
    mockOpenScan([
      {
        id: 'a-3',
        data: {
          title: 'Racy Game',
          hostId: 'h-1',
          status: 'open',
          startTime: iso(NOW - 3 * H),
          endTime: iso(NOW - H),
        },
      },
    ]);
    // Transaction re-read sees completed (host tapped first).
    mockTransaction('completed');

    const res = await sweepExpiredActivities({ nowMs: NOW });

    expect(res).toEqual({ completed: 0 });
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it('one bad row does not abort the sweep', async () => {
    mockOpenScan([
      {
        id: 'bad',
        data: {
          title: 'Broken',
          hostId: 'h-1',
          status: 'open',
          startTime: iso(NOW - 3 * H),
          endTime: iso(NOW - H),
        },
      },
      {
        id: 'good',
        data: {
          title: 'Fine',
          hostId: 'h-1',
          status: 'open',
          startTime: iso(NOW - 3 * H),
          endTime: iso(NOW - H),
        },
      },
    ]);
    // First transaction throws, second flips normally.
    mocks.runTransaction
      .mockRejectedValueOnce(new Error('torn write'))
      .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          get: async () => ({ exists: true, data: () => ({ status: 'open' }) }),
          update: vi.fn(),
        });
      });

    const res = await sweepExpiredActivities({ nowMs: NOW });

    expect(res).toEqual({ completed: 1 });
  });
});
