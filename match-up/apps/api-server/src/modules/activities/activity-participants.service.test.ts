import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Firestore transactions and notifications to test participant rules without an emulator.
const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
  batch: vi.fn(),
  runTransaction: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  firestore: {
    doc: mocks.doc,
    batch: mocks.batch,
    runTransaction: mocks.runTransaction,
  },
  auth: {},
  rtdb: {},
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: mocks.createNotification,
}));

import {
  approveJoinRequest,
  declineJoinRequest,
  joinActivity,
  leaveActivity,
  requestToJoin,
} from './activity-participants.service.js';

const H = 60 * 60 * 1000;
const future = () => new Date(Date.now() + 24 * H).toISOString();
const past = () => new Date(Date.now() - H).toISOString();

const openActivity = (overrides: Record<string, unknown> = {}) => ({
  hostId: 'host-1',
  status: 'open',
  capacity: 10,
  participantCount: 4,
  joinPolicy: 'open',
  startTime: future(),
  ...overrides,
});

const snapOf = (exists: boolean, data?: Record<string, unknown>) => ({
  exists,
  data: () => data,
});

// Routes transaction.get(ref) by ref tag: firestore.doc is stubbed to return { tag } markers based on the requested.
function mockDocs(
  activity: Record<string, unknown>,
  opts: {
    participant?: Record<string, unknown> | null;
    request?: Record<string, unknown> | null;
  } = {},
) {
  const activitySnap = snapOf(true, activity);
  const participantSnap = opts.participant ? snapOf(true, opts.participant) : snapOf(false);
  const requestSnap = opts.request ? snapOf(true, opts.request) : snapOf(false);
  mocks.doc.mockImplementation((path: string) => {
    if (path.includes('/participants/')) {
      return { tag: 'participant', get: async () => participantSnap };
    }
    if (path.includes('/joinRequests/')) {
      return { tag: 'request', get: async () => requestSnap };
    }
    return { tag: 'activity', get: async () => activitySnap };
  });
  return {
    activity: activitySnap,
    participant: participantSnap,
    request: requestSnap,
  };
}

function mockTransaction(snaps: { activity: unknown; participant: unknown; request: unknown }) {
  const set = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      get: async (ref: { tag: string }) => {
        if (ref.tag === 'participant') return snaps.participant;
        if (ref.tag === 'request') return snaps.request;
        return snaps.activity;
      },
      set,
      update,
      delete: del,
    });
  });
  return { set, update, del };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotification.mockResolvedValue({ notificationId: 'n-1' });
});

describe('join cutoff', () => {
  it('joinActivity rejects games that already started', async () => {
    mockTransaction(mockDocs(openActivity({ startTime: past() })));

    await expect(joinActivity('a-1', 'u-1')).rejects.toThrow('Activity has already started');
  });

  it('requestToJoin rejects games that already started', async () => {
    mockTransaction(mockDocs(openActivity({ startTime: past(), joinPolicy: 'approval' })));

    await expect(requestToJoin('a-1', 'u-1')).rejects.toThrow('Activity has already started');
  });

  it('joinActivity allows future games', async () => {
    mockTransaction(mockDocs(openActivity()));

    await expect(joinActivity('a-1', 'u-1')).resolves.toBeUndefined();
  });
});

describe('join audience', () => {
  it('approve notifies the joiner as member so the tap opens the joined view', async () => {
    mockTransaction(
      mockDocs(openActivity({ joinPolicy: 'approval', participantCount: 9 }), {
        request: { status: 'pending' },
      }),
    );

    await approveJoinRequest('a-1', 'u-1', 'host-1');

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUid: 'u-1',
        type: 'activity_joined',
        audience: 'member',
      }),
    );
  });

  it('decline sends a plain system notice with no audience', async () => {
    mockTransaction(
      mockDocs(openActivity({ joinPolicy: 'approval' }), {
        request: { status: 'pending' },
      }),
    );

    await declineJoinRequest('a-1', 'u-1', 'host-1');

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system' }),
    );
    const arg = mocks.createNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('audience');
  });
});

describe('pendingRequestCount counter', () => {
  it('requestToJoin bumps the counter', async () => {
    const { update } = mockTransaction(mockDocs(openActivity({ joinPolicy: 'approval' })));

    await requestToJoin('a-1', 'u-1');

    expect(update).toHaveBeenCalled();
    const arg = update.mock.calls[0][1] as Record<string, unknown>;
    expect(arg).toHaveProperty('pendingRequestCount');
    expect(arg).toHaveProperty('updatedAt');
  });

  it('approve decrements the counter and fills the last spot', async () => {
    const { update } = mockTransaction(
      mockDocs(openActivity({ joinPolicy: 'approval', participantCount: 9 }), {
        request: { status: 'pending' },
      }),
    );

    await approveJoinRequest('a-1', 'u-1', 'host-1');

    const activityUpdate = update.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).participantCount === 10,
    );
    expect(activityUpdate).toBeDefined();
    expect((activityUpdate![1] as Record<string, unknown>).status).toBe('full');
    expect(activityUpdate![1]).toHaveProperty('pendingRequestCount');
  });

  it('leaveActivity withdraw of a pending request decrements the counter', async () => {
    const batchUpdate = vi.fn();
    const batchDelete = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mocks.batch.mockReturnValue({
      delete: batchDelete,
      update: batchUpdate,
      commit,
    });
    // Withdraw path uses direct ref gets (no transaction).
    mocks.doc.mockImplementation((path: string) => {
      const pending = path.includes('/joinRequests/');
      return {
        get: async () => (pending ? snapOf(true, { status: 'pending' }) : snapOf(false)),
      };
    });

    await leaveActivity({
      activityId: 'a-1',
      targetUid: 'u-1',
      actorUid: 'u-1',
    });

    expect(batchDelete).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchUpdate.mock.calls[0][1] as Record<string, unknown>).toHaveProperty(
      'pendingRequestCount',
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
