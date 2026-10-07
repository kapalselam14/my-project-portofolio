import type { NextFunction, Request, Response } from 'express';
import { auth, firestore } from '../database/firebase.js';
import { adminUids } from '../config/env.js';

// Request authentication: Firebase ID-token verification, suspension gate, admin gate.
// Controllers never touch tokens — they read the verified identity from req.auth.

type VerifiedIdentity = {
  uid: string;
  token: Awaited<ReturnType<typeof auth.verifyIdToken>>;
};

/** Verifies the Bearer token. Returns the identity or the 401 message. */
async function verifyBearer(
  req: Request,
): Promise<{ ok: true; identity: VerifiedIdentity } | { ok: false; message: string }> {
  const authorization = req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { ok: false, message: 'Missing or invalid Authorization header' };
  }
  const idToken = authorization?.slice('Bearer '.length).trim();

  if (!idToken) {
    return { ok: false, message: 'Missing Firebase ID token' };
  }

  try {
    // Revoked-token check: suspension revokes refresh tokens, so the session dies within ~1h.
    const decodedToken = await auth.verifyIdToken(idToken, true);
    return {
      ok: true,
      identity: { uid: decodedToken.uid, token: decodedToken },
    };
  } catch (error) {
    // Log the Firebase error code server-side only.
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'unknown';
    console.warn(`[auth] verifyIdToken rejected: ${code}`);
    return { ok: false, message: 'Invalid or expired Firebase ID token' };
  }
}

/** Suspension enforcement (admin members panel): a user whose doc carries `status: 'suspended'` loses API access. */
async function rejectIfSuspended(uid: string, res: Response): Promise<boolean> {
  try {
    const userSnap = await firestore.collection('users').doc(uid).get();
    const status = userSnap.exists ? userSnap.data()?.status : undefined;
    if (status === 'suspended') {
      res.status(403).json({
        ok: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account suspended',
        },
      });
      return true;
    }
  } catch {
    // Fail open on lookup errors — a Firestore blip must not lock everyone out.
  }
  return false;
}

function unauthorized(res: Response, message: string) {
  return res.status(401).json({
    ok: false,
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Main gate: valid token + active account, then attach the identity for controllers.
  const verified = await verifyBearer(req);
  if (!verified.ok) {
    return unauthorized(res, verified.message);
  }
  if (await rejectIfSuspended(verified.identity.uid, res)) {
    return;
  }
  req.auth = {
    uid: verified.identity.uid,
    token: verified.identity.token,
  };
  next();
}

/** Token verification WITHOUT the suspension gate — appeals routes only, so suspended users can appeal. */
export async function requireAuthAllowSuspended(req: Request, res: Response, next: NextFunction) {
  const verified = await verifyBearer(req);
  if (!verified.ok) {
    return unauthorized(res, verified.message);
  }
  req.auth = {
    uid: verified.identity.uid,
    token: verified.identity.token,
  };
  next();
}

/** Admin gate for triage routes (report list/resolve/dismiss). */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authenticated user is required',
      },
    });
  }
  if (adminUids().includes(uid)) {
    next();
    return;
  }
  try {
    const adminSnap = await firestore.collection('admins').doc(uid).get();
    if (adminSnap.exists) {
      next();
      return;
    }
  } catch {
    // Fall through to 403 — fail closed (see above).
  }
  return res.status(403).json({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Admin access is required',
    },
  });
}
