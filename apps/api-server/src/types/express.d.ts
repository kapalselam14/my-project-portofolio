// Type augmentations for express.
import type { DecodedIdToken } from 'firebase-admin/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        uid: string;
        token: DecodedIdToken;
      };
    }
  }
}

export {};
