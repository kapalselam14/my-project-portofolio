// Service tests for the check-in openness gate.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  firestore: { doc: mocks.doc },
  auth: {},
  rtdb: {},
}));

import { checkIn } from './activity-checkin.service.js';

const H = 60 * 60 * 1000;
const future = (h = 24) => new Date(Date.now() + h * H).toISOString();
const past = (h = 1) => new Date(Date.now() - h * H).toISOString();

function mockActivity(data: Record<string, unknown> | null) {
  const set = vi.fn().mockResolvedValue(undefined);
  mocks.doc.mockImplementation(() => ({
    get: async () => (data === null ? { exists: false } : { exists: true, data: () => data }),
    set,
  }));
  return { set };
}

const openFuture = () => ({
  status: 'open',
  startTime: future(),
  endTime: future(26),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkIn openness gate', () => {
  it('rejects cancelled activities without writing', async () => {
    const { set } = mockActivity({ ...openFuture(), status: 'cancelled' });

    await expect(checkIn({ activityId: 'a-1', uid: 'u-1' })).rejects.toThrow(
      'Activity is not open for check-in',
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects removed and completed activities without writing', async () => {
    for (const status of ['removed', 'completed']) {
      const { set } = mockActivity({ ...openFuture(), status });
      await expect(checkIn({ activityId: 'a-1', uid: 'u-1' })).rejects.toThrow(
        'Activity is not open for check-in',
      );
      expect(set).not.toHaveBeenCalled();
    }
  });

  it('rejects ended activities without writing', async () => {
    const { set } = mockActivity({
      status: 'open',
      startTime: past(3),
      endTime: past(1),
    });

    await expect(checkIn({ activityId: 'a-1', uid: 'u-1' })).rejects.toThrow(
      'Activity is not open for check-in',
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects missing activities', async () => {
    mockActivity(null);

    await expect(checkIn({ activityId: 'a-1', uid: 'u-1' })).rejects.toThrow('Activity not found');
  });

  it('accepts open future activities and records the timestamp', async () => {
    const { set } = mockActivity(openFuture());

    const at = await checkIn({ activityId: 'a-1', uid: 'u-1' });

    expect(typeof at).toBe('number');
    expect(set).toHaveBeenCalledOnce();
  });
});
