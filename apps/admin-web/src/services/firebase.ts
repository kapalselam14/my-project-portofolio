/** Firebase client for admin sign-in. */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;

export function getFirebaseAuth(): Auth {
  if (!app) {
    // Initialize lazily so missing environment configuration is reported only when auth is used.
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
    if (!apiKey || !authDomain || !projectId) {
      throw new Error(
        'Missing Firebase web config — set VITE_FIREBASE_API_KEY, ' +
          'VITE_FIREBASE_AUTH_DOMAIN and VITE_FIREBASE_PROJECT_ID.',
      );
    }
    app = initializeApp({ apiKey, authDomain, projectId });
  }
  return getAuth(app);
}
