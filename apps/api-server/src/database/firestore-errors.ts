/** Helpers for classifying Firestore gRPC errors. */

/** True when `err` looks like a Firestore auth/credential failure. */
export function isFirestoreAuthError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const record = err as {
    code?: unknown;
    reason?: unknown;
    details?: unknown;
    message?: unknown;
  };
  if (record.code === 16) {
    return true;
  }
  const haystack = [record.reason, record.details, record.message]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toUpperCase();
  return (
    haystack.includes('UNAUTHENTICATED') ||
    haystack.includes('ACCESS_TOKEN_EXPIRED') ||
    haystack.includes('INVALID AUTHENTICATION CREDENTIALS')
  );
}

/** Actionable remediation hint logged alongside Firestore auth failures. The private key itself is never logged. */
export function firestoreAuthHint(): string {
  return (
    'Firestore authentication failed (UNAUTHENTICATED / ACCESS_TOKEN_EXPIRED). ' +
    'The service-account key in apps/api-server/.env is missing, revoked, or ' +
    'does not match FIREBASE_CLIENT_EMAIL. Regenerate it via Firebase Console → ' +
    'Project settings → Service accounts → Generate new private key, update ' +
    'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, then restart the API.'
  );
}
