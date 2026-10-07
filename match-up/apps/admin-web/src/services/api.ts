/** API client for the admin backend (Firestore via api-server). */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Firebase ID token for admin-only routes, stored by the auth service after Firebase sign-in. */
const ADMIN_TOKEN_KEY = 'admin_id_token';

function adminIdToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminIdToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // Storage unavailable — requests simply go unauthenticated.
  }
}

export function clearAdminIdToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ignore.
  }
}

// Unauthorized broadcast.
// Emitted whenever the backend rejects our token (HTTP 401 / code UNAUTHORIZED.

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  // Return an unsubscribe callback so auth state can detach its listener during cleanup.
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(): void {
  // Isolate the API request from exceptions thrown by listener callbacks.
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      // A broken listener must never break the API call itself.
    }
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  // Normalize relative paths and attach the current admin token when one is stored.
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = adminIdToken();
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token != null && token !== '' ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    let body: ApiResponse<T>;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      // Non-JSON response (e.g. proxy / gateway error page).
      if (response.status === 401) notifyUnauthorized();
      return {
        ok: false,
        error: {
          code: response.status === 401 ? 'UNAUTHORIZED' : 'NETWORK_ERROR',
          message:
            response.status === 401
              ? 'Session expired. Please sign in again.'
              : `Request failed with status ${response.status}`,
        },
      };
    }
    // Some endpoints encode an expired session in the body with HTTP status 200.
    if (response.status === 401 || (!body.ok && body.error.code === 'UNAUTHORIZED')) {
      notifyUnauthorized();
    }
    return body;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

export { BASE_URL };
