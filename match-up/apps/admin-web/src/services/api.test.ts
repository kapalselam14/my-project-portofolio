// Tests for api.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, clearAdminIdToken, onUnauthorized, setAdminIdToken } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  // Use a real Response so tests exercise JSON parsing and HTTP status handling.
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api service', () => {
  // Reset storage and global fetch state around every independent request case.
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches no Authorization header when no token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/ping');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches a Bearer token when one has been set', async () => {
    setAdminIdToken('abc123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/ping');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('clearAdminIdToken removes a previously stored token', async () => {
    setAdminIdToken('abc123');
    clearAdminIdToken();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/ping');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('normalizes a path without a leading slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('api/ping');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/ping$/);
  });

  it('returns the parsed body on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true, data: { hello: 'world' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ hello: string }>('/api/ping');
    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('returns a NETWORK_ERROR failure when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await apiFetch('/api/ping');
    expect(result).toEqual({ ok: false, error: { code: 'NETWORK_ERROR', message: 'offline' } });
  });

  it('returns a NETWORK_ERROR failure for a non-JSON error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 })),
    );

    const result = await apiFetch('/api/ping');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toContain('502');
    }
  });

  it('reports UNAUTHORIZED for a non-JSON 401 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
    );

    const result = await apiFetch('/api/ping');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('notifies onUnauthorized listeners on an HTTP 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ ok: false, error: { code: 'X', message: 'nope' } }, 401)),
    );

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    await apiFetch('/api/ping');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  // The backend may encode an expired session in its body despite returning HTTP 200.
  it('notifies onUnauthorized listeners on a 200 body carrying an UNAUTHORIZED error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }, 200),
        ),
    );

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    await apiFetch('/api/ping');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops notifying a listener after it unsubscribes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ ok: false, error: { code: 'X', message: 'nope' } }, 401)),
    );

    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    unsubscribe();
    await apiFetch('/api/ping');
    expect(listener).not.toHaveBeenCalled();
  });

  // Listener failures must not change or interrupt the API response.
  it('does not let a throwing listener break the fetch result', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ ok: false, error: { code: 'X', message: 'nope' } }, 401)),
    );

    const unsubscribe = onUnauthorized(() => {
      throw new Error('listener boom');
    });

    const result = await apiFetch('/api/ping');
    expect(result.ok).toBe(false);
    unsubscribe();
  });
});
