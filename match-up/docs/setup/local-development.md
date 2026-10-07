# Local Development Guide

This guide walks a new developer from a clean machine to all three apps running locally.

## 1. Prerequisites

| Tool       | Version  | Why                                |
| ---------- | -------- | ---------------------------------- |
| Node.js    | ≥ 22     | API + admin web (CI uses 22)       |
| npm        | ≥ 10     | package manager                      |
| Flutter    | 3.44.8   | Mobile app (pinned in CI)          |
| Git        | any      | source control                       |
| Firebase CLI | optional | Storage/rules deploy, emulator   |

No local database to install — the data plane is Firebase (`matchup-cs734`):
Firestore + Realtime Database + Storage + FCM, accessed via the Admin SDK.
See [`infra/firebase/README.md`](../../infra/firebase/README.md) for Firebase setup.

## 2. Clone the repository

```bash
git clone https://github.com/UOA-CS734-S2-2026/project-implementation-nimble-takahe.git
cd project-implementation-nimble-takahe
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

The default values are fine for local development. Edit at minimum the Firebase
service-account fields (Firebase Console → Project settings → Service accounts):

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`, `FIREBASE_WEB_API_KEY`, `FIREBASE_STORAGE_BUCKET`

See `apps/api-server/.env.example` for the full list.

For per-app overrides, copy each app's `.env.example`:

```bash
cp apps/api-server/.env.example apps/api-server/.env
cp apps/admin-web/.env.example    apps/admin-web/.env
cp apps/mobile/.env.example       apps/mobile/.env
```

## 4. Install dependencies

```bash
# API
(cd apps/api-server && npm install)

# Admin web (peer-dep mismatch between ESLint packages)
(cd apps/admin-web && npm install --legacy-peer-deps)

# Mobile
(cd apps/mobile && flutter pub get)
```

## 5. Run the apps

### One-command option

The repo includes a helper script that starts the API and admin web together and streams their logs:

```bash
./run.sh
```

To also launch the mobile app on a connected device or emulator:

```bash
./run.sh mobile
```

Stop everything:

```bash
./run.sh stop
```

### Manual option

Open three terminals.

```bash
# Terminal A — API
cd apps/api-server
npm run dev
# → http://localhost:4000/api/health
```

```bash
# Terminal B — admin web
cd apps/admin-web
npm run dev
# → http://localhost:5173
```

```bash
# Terminal C — mobile (requires an emulator or connected device)
cd apps/mobile
flutter run
```

## 6. Verify the setup

- API health: `curl http://localhost:4000/api/health` should return `{"ok":true,"data":{"status":"ok","service":"api-server","database":"connected"}}`. If `database` reports unavailable, check the Firebase credentials in `apps/api-server/.env`.
- Admin web: open http://localhost:5173 — the moderation cockpit (dashboard, members, activities, reports, appeals) behind admin login.
- Mobile: the Flutter app should launch in your emulator with onboarding → discovery deck.

## Common issues

### `flutter: command not found`

Install Flutter following the official guide: https://docs.flutter.dev/get-started/install.

### `npm install` fails with ERESOLVE on the admin web

The admin web currently requires `--legacy-peer-deps` for a peer-dependency mismatch between ESLint packages. Use:

```bash
cd apps/admin-web && npm install --legacy-peer-deps
```

### Port 4000 or 5173 already in use

Override `PORT` in `apps/api-server/.env` or pass `--port` to Vite:

```bash
cd apps/admin-web && npm run dev -- --port 5174
```

### API health returns `DB_UNAVAILABLE`

Check that `apps/api-server/.env` has valid Firebase credentials and the
service account has Firestore/Realtime Database access.

### Admin web shows "Offline"

The admin web calls `/api/health` via the browser. If you see "Offline", check that the API is running and that `VITE_API_BASE_URL` matches the API's actual port.

## Next steps

- Read [`docs/conventions/coding-standards.md`](../conventions/coding-standards.md)
- Read [`docs/architecture/overview.md`](../architecture/overview.md)
- Pick an MVP feature and create a feature branch: `git checkout -b feature/<name>`