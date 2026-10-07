# Environment Variables

All environment variables used across the MatchUp apps, grouped by app.

## Root `.env.example`

The root file at `.env.example` is the canonical reference. Per-app `.env.example` files document only the variables that app actually consumes.

### API (`apps/api-server`, Firebase)

| Variable                 | Required | Default                  | Description                                                                |
| ------------------------ | -------- | ------------------------ | -------------------------------------------------------------------------- |
| `PORT`                   | no       | `4000`                   | Port the Express server listens on.                                        |
| `FIREBASE_PROJECT_ID`    | yes      | —                        | Firebase project id (service account).                                     |
| `FIREBASE_CLIENT_EMAIL`  | yes      | —                        | Service-account client email.                                              |
| `FIREBASE_PRIVATE_KEY`   | yes      | —                        | Service-account private key (keep newlines escaped).                       |
| `FIREBASE_DATABASE_URL`  | yes      | —                        | Realtime Database URL.                                                     |
| `FIREBASE_WEB_API_KEY`   | yes      | —                        | Firebase web API key (client config).                                      |
| `FIREBASE_STORAGE_BUCKET`| yes      | —                        | Storage bucket name.                                                       |
| `ADMIN_UIDS`             | no       | —                        | Bootstrap admin allowlist (primary source: Firestore `admins` collection). |
| `CORS_ORIGINS`           | no       | allow all (warns)        | **Required in production.** Comma-separated browser origins.               |
| `NODE_ENV`               | no       | `development`            | One of `development`, `test`, `production`.                                |
| `LOG_LEVEL`              | no       | `info`                   | One of `trace`, `debug`, `info`, `warn`, `error`, `fatal`.                 |

### Admin web (`apps/admin-web`)

| Variable             | Required | Default                 | Description                                                       |
| -------------------- | -------- | ----------------------- | ----------------------------------------------------------------- |
| `VITE_API_BASE_URL`  | no       | `http://localhost:4000` | Base URL the admin web uses when calling the API.                 |

### Mobile (`apps/mobile`)

| Variable        | Required | Default                 | Description                                                       |
| --------------- | -------- | ----------------------- | ----------------------------------------------------------------- |
| `API_BASE_URL`  | no       | `http://localhost:4000` | Base URL the Flutter app uses when calling the API.               |
| `APP_ENV`       | no       | `local`                 | Environment label, useful for analytics / feature flags.          |

## How variables are loaded

- **API** — `dotenv` reads `apps/api-server/.env` (or the root `.env`) at boot. Validation is performed in `src/config/env.ts` using Zod; the process refuses to boot when required variables are missing or invalid.
- **Admin web** — Vite injects variables prefixed with `VITE_` at build time. They are accessed via `import.meta.env.VITE_*`.
- **Mobile** — `flutter_dotenv` loads `apps/mobile/.env` at startup. The `Env` class in `lib/core/config/env.dart` exposes typed accessors.

## Environments

The repo assumes three deployment environments:

- `local` — developer laptops (Firebase project `matchup-cs734`)
- `staging` — pre-production
- `production` — live users (Cloud Run + Vercel; `CORS_ORIGINS` required, secrets via Secret Manager)