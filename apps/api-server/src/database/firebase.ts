import { createPrivateKey } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { env } from '../config/env.js';

function privateKey(): string {
  const key = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  try {
    createPrivateKey(key);
  } catch {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is not a valid PEM private key. ' +
        'Re-copy the full key from Firebase Console → Project settings → ' +
        'Service accounts → Generate new private key (keep the \\n escapes on one line).',
    );
  }
  return key;
}

function createFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  if (process.env.VITEST) {
    return initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      databaseURL: env.FIREBASE_DATABASE_URL,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey(),
    }),
    databaseURL: env.FIREBASE_DATABASE_URL,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

const firebaseApp = createFirebaseApp();

// Non-secret boot log: lets operators spot a project/email mismatch (the usual cause of UNAUTHENTICATED /.
if (!process.env.VITEST) {
  console.log(
    `[firebase] project=${env.FIREBASE_PROJECT_ID} clientEmail=${env.FIREBASE_CLIENT_EMAIL}`,
  );
}

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const rtdb = getDatabase(firebaseApp);
export const messaging = getMessaging(firebaseApp);
export const storageBucket: ReturnType<Storage['bucket']> = getStorage(firebaseApp).bucket();

export async function checkFirestoreConnection() {
  await firestore.listCollections();
}
