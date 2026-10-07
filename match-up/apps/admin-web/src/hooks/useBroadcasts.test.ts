// Tests for useBroadcasts.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Hoisted service mocks make list and mutation responses deterministic in each test.
const { fetchBroadcastsMock, createBroadcastMock, sendBroadcastMock, deleteBroadcastMock } =
  vi.hoisted(() => ({
    fetchBroadcastsMock: vi.fn(),
    createBroadcastMock: vi.fn(),
    sendBroadcastMock: vi.fn(),
    deleteBroadcastMock: vi.fn(),
  }));
vi.mock('../services/broadcastsService', () => ({
  fetchBroadcasts: fetchBroadcastsMock,
  createBroadcast: createBroadcastMock,
  sendBroadcast: sendBroadcastMock,
  deleteBroadcast: deleteBroadcastMock,
}));

import { useBroadcasts } from './useBroadcasts';
import type { Broadcast } from '../services/broadcastsService';

// Provide a valid default broadcast that scenarios can customize with small overrides.
function makeBroadcast(overrides: Partial<Broadcast> = {}): Broadcast {
  return {
    id: 'b1',
    title: 'Maintenance notice',
    message: 'We will be down at midnight.',
    audience: 'All Users',
    status: 'Draft',
    recipients: 0,
    ...overrides,
  };
}

describe('useBroadcasts', () => {
  // Isolate each scenario by clearing all mock behavior and call history.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads broadcasts on mount', async () => {
    fetchBroadcastsMock.mockResolvedValue([makeBroadcast()]);
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.broadcasts).toHaveLength(1);
  });

  it('prepends a newly created broadcast', async () => {
    fetchBroadcastsMock.mockResolvedValue([makeBroadcast({ id: 'old' })]);
    const created = makeBroadcast({ id: 'new' });
    createBroadcastMock.mockResolvedValue(created);
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleCreate({ title: 'x', message: 'y', audience: 'All Users' });
    });

    expect(result.current.broadcasts.map((b) => b.id)).toEqual(['new', 'old']);
  });

  // Create errors remain available to the form so it can show validation feedback.
  it('propagates a create failure to the caller instead of swallowing it', async () => {
    fetchBroadcastsMock.mockResolvedValue([]);
    createBroadcastMock.mockRejectedValue(new Error('validation failed'));
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.handleCreate({ title: '', message: '', audience: 'All Users' });
      }),
    ).rejects.toThrow('validation failed');
  });

  it('updates a broadcast in place after sending it', async () => {
    fetchBroadcastsMock.mockResolvedValue([makeBroadcast({ id: 'b1', status: 'Draft' })]);
    sendBroadcastMock.mockResolvedValue(makeBroadcast({ id: 'b1', status: 'Sent' }));
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSend('b1');
    });

    expect(result.current.broadcasts[0].status).toBe('Sent');
  });

  // A failed delete reloads the list so the temporarily hidden record returns.
  it('reverts an optimistic delete by reloading on API failure', async () => {
    fetchBroadcastsMock
      .mockResolvedValueOnce([makeBroadcast({ id: 'b1' })])
      .mockResolvedValueOnce([makeBroadcast({ id: 'b1' })]);
    deleteBroadcastMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useBroadcasts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDelete('b1');
    });

    await waitFor(() => expect(result.current.broadcasts).toHaveLength(1));
  });
});
