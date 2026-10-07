import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist report service mocks so fetches and moderation actions are fully controlled per test.
const { fetchReportsMock, reportActionMock } = vi.hoisted(() => ({
  fetchReportsMock: vi.fn(),
  reportActionMock: vi.fn(),
}));

vi.mock('../services/reportsService', () => ({
  fetchReports: fetchReportsMock,
  reportAction: reportActionMock,
}));

import { useReports } from './useReports';
import type { Report } from '../types/reports';

// Provide a complete pending report as the shared baseline for action scenarios.
function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    reporter: 'Alice',
    reporterAvatarSeed: 'alice',
    target: 'Bob',
    targetType: 'user',
    reason: 'Spam',
    category: 'Spam',
    activityTitle: 'Sunday Futsal',
    sport: 'Futsal',
    status: 'Pending',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('useReports', () => {
  // Prevent mocked responses or call history from carrying between cases.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads reports on mount', async () => {
    fetchReportsMock.mockResolvedValue([makeReport()]);

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.reports).toHaveLength(1);
  });

  it('surfaces load failures', async () => {
    fetchReportsMock.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('offline');
    expect(result.current.reports).toEqual([]);
  });

  // The local status and admin note change only after the service confirms success.
  it('updates a report only after the API action succeeds', async () => {
    fetchReportsMock.mockResolvedValue([makeReport()]);
    reportActionMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleAction('report-1', 'resolve', 'Reviewed');
    });

    expect(reportActionMock).toHaveBeenCalledWith('report-1', 'resolve', 'Reviewed');
    expect(result.current.reports[0]).toMatchObject({
      id: 'report-1',
      status: 'Resolved',
      adminNote: 'Reviewed',
    });
  });

  // A rejected action must leave the pending report intact for a later retry.
  it('leaves the report unchanged when the API action fails', async () => {
    fetchReportsMock.mockResolvedValue([makeReport()]);
    reportActionMock.mockRejectedValue(new Error('denied'));

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.handleAction('report-1', 'dismiss');
      }),
    ).rejects.toThrow('denied');

    expect(result.current.reports[0].status).toBe('Pending');
  });
});
