import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  loadSessionMock,
  authSignInMock,
  authSignOutMock,
  subscribeSessionRefreshMock,
  refreshStoredTokenMock,
} = vi.hoisted(() => ({
  loadSessionMock: vi.fn(),
  authSignInMock: vi.fn(),
  authSignOutMock: vi.fn(),
  subscribeSessionRefreshMock: vi.fn(() => () => undefined),
  refreshStoredTokenMock: vi.fn(async () => true),
}));

vi.mock('../services/authService', () => ({
  loadSession: loadSessionMock,
  signIn: authSignInMock,
  signOut: authSignOutMock,
  subscribeSessionRefresh: subscribeSessionRefreshMock,
  refreshStoredToken: refreshStoredTokenMock,
}));

const { onUnauthorizedMock, unauthorizedListeners } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    unauthorizedListeners: listeners,
    onUnauthorizedMock: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
});

vi.mock('../services/api', () => ({
  onUnauthorized: onUnauthorizedMock,
}));

import { AuthProvider, useAuth } from './AuthContext';

function fireUnauthorized() {
  unauthorizedListeners.forEach((l) => l());
}

function Probe() {
  const { user, loading, sessionExpired, isAuthenticated, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="user">
        {user === null ? 'checking' : user === false ? 'signed-out' : user.name}
      </div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="expired">{String(sessionExpired)}</div>
      <div data-testid="authed">{String(isAuthenticated)}</div>
      <button onClick={() => void signIn('a@b.com', 'pw', false)}>sign-in</button>
      <button onClick={() => void signOut()}>sign-out</button>
    </div>
  );
}

const testUser = { id: 'u1', name: 'alice', email: 'a@b.com', role: 'Admin', avatarSeed: 'u1' };

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unauthorizedListeners.clear();
    loadSessionMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts as signed-out when there is no stored session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });

  it('restores a signed-in user from a stored session on mount', async () => {
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt: Date.now() + 60_000 });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });

  it('signs in successfully and clears any prior sessionExpired flag', async () => {
    // The real authService.signIn() persists a session via saveSession() before resolving.
    authSignInMock.mockImplementation(async () => {
      loadSessionMock.mockReturnValue({
        token: 't',
        user: testUser,
        expiresAt: Date.now() + 60_000,
      });
      return { user: testUser };
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));

    await user.click(screen.getByText('sign-in'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));
    expect(screen.getByTestId('expired')).toHaveTextContent('false');
  });

  it('signs out and resets state to signed-out', async () => {
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt: Date.now() + 60_000 });
    authSignOutMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));

    await user.click(screen.getByText('sign-out'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));
  });

  it('auto logs out and flags the session as expired on an onUnauthorized event', async () => {
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt: Date.now() + 60_000 });
    authSignOutMock.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));

    await act(async () => {
      fireUnauthorized();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));
    expect(screen.getByTestId('expired')).toHaveTextContent('true');
  });

  it('ignores an onUnauthorized event when there is no active session', async () => {
    loadSessionMock.mockReturnValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));

    await act(async () => {
      fireUnauthorized();
      await Promise.resolve();
    });

    expect(authSignOutMock).not.toHaveBeenCalled();
  });

  it('auto logs out once the local session TTL timer elapses', async () => {
    vi.useFakeTimers();
    const expiresAt = Date.now() + 1000;
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt });
    authSignOutMock.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('user')).toHaveTextContent('alice');

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
    expect(screen.getByTestId('expired')).toHaveTextContent('true');
  });

  it('auto logs out on a storage event for the session key while a session is still resolvable', async () => {
    // autoLogoutIfSession only proceeds when loadSession() is still truthy at the moment the storage event fires.
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt: Date.now() + 60_000 });
    authSignOutMock.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'matchup_admin_session' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-out'));
    expect(authSignOutMock).toHaveBeenCalled();
  });

  it('does not auto log out on a storage event once the session has actually been cleared', async () => {
    // Documents the guard's current behavior: by the time the listener runs.
    loadSessionMock.mockReturnValue({ token: 't', user: testUser, expiresAt: Date.now() + 60_000 });
    authSignOutMock.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));

    loadSessionMock.mockReturnValue(null);
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'matchup_admin_session' }));
      await Promise.resolve();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(authSignOutMock).not.toHaveBeenCalled();
  });

  it('throws when useAuth is used outside an AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>');
    consoleError.mockRestore();
  });
});
