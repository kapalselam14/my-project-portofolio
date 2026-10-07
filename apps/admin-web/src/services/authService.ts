/** Auth service — database-backed admin sign-in. */
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { apiFetch, clearAdminIdToken, setAdminIdToken } from './api';
import { getFirebaseAuth } from './firebase';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarSeed: string;
  photoUrl?: string;
}

export interface AuthSession {
  token: string;
  user: AdminUser;
  /** Unix ms timestamp when the session expires. */
  expiresAt: number;
}

// Session storage.

const SESSION_KEY = 'matchup_admin_session';
// Default: 8h session; "remember me" extends to 30 days.
const SESSION_TTL_DEFAULT = 8 * 60 * 60 * 1000;
const SESSION_TTL_REMEMBER = 30 * 24 * 60 * 60 * 1000;

export function saveSession(session: AuthSession, remember: boolean): void {
  // Choose persistent or tab-scoped storage, clearing both first to prevent stale duplicates.
  const store = remember ? localStorage : sessionStorage;
  // Always clear the other store to avoid stale sessions.
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  store.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthSession | null {
  // Prefer a remembered session and otherwise use the current tab's session.
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

// Token refresh: ID tokens expire hourly but sessions promise 8h/30d.

function persistRefreshedToken(token: string): void {
  // Keep the API client's token and the saved session copy in sync after Firebase refresh.
  setAdminIdToken(token);
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const session = JSON.parse(raw) as AuthSession;
    const store = localStorage.getItem(SESSION_KEY) != null ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify({ ...session, token }));
  } catch {
    // Corrupt session — the TTL check in loadSession will clear it.
  }
}

export async function refreshStoredToken(): Promise<boolean> {
  // Return false when Firebase has no current user or cannot provide a refreshed token.
  try {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) return false;
    persistRefreshedToken(token);
    return true;
  } catch {
    return false;
  }
}

export function subscribeSessionRefresh(): () => void {
  // Persist future Firebase token changes and return Firebase's listener cleanup function.
  try {
    return onIdTokenChanged(getFirebaseAuth(), (user) => {
      if (!user) return;
      void user
        .getIdToken()
        .then((token) => {
          if (token) persistRefreshedToken(token);
        })
        .catch(() => undefined);
    });
  } catch {
    // Firebase unconfigured — no refresh possible; callers still work with the stored token until it expires.
    return () => undefined;
  }
}

// Sign in.

export interface SignInResult {
  session: AuthSession;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function signIn(
  email: string,
  password: string,
  remember: boolean,
): Promise<AuthSession> {
  // Authenticate with Firebase first, then verify the account is allowlisted by the API.
  let idToken: string;
  let uid: string;
  let accountEmail: string;
  let photoUrl: string | undefined;
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    uid = credential.user.uid;
    accountEmail = credential.user.email ?? email.trim();
    photoUrl = credential.user.photoURL ?? undefined;
    idToken = await credential.user.getIdToken();
  } catch {
    throw new AuthError('Invalid email or password.');
  }
  setAdminIdToken(idToken);

  // Prove admin rights — 403 unless the uid is allowlisted server-side.
  const me = await apiFetch<{ uid: string; email: string | null; admin: boolean }>('/api/admin/me');
  if (!me.ok) {
    clearAdminIdToken();
    throw new AuthError(
      me.error.code === 'FORBIDDEN' ? 'This account is not an admin.' : me.error.message,
    );
  }

  const ttl = remember ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT;
  const session: AuthSession = {
    token: idToken,
    user: {
      id: uid,
      name: credentialName(accountEmail, uid),
      email: accountEmail,
      role: 'Admin',
      avatarSeed: uid,
      photoUrl,
    },
    expiresAt: Date.now() + ttl,
  };
  saveSession(session, remember);
  return session;
}

function credentialName(email: string, uid: string): string {
  // Use the email prefix as the display name, falling back to the stable user id.
  const base = email.split('@')[0] ?? '';
  return base.length > 0 ? base : uid;
}

export async function signOut(): Promise<void> {
  clearSession();
  clearAdminIdToken();
  // Best-effort Firebase sign-out — never blocks the UI.
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch {
    // Ignore.
  }
}
