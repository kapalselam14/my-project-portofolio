// Tests for broadcastsService.
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the shared transport so these tests can inspect the request and mapped response.
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('../services/api', () => ({ apiFetch: apiFetchMock }));

import { updateBroadcast } from '../services/broadcastsService';

describe('broadcastsService.updateBroadcast (F3)', () => {
  // Isolate successful mapping and backend failure scenarios from one another.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes the broadcast and maps the view to the UI model', async () => {
    // The backend status is lowercase, while the service exposes the title-case UI status.
    apiFetchMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'b1',
        title: 'New',
        message: 'Hi',
        audience: 'All Users',
        status: 'scheduled',
        scheduledAt: '2026-03-01T10:00:00Z',
        sentAt: null,
        recipients: 0,
        createdBy: 'admin',
        createdAt: null,
      },
    });
    const out = await updateBroadcast('b1', { title: 'New' });
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/broadcasts/b1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(out.status).toBe('Scheduled');
  });

  it('throws when the backend rejects the patch', async () => {
    apiFetchMock.mockResolvedValue({ ok: false, error: { message: 'denied' } });
    await expect(updateBroadcast('b1', { title: 'x' })).rejects.toThrow('denied');
  });
});
