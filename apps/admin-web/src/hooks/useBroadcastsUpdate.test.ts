// Tests for useBroadcastsUpdate.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Mock every service export because the hook imports the whole broadcasts service module.
const {
  fetchBroadcastsMock,
  createBroadcastMock,
  sendBroadcastMock,
  deleteBroadcastMock,
  updateBroadcastMock,
} = vi.hoisted(() => ({
  fetchBroadcastsMock: vi.fn(),
  createBroadcastMock: vi.fn(),
  sendBroadcastMock: vi.fn(),
  deleteBroadcastMock: vi.fn(),
  updateBroadcastMock: vi.fn(),
}));
vi.mock('../services/broadcastsService', () => ({
  fetchBroadcasts: fetchBroadcastsMock,
  createBroadcast: createBroadcastMock,
  sendBroadcast: sendBroadcastMock,
  deleteBroadcast: deleteBroadcastMock,
  updateBroadcast: updateBroadcastMock,
}));

import { useBroadcasts } from './useBroadcasts';

describe('useBroadcasts.handleUpdate (F3)', () => {
  // Clear mock behavior so each update result is tied to its own case.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify the patch reaches the service and its canonical response updates local state.
  it('updates a broadcast in place after editing', async () => {
    fetchBroadcastsMock.mockResolvedValue([
      {
        id: 'b1',
        title: 'Old',
        message: 'm',
        audience: 'All Users',
        status: 'Draft',
        recipients: 0,
      },
    ]);
    updateBroadcastMock.mockResolvedValue({
      id: 'b1',
      title: 'New',
      message: 'm',
      audience: 'All Users',
      status: 'Draft',
      recipients: 0,
    });
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let out: unknown;
    await act(async () => {
      out = await result.current.handleUpdate('b1', { title: 'New' });
    });
    expect(updateBroadcastMock).toHaveBeenCalledWith('b1', { title: 'New' });
    expect(result.current.broadcasts[0].title).toBe('New');
    expect(out).toMatchObject({ title: 'New' });
  });

  // The editing UI owns error presentation, so update failures must reject to the caller.
  it('propagates update failures to the caller', async () => {
    fetchBroadcastsMock.mockResolvedValue([]);
    updateBroadcastMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => {
        await result.current.handleUpdate('b1', { title: 'x' });
      }),
    ).rejects.toThrow('denied');
  });
});
