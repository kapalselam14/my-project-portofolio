// Tests for the admin summary endpoints (collection-wide header-card totals).
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the shared transport so these tests can inspect the request and mapped response.
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('../services/api', () => ({ apiFetch: apiFetchMock }));

import { fetchMembersSummary } from '../services/membersService';
import { fetchActivitiesSummary } from '../services/activitiesService';

describe('admin summary services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches member totals from the summary endpoint', async () => {
    apiFetchMock.mockResolvedValue({ ok: true, data: { total: 26, active: 25, suspended: 1 } });
    await expect(fetchMembersSummary()).resolves.toEqual({
      total: 26,
      active: 25,
      suspended: 1,
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/members/summary');
  });

  it('fetches activity totals from the summary endpoint', async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      data: { total: 165, open: 49, full: 4, cancelled: 4, completed: 108, removed: 0 },
    });
    await expect(fetchActivitiesSummary()).resolves.toEqual({
      total: 165,
      open: 49,
      full: 4,
      cancelled: 4,
      completed: 108,
      removed: 0,
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/activities/summary');
  });

  it('throws when the backend rejects the summary', async () => {
    apiFetchMock.mockResolvedValue({ ok: false, error: { message: 'denied' } });
    await expect(fetchMembersSummary()).rejects.toThrow('denied');
    await expect(fetchActivitiesSummary()).rejects.toThrow('denied');
  });
});
