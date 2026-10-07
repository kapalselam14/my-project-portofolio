// Tests for useAuditLog.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Share one controllable audit service mock between module setup and test cases.
const { fetchAuditLogMock } = vi.hoisted(() => ({ fetchAuditLogMock: vi.fn() }));
vi.mock('../services/auditLogService', () => ({
  fetchAuditLog: fetchAuditLogMock,
}));

import { useAuditLog } from './useAuditLog';
import type { AuditLogEntry } from '../services/auditLogService';

// Reuse a valid audit row and override only fields relevant to a case.
function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'e1',
    category: 'Members',
    action: 'member.status_change',
    adminUid: 'admin-1',
    adminEmail: 'admin@x.com',
    description: 'Set member status to suspended',
    targetId: 'u-1',
    targetLabel: 'alice@x.com',
    before: { status: 'active' },
    after: { status: 'suspended' },
    metadata: {},
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('useAuditLog', () => {
  // Clear mock state so call counts and results describe only the current case.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads entries on mount with a 200-row limit', async () => {
    fetchAuditLogMock.mockResolvedValue([makeEntry()]);
    const { result } = renderHook(() => useAuditLog());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(fetchAuditLogMock).toHaveBeenCalledWith({ limit: 200 });
  });

  it('surfaces an error message when loading fails', async () => {
    fetchAuditLogMock.mockRejectedValue(new Error('server unreachable'));
    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('server unreachable');
    expect(result.current.entries).toEqual([]);
  });

  it('reload() re-fetches', async () => {
    fetchAuditLogMock.mockResolvedValue([]);
    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchAuditLogMock.mockClear();
    fetchAuditLogMock.mockResolvedValue([makeEntry()]);
    await act(async () => {
      await result.current.reload();
    });

    expect(fetchAuditLogMock).toHaveBeenCalledTimes(1);
    expect(result.current.entries).toHaveLength(1);
  });
});
