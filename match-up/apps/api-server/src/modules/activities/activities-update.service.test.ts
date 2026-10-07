// Service tests for update-time participant notifications.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
  runTransaction: vi.fn(),
  getParticipants: vi.fn(),
  createNotification: vi.fn(),
  renderTemplate: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  firestore: {
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
  renderTemplate: mocks.renderTemplate,
}));

import { updateActivity } from './activities.service.js';

const baseDoc = () => ({
  hostId: 'host-1',
  title: 'Sunday Game',
  startTime: '2026-10-10T10:00:00.000Z',
  endTime: '2026-10-10T12:00:00.000Z',
  locationName: 'Domain',
  capacity: 10,
});

function mockUpdateFlow(data: Record<string, unknown>) {
  const update = vi.fn();
  mocks.doc.mockReturnValue({ tag: 'activity' });
  mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      get: async () => ({ exists: true, data: () => data }),
      update,
    });
  });
  mocks.getParticipants.mockResolvedValue([{ uid: 'host-1' }, { uid: 'u-2' }]);
  mocks.createNotification.mockResolvedValue({ notificationId: 'n-1' });
  mocks.renderTemplate.mockResolvedValue(null);
  return { update };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateActivity participant notice', () => {
  it('notifies members (not the host) when the start time changes', async () => {
    mockUpdateFlow(baseDoc());

    await updateActivity({
      activityId: 'a-1',
      hostId: 'host-1',
      startTime: '2026-10-11T10:00:00.000Z',
    });

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUid: 'u-2',
        type: 'activity_updated',
        audience: 'member',
        activityId: 'a-1',
      }),
    );
    const arg = mocks.createNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.body as string).toContain('time');
  });

  it('stays silent on trivial edits (description only)', async () => {
    mockUpdateFlow(baseDoc());

    await updateActivity({
      activityId: 'a-1',
      hostId: 'host-1',
      description: 'Bring water.',
    });

    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it('stays silent when nobody else joined yet', async () => {
    mockUpdateFlow(baseDoc());
    mocks.getParticipants.mockResolvedValue([{ uid: 'host-1' }]);

    await updateActivity({
      activityId: 'a-1',
      hostId: 'host-1',
      capacity: 12,
    });

    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});
