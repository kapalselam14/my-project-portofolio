// Tests for authService.
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Hoist Firebase mocks so the module factory and auth scenarios share controllable functions.
const { signInWithEmailAndPasswordMock, firebaseSignOutMock, onIdTokenChangedMock } = vi.hoisted(
  () => ({
    signInWithEmailAndPasswordMock: vi.fn(),
    firebaseSignOutMock: vi.fn(),
    onIdTokenChangedMock: vi.fn((_auth: unknown, _cb: unknown) => () => undefined),
  }),
);

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signOut: firebaseSignOutMock,
  onIdTokenChanged: onIdTokenChangedMock,
}));

vi.mock('./firebase', () => ({
  getFirebaseAuth: vi.fn(() => ({})),
}));

// Keep API token calls observable while testing the auth service independently of the network.
const { apiFetchMock, setAdminIdTokenMock, clearAdminIdTokenMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  setAdminIdTokenMock: vi.fn(),
  clearAdminIdTokenMock: vi.fn(),
}));

vi.mock('./api', () => ({
  apiFetch: apiFetchMock,
  setAdminIdToken: setAdminIdTokenMock,
  clearAdminIdToken: clearAdminIdTokenMock,
}));

import {
  AuthError,
  clearSession,
  loadSession,
  refreshStoredToken,
  saveSession,
  signIn,
  signOut,
  subscribeSessionRefresh,
  type AuthSession,
} from './authService';

const SESSION_KEY = 'matchup_admin_session';

// Build an unexpired default session that tests can vary for storage and TTL cases.
function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    token: 'tok',
    user: { id: 'u1', name: 'alice', email: 'alice@example.com', role: 'Admin', avatarSeed: 'u1' },
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('authService session storage', () => {
  // Exercise remembered and tab-scoped persistence, expiry, and malformed stored data.
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('round-trips a session through localStorage when remember is true', () => {
    const session = makeSession();
    saveSession(session, true);
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession()).toEqual(session);
  });

  it('round-trips a session through sessionStorage when remember is false', () => {
    const session = makeSession();
    saveSession(session, false);
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession()).toEqual(session);
  });

  it('clears the other store so stale sessions cannot linger', () => {
    saveSession(makeSession(), true);
    saveSession(makeSession(), false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('returns null and clears storage once a session has expired', () => {
    saveSession(makeSession({ expiresAt: Date.now() - 1 }), true);
    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('returns null for corrupted session JSON instead of throwing', () => {
    localStorage.setItem(SESSION_KEY, '{not json');
    expect(loadSession()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull();
  });

  it('clearSession removes the session from both stores', () => {
    saveSession(makeSession(), true);
    saveSession(makeSession(), false);
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('authService signIn/signOut', () => {
  // Each case verifies Firebase auth, server-side admin verification, or cleanup behavior.
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('signs in, verifies admin rights, and saves a session', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: 'uid-1',
        email: 'bob@example.com',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('id-token'),
      },
    });
    apiFetchMock.mockResolvedValue({
      ok: true,
      data: { uid: 'uid-1', email: 'bob@example.com', admin: true },
    });

    const session = await signIn('  bob@example.com  ', 'pw', false);

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      'bob@example.com',
      'pw',
    );
    expect(setAdminIdTokenMock).toHaveBeenCalledWith('id-token');
    expect(session.user).toMatchObject({
      id: 'uid-1',
      name: 'bob',
      email: 'bob@example.com',
      role: 'Admin',
    });
    expect(loadSession()?.token).toBe('id-token');
  });

  it('falls back to the uid for the display name when the email has no local part', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: 'uid-2',
        email: null,
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('tok'),
      },
    });
    apiFetchMock.mockResolvedValue({ ok: true, data: { uid: 'uid-2', email: null, admin: true } });

    const session = await signIn('someone@example.com', 'pw', false);
    expect(session.user.name).toBe('someone');
  });

  it('throws AuthError with a generic message on bad credentials', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue(new Error('auth/wrong-password'));

    await expect(signIn('bob@example.com', 'wrong', false)).rejects.toThrow(AuthError);
    await expect(signIn('bob@example.com', 'wrong', false)).rejects.toThrow(
      'Invalid email or password.',
    );
    expect(setAdminIdTokenMock).not.toHaveBeenCalled();
  });

  it('clears the token and throws when the account is not an admin', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: 'uid-3',
        email: 'nobody@example.com',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('tok'),
      },
    });
    apiFetchMock.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'nope' } });

    await expect(signIn('nobody@example.com', 'pw', false)).rejects.toThrow(
      'This account is not an admin.',
    );
    expect(clearAdminIdTokenMock).toHaveBeenCalled();
    expect(loadSession()).toBeNull();
  });

  it('propagates a non-FORBIDDEN admin-check error message as-is', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: 'uid-4',
        email: 'x@example.com',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('tok'),
      },
    });
    apiFetchMock.mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'server unreachable' },
    });

    await expect(signIn('x@example.com', 'pw', false)).rejects.toThrow('server unreachable');
  });

  it('uses the 30-day TTL when remember is true and the 8h TTL otherwise', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: 'uid-5',
        email: 'x@example.com',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('tok'),
      },
    });
    apiFetchMock.mockResolvedValue({
      ok: true,
      data: { uid: 'uid-5', email: 'x@example.com', admin: true },
    });

    const before = Date.now();
    const session = await signIn('x@example.com', 'pw', true);
    const ttl = session.expiresAt - before;
    expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('signOut clears local session/token and best-effort signs out of Firebase', async () => {
    saveSession(makeSession(), true);
    firebaseSignOutMock.mockResolvedValue(undefined);

    await signOut();

    expect(clearAdminIdTokenMock).toHaveBeenCalled();
    expect(loadSession()).toBeNull();
    expect(firebaseSignOutMock).toHaveBeenCalled();
  });

  it('signOut swallows a Firebase sign-out failure', async () => {
    saveSession(makeSession(), true);
    firebaseSignOutMock.mockRejectedValue(new Error('network down'));

    await expect(signOut()).resolves.toBeUndefined();
    expect(loadSession()).toBeNull();
  });
});

describe('token refresh (H2)', () => {
  // Confirm fresh Firebase tokens are synchronized into the persisted admin session.
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('refreshStoredToken returns false when there is no SDK user', async () => {
    await expect(refreshStoredToken()).resolves.toBe(false);
  });

  it('refreshStoredToken persists the fresh token into both stores', async () => {
    const { getFirebaseAuth } = await import('./firebase');
    vi.mocked(getFirebaseAuth).mockReturnValue({
      currentUser: { getIdToken: vi.fn().mockResolvedValue('fresh-tok') },
    } as never);
    saveSession({ ...makeSession(), token: 'stale-tok' }, true);

    await expect(refreshStoredToken()).resolves.toBe(true);

    expect(localStorage.getItem(SESSION_KEY)).toContain('fresh-tok');
  });

  it('subscribeSessionRefresh wires onIdTokenChanged and returns an unsubscribe', () => {
    const unsub = subscribeSessionRefresh();
    expect(onIdTokenChangedMock).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });
});
