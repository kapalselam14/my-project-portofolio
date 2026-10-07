// Tests for deliver push.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listDevices: vi.fn(),
  deleteDevice: vi.fn(),
  sendEachForMulticast: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), doc: vi.fn() },
  messaging: { sendEachForMulticast: mocks.sendEachForMulticast },
  auth: {},
  rtdb: {},
}));

vi.mock('../devices/devices.service.js', () => ({
  listDevices: mocks.listDevices,
  deleteDevice: mocks.deleteDevice,
}));

import { deliverPush } from './notifications.service.js';

const device = (deviceId: string, fcmToken: string) => ({
  deviceId,
  fcmToken,
  platform: 'android',
  createdAt: {},
  updatedAt: {},
});

const okResponse = { success: true } as never;
const deadResponse = (code: string) => ({ success: false, error: { code } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteDevice.mockResolvedValue(undefined);
});

describe('deliverPush', () => {
  it('sends notification + data to every registered token', async () => {
    mocks.listDevices.mockResolvedValue([device('d-1', 'tok-1'), device('d-2', 'tok-2')]);
    mocks.sendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [okResponse, okResponse],
    });

    const res = await deliverPush({
      recipientUid: 'u-1',
      title: 'Activity completed',
      body: 'Rate your game.',
      type: 'activity_completed',
      activityId: 'a-1',
    });

    expect(res).toEqual({ delivered: 2 });
    expect(mocks.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-1', 'tok-2'],
        notification: {
          title: 'Activity completed',
          body: 'Rate your game.',
        },
        data: { type: 'activity_completed', activityId: 'a-1' },
      }),
    );
    expect(mocks.deleteDevice).not.toHaveBeenCalled();
  });

  it('forwards the audience hint into the FCM data payload', async () => {
    mocks.listDevices.mockResolvedValue([device('d-1', 'tok-1')]);
    mocks.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [okResponse],
    });

    await deliverPush({
      recipientUid: 'host-1',
      title: 'New participant',
      body: 'Someone joined your activity',
      type: 'activity_joined',
      activityId: 'a-1',
      audience: 'host',
    });

    expect(mocks.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { type: 'activity_joined', activityId: 'a-1', audience: 'host' },
      }),
    );
  });

  it('dedupes the same token registered on two devices', async () => {
    mocks.listDevices.mockResolvedValue([device('d-1', 'tok-x'), device('d-2', 'tok-x')]);
    mocks.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [okResponse],
    });

    await deliverPush({
      recipientUid: 'u-1',
      title: 'T',
      body: 'B',
      type: 'chat_message',
    });

    expect(mocks.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['tok-x'] }),
    );
  });

  it('prunes dead tokens but keeps the rest', async () => {
    mocks.listDevices.mockResolvedValue([
      device('d-1', 'tok-live'),
      device('d-2', 'tok-dead'),
      device('d-3', 'tok-flaky'),
    ]);
    mocks.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        okResponse,
        deadResponse('messaging/registration-token-not-registered'),
        deadResponse('messaging/server-unavailable'),
      ],
    });

    const res = await deliverPush({
      recipientUid: 'u-1',
      title: 'T',
      body: 'B',
      type: 'activity_joined',
    });

    expect(res).toEqual({ delivered: 1 });
    expect(mocks.deleteDevice).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDevice).toHaveBeenCalledWith('u-1', 'd-2');
  });

  it('returns zero without sending when no devices exist', async () => {
    mocks.listDevices.mockResolvedValue([]);

    const res = await deliverPush({
      recipientUid: 'u-1',
      title: 'T',
      body: 'B',
      type: 'system',
    });

    expect(res).toEqual({ delivered: 0 });
    expect(mocks.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('never throws when the registry or FCM blows up', async () => {
    mocks.listDevices.mockRejectedValue(new Error('firestore down'));

    await expect(
      deliverPush({
        recipientUid: 'u-1',
        title: 'T',
        body: 'B',
        type: 'system',
      }),
    ).resolves.toEqual({ delivered: 0 });
  });
});
