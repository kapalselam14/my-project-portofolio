import { useEffect, useState } from 'react';
import { apiFetch, type ApiResponse } from '../services/api';

/** Minimal useApi hook — fetches data on mount and exposes loading/error. */
export function useApi<T>(path: string): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore completion callbacks from an earlier path or an unmounted hook instance.
    let cancelled = false;
    setLoading(true);
    apiFetch<T>(path)
      .then((result: ApiResponse<T>) => {
        if (cancelled) return;
        // API errors arrive as a result value, while transport failures reach catch below.
        if (result.ok) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error.message);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // The returned shape is a small view model for components that need one API resource.
  return { data, loading, error };
}
