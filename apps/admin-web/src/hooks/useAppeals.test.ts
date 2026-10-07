// Tests for useAppeals.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Hoisted mocks let the tests control each status query and appeal decision.
const { fetchAppealsMock, decideAppealMock } = vi.hoisted(() => ({
  fetchAppealsMock: vi.fn(),
  decideAppealMock: vi.fn(),
}));
vi.mock('../services/appealsService', () => ({
  fetchAppeals: fetchAppealsMock,
  decideAppeal: decideAppealMock,
}));

import { useAppeals } from './useAppeals';
import type { Appeal } from '../services/appealsService';

// Build realistic appeal records without repeating required fields in each scenario.
function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: 'a1',
    userId: 'u1',
    userName: 'Alice',
    userAvatarSeed: 'u1',
    userEmail: 'a@b.com',
    type: 'Suspension',
    originalAction: 'Suspended for 7 days',
    statement: 'It was a mistake',
    status: 'Pending',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('useAppeals', () => {
  // Reset mock call history and behavior before every independent hook scenario.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // All three status groups are requested so page tabs can filter the combined list locally.
  it('loads and concatenates pending, approved, and rejected appeals on mount', async () => {
    const pending = [makeAppeal({ id: 'p1', status: 'Pending' })];
    const approved = [makeAppeal({ id: 'a1', status: 'Approved' })];
    const rejected = [makeAppeal({ id: 'r1', status: 'Rejected' })];
    fetchAppealsMock.mockImplementation(async (status: string) => {
      if (status === 'Pending') return pending;
      if (status === 'Approved') return approved;
      return rejected;
    });

    const { result } = renderHook(() => useAppeals());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.appeals.map((a) => a.id)).toEqual(['p1', 'a1', 'r1']);
    expect(result.current.error).toBeNull();
    expect(fetchAppealsMock).toHaveBeenCalledWith('Pending');
    expect(fetchAppealsMock).toHaveBeenCalledWith('Approved');
    expect(fetchAppealsMock).toHaveBeenCalledWith('Rejected');
  });

  it('surfaces an error message when loading fails', async () => {
    fetchAppealsMock.mockRejectedValue(new Error('server unreachable'));

    const { result } = renderHook(() => useAppeals());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('server unreachable');
    expect(result.current.appeals).toEqual([]);
  });

  // The server response replaces the decided row while other appeals remain untouched.
  it('updates only the decided appeal in place via handleDecision', async () => {
    fetchAppealsMock.mockImplementation(async (status: string) =>
      status === 'Pending' ? [makeAppeal({ id: 'p1' }), makeAppeal({ id: 'p2' })] : [],
    );
    const { result } = renderHook(() => useAppeals());
    await waitFor(() => expect(result.current.loading).toBe(false));

    decideAppealMock.mockResolvedValue(
      makeAppeal({ id: 'p1', status: 'Approved', adminResponse: 'ok' }),
    );

    await act(async () => {
      await result.current.handleDecision('p1', 'approve', 'ok');
    });

    expect(decideAppealMock).toHaveBeenCalledWith('p1', 'approve', 'ok');
    const p1 = result.current.appeals.find((a) => a.id === 'p1');
    const p2 = result.current.appeals.find((a) => a.id === 'p2');
    expect(p1?.status).toBe('Approved');
    expect(p2?.status).toBe('Pending');
  });

  it('reload() re-fetches all three statuses', async () => {
    fetchAppealsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useAppeals());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchAppealsMock.mockClear();
    await act(async () => {
      await result.current.reload();
    });

    expect(fetchAppealsMock).toHaveBeenCalledTimes(3);
  });
});
