import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({
  path: process.env.VITEST ? '.env.test' : '.env',
});

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // An AUTH_SECRET var used to be required here, but no code ever read it.
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
  FIREBASE_DATABASE_URL: z
    .string()
    .url('FIREBASE_DATABASE_URL must be a valid URL')
    .min(1, 'FIREBASE_DATABASE_URL is required'),
  FIREBASE_WEB_API_KEY: z.string().min(1, 'FIREBASE_WEB_API_KEY is required'),
  FIREBASE_STORAGE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/, 'FIREBASE_STORAGE_BUCKET must be a valid bucket name'),
  // Bootstrap admin allowlist (comma-separated Firebase auth uids).
  ADMIN_UIDS: z.string().default(''),
  // Browser origins allowed to call the API (comma-separated).
  CORS_ORIGINS: z.string().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Firebase auth uids allowed onto admin-only routes. */
export function adminUids(): string[] {
  return env.ADMIN_UIDS.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Browser origins allowed by CORS. Empty = not configured. */
export function corsOrigins(): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
