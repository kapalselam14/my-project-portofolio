// Tests for useDashboard.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Hoist dashboard service mocks so requests and moderation outcomes are controlled by each case.
const { fetchDashboardMock, moderationActionMock } = vi.hoisted(() => ({
  fetchDashboardMock: vi.fn(),
  moderationActionMock: vi.fn(),
}));
vi.mock('../services/dashboardService', () => ({
  fetchDashboard: fetchDashboardMock,
  moderationAction: moderationActionMock,
}));

import { useDashboard } from './useDashboard';
import type { DashboardData } from '../types/dashboard';

// Supply one moderation item by default so removal and recovery can be observed.
function makeDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    kpis: [],
    trend: [],
    moderationQueue: [
      {
        id: 'mod1',
        reporter: 'Alice',
        target: 'Bob',
        targetType: 'user',
        reason: 'spam',
        activityTitle: '',
        sport: '',
        createdAt: '2026-01-01',
      },
    ],
    activities: [],
    ...overrides,
  };
}

describe('useDashboard', () => {
  // Each test starts with clean service call history and response behavior.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads dashboard data on mount', async () => {
    fetchDashboardMock.mockResolvedValue(makeDashboard());
    const { result } = renderHook(() => useDashboard());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.moderationQueue).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error message and leaves data null when the load fails', async () => {
    fetchDashboardMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('offline');
    expect(result.current.data).toBeNull();
  });

  // Successful moderation keeps the queue item hidden after the immediate local removal.
  it('optimistically removes a moderation item and keeps it removed on success', async () => {
    fetchDashboardMock.mockResolvedValue(makeDashboard());
    moderationActionMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleModAction('mod1', 'dismiss');
    });

    expect(result.current.data?.moderationQueue).toHaveLength(0);
    expect(moderationActionMock).toHaveBeenCalledWith('mod1', 'dismiss', undefined);
  });

  // Re-fetching after failure restores the queue item to the view.
  it('reverts the optimistic removal by reloading on API failure', async () => {
    fetchDashboardMock
      .mockResolvedValueOnce(makeDashboard())
      .mockResolvedValueOnce(makeDashboard());
    moderationActionMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleModAction('mod1', 'dismiss');
    });

    await waitFor(() => expect(result.current.data?.moderationQueue).toHaveLength(1));
    expect(fetchDashboardMock).toHaveBeenCalledTimes(2);
  });
});
