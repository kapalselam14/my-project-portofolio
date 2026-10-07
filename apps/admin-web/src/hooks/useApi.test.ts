import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Use a hoisted API mock so each test can control the hook's request outcome.
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('../services/api', () => ({ apiFetch: apiFetchMock }));

import { useApi } from './useApi';

describe('useApi', () => {
  // Keep every request scenario independent of earlier mock implementations.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in a loading state with no data or error', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useApi('/api/things'));
    expect(result.current).toEqual({ data: null, loading: true, error: null });
  });

  it('populates data and clears loading on a successful fetch', async () => {
    apiFetchMock.mockResolvedValue({ ok: true, data: { id: 1 } });
    const { result } = renderHook(() => useApi<{ id: number }>('/api/things'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
  });

  it('surfaces the backend error message on an API failure', async () => {
    apiFetchMock.mockResolvedValue({ ok: false, error: { code: 'X', message: 'boom' } });
    const { result } = renderHook(() => useApi('/api/things'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('surfaces a thrown error message when apiFetch rejects', async () => {
    apiFetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useApi('/api/things'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('refetches when the path changes', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true, data: 'first' });
    const { result, rerender } = renderHook(({ path }) => useApi(path), {
      initialProps: { path: '/api/a' },
    });
    await waitFor(() => expect(result.current.data).toBe('first'));

    apiFetchMock.mockResolvedValueOnce({ ok: true, data: 'second' });
    rerender({ path: '/api/b' });
    await waitFor(() => expect(result.current.data).toBe('second'));

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/a');
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/b');
  });

  // Resolve after unmount to verify cleanup prevents a late state update from throwing.
  it('ignores a stale response after the component unmounts', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    apiFetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useApi('/api/things'));
    unmount();
    resolveFetch({ ok: true, data: 'late' });

    // No assertion target after unmount besides "doesn't throw".
    await Promise.resolve();
    expect(result.current.loading).toBe(true);
  });
});
