// Tests for firestore errors.
import { describe, expect, it } from 'vitest';
import { firestoreAuthHint, isFirestoreAuthError } from './firestore-errors.js';

describe('isFirestoreAuthError', () => {
  it('detects the gRPC UNAUTHENTICATED code from the sweeper log', () => {
    expect(isFirestoreAuthError({ code: 16, details: 'expired' })).toBe(true);
  });

  it('detects ACCESS_TOKEN_EXPIRED reason without a code', () => {
    expect(
      isFirestoreAuthError({
        reason: 'ACCESS_TOKEN_EXPIRED',
        domain: 'googleapis.com',
      }),
    ).toBe(true);
  });

  it('detects credential messages in details text', () => {
    expect(
      isFirestoreAuthError({
        code: 16,
        details: 'Request had invalid authentication credentials. Expected OAuth 2 access token.',
      }),
    ).toBe(true);
  });

  it('rejects non-auth errors and non-objects', () => {
    expect(isFirestoreAuthError(new Error('DB down'))).toBe(false);
    expect(isFirestoreAuthError({ code: 5, details: 'NOT_FOUND' })).toBe(false);
    expect(isFirestoreAuthError(null)).toBe(false);
    expect(isFirestoreAuthError('UNAUTHENTICATED')).toBe(false);
  });
});

describe('firestoreAuthHint', () => {
  it('mentions rotation without leaking secrets', () => {
    const hint = firestoreAuthHint();
    expect(hint).toContain('FIREBASE_PRIVATE_KEY');
    expect(hint).toContain('Generate new private key');
    expect(hint).not.toContain('-----BEGIN');
  });
});
